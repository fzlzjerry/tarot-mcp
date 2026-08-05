import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  EXTENSION_ID,
  getUiCapability,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_SERVER_INFO } from "./public-api.js";
import { TOOL_NAMES } from "./public-api.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { TarotServer } from "./tarot-service.js";
import type { VisualBrowserFallback } from "./browser-handoff.js";
import type { VisualBeginPayload } from "../tarot/readings/visual-draw-manager.js";
import { logger } from "../tarot/shared/logger.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function visualDeckSlots(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((slot) => {
    if (
      !isRecord(slot) ||
      typeof slot.slotId !== "string" ||
      typeof slot.order !== "number"
    ) {
      return [];
    }
    return [{ slotId: slot.slotId, order: slot.order }];
  });
}

const MCP_ARTWORK_FIELDS = new Set([
  "imageUri",
  "imageUrl",
  "imageResourceUri",
  "embeddedImage",
  "cardImages",
  "backImage",
  "backImageUri",
  "deckBackImageUri",
]);

/** Keep artwork in the App/Web presentation layer, never in model tool data. */
function withoutMcpArtwork(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutMcpArtwork);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      MCP_ARTWORK_FIELDS.has(key)
        ? []
        : [[key, withoutMcpArtwork(nested)] as const],
    ),
  );
}

export interface McpProtocolServerOptions {
  visualBrowserFallback?: VisualBrowserFallback;
}

function isVisualBeginPayload(value: unknown): value is VisualBeginPayload {
  return (
    isRecord(value) &&
    typeof value.drawId === "string" &&
    typeof value.expiresAt === "string" &&
    typeof value.language === "string" &&
    Array.isArray(value.slots)
  );
}

export function clientSupportsMcpApps(server: Server): boolean {
  const capability = getUiCapability(server.getClientCapabilities());
  return (
    Array.isArray(capability?.mimeTypes) &&
    capability.mimeTypes.includes(RESOURCE_MIME_TYPE)
  );
}

function browserFallbackText(
  draw: VisualBeginPayload,
  result: Awaited<ReturnType<VisualBrowserFallback["open"]>>,
): string {
  const chinese = draw.language === "zh";
  if (result.opened) {
    return result.reused
      ? chinese
        ? "现有浏览器牌桌仍可继续使用。"
        : "The existing browser card table is still available."
      : chinese
        ? "已自动在浏览器中打开牌桌，请在那里选牌并确认。"
        : "The card table opened automatically in your browser. Select and confirm there.";
  }
  return chinese
    ? `此 MCP 客户端不支持内嵌 App。请打开浏览器牌桌：${result.url}`
    : `This MCP client does not support embedded Apps. Open the browser card table: ${result.url}`;
}

/**
 * Create a fresh MCP protocol server wired to the tarot domain service.
 *
 * Each transport session gets its own Server instance. This avoids sharing
 * request/response state across stdio, Streamable HTTP, and legacy SSE clients.
 */
export function createMcpProtocolServer(
  tarotServer: TarotServer,
  options: McpProtocolServerOptions = {},
): Server {
  const server = new Server(MCP_SERVER_INFO, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      extensions: {
        [EXTENSION_ID]: {},
      },
    },
  });

  registerResources(server, tarotServer);
  registerPrompts(server);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tarotServer.getAvailableTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    try {
      let result = await tarotServer.executeTool(name, args || {});
      let structuredContent = result.ok ? result.structured : undefined;
      let resultMeta: Record<string, unknown> | undefined;
      let resultText = result.ok ? result.text : result.error;

      if (
        result.ok &&
        name === TOOL_NAMES.beginVisualReading &&
        isRecord(structuredContent)
      ) {
        const privateDraw = isVisualBeginPayload(structuredContent)
          ? structuredContent
          : undefined;
        const { slots, deck: _privateDeck, ...publicDraw } = structuredContent;
        structuredContent = publicDraw;
        resultMeta = {
          visualDeck: {
            slots: visualDeckSlots(slots),
          },
        };
        const browserFallback = options.visualBrowserFallback;
        if (
          privateDraw &&
          browserFallback &&
          (browserFallback.force || !clientSupportsMcpApps(server))
        ) {
          let handoffStarted = false;
          try {
            const handoff = await browserFallback.open(privateDraw);
            handoffStarted = true;
            const progressToken = extra._meta?.progressToken;
            let progressDelivered = false;
            if (progressToken !== undefined) {
              try {
                await extra.sendNotification({
                  method: "notifications/progress",
                  params: {
                    progressToken,
                    progress: 0,
                    total: 1,
                    message: browserFallbackText(privateDraw, handoff),
                  },
                });
                progressDelivered = true;
              } catch (error) {
                logger.warn("browser_fallback_progress_failed", {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            // An automatically opened page needs no textual handoff. Link mode
            // can also remain pending when the client accepted the URL through
            // MCP progress. Otherwise preserve the immediate link response so a
            // client without progress support is never stranded.
            if (handoff.opened || progressDelivered) {
              let heartbeatProgress = 0;
              const heartbeat =
                progressToken !== undefined
                  ? setInterval(() => {
                      heartbeatProgress = Math.min(
                        0.95,
                        heartbeatProgress + 0.01,
                      );
                      void extra
                        .sendNotification({
                          method: "notifications/progress",
                          params: {
                            progressToken,
                            progress: heartbeatProgress,
                            total: 1,
                            message:
                              privateDraw.language === "zh"
                                ? "正在等待浏览器确认选牌…"
                                : "Waiting for card confirmation in the browser…",
                          },
                        })
                        .catch((error) => {
                          logger.warn("browser_fallback_progress_failed", {
                            error:
                              error instanceof Error
                                ? error.message
                                : String(error),
                          });
                        });
                    }, 15_000)
                  : undefined;
              heartbeat?.unref();
              try {
                result = await browserFallback.waitForConfirmation(
                  privateDraw.drawId,
                  { signal: extra.signal },
                );
              } finally {
                if (heartbeat) clearInterval(heartbeat);
              }

              structuredContent = result.structured;
              resultText = result.text;
              resultMeta = {
                browserFallback: {
                  opened: handoff.opened,
                  reused: handoff.reused,
                  completed: true,
                },
              };
              if (progressToken !== undefined) {
                try {
                  await extra.sendNotification({
                    method: "notifications/progress",
                    params: {
                      progressToken,
                      progress: 1,
                      total: 1,
                      message:
                        privateDraw.language === "zh"
                          ? "选牌已确认，正在把结果交还给客户端。"
                          : "Cards confirmed; returning the reading to the client.",
                    },
                  });
                } catch (error) {
                  logger.warn("browser_fallback_progress_failed", {
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }
            } else {
              resultText = `${resultText}\n\n${browserFallbackText(privateDraw, handoff)}`;
              resultMeta.browserFallback = {
                opened: handoff.opened,
                reused: handoff.reused,
                completed: false,
              };
            }
          } catch (error) {
            logger.warn(
              handoffStarted
                ? "browser_fallback_wait_failed"
                : "browser_fallback_start_failed",
              {
                error: error instanceof Error ? error.message : String(error),
              },
            );
            throw error;
          }
        }
      }

      const modelStructuredContent = withoutMcpArtwork(structuredContent);
      const modelResultMeta = withoutMcpArtwork(resultMeta) as
        | Record<string, unknown>
        | undefined;

      return {
        ...(result.ok ? {} : { isError: true }),
        ...(modelStructuredContent !== undefined
          ? { structuredContent: modelStructuredContent }
          : {}),
        ...(modelResultMeta ? { _meta: modelResultMeta } : {}),
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });

  return server;
}
