import { App } from "@modelcontextprotocol/ext-apps";
import { getMcpCardArt } from "./mcp-card-art.js";
import {
  assertCompleteVisualDeck,
  extractError,
  normalizeBeginPayload,
  normalizeConfirmedReading,
} from "./normalize.js";
import type {
  BeginReadingInput,
  BeginReadingInputSnapshot,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  EmbeddedImage,
  ReadingCard,
} from "./types.js";

type InitialHandlers = Parameters<
  NonNullable<DrawClient["subscribeInitial"]>
>[0];

const HOST_CONTINUATION_TIMEOUT_MS = 10_000;

interface ModelReadingCard {
  id: string;
  name: string;
  displayName: string;
  orientation: "upright" | "reversed";
  position?: string;
  positionMeaning?: string;
  meaning?: string;
  keywords?: string[];
}

interface ModelReadingContext {
  status: "confirmed";
  readingId?: string;
  sessionId?: string;
  drawId?: string;
  spreadType: string;
  spreadName: string;
  question: string;
  language: ConfirmedReading["language"];
  timestamp?: string;
  cards: ModelReadingCard[];
  interpretation?: string;
}

function applyHostContext(app: App): void {
  const context = app.getHostContext();
  document.documentElement.dataset.theme =
    context?.theme === "dark" ? "dark" : "light";
  document.documentElement.lang = context?.locale?.startsWith("zh")
    ? "zh"
    : "en";
}

function blobUrl(image: EmbeddedImage): string {
  const bytes = Uint8Array.from(atob(image.data), (character) =>
    character.charCodeAt(0),
  );
  return URL.createObjectURL(new Blob([bytes], { type: image.mimeType }));
}

function hasCards(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const root = value as Record<string, unknown>;
  if (Array.isArray(root.cards)) return true;
  return typeof root.reading === "object" && root.reading !== null
    ? Array.isArray((root.reading as Record<string, unknown>).cards)
    : false;
}

/** Keep binary card art out of model context while retaining the full reading. */
function modelReadingContext(reading: ConfirmedReading): ModelReadingContext {
  return {
    status: "confirmed",
    ...(reading.readingId ? { readingId: reading.readingId } : {}),
    ...(reading.sessionId ? { sessionId: reading.sessionId } : {}),
    ...(reading.drawId ? { drawId: reading.drawId } : {}),
    spreadType: reading.spreadType,
    spreadName: reading.spreadName,
    question: reading.question,
    language: reading.language,
    ...(reading.timestamp ? { timestamp: reading.timestamp } : {}),
    cards: reading.cards.map((card) => ({
      id: card.id,
      name: card.name,
      displayName: card.displayName,
      orientation: card.orientation,
      ...(card.position ? { position: card.position } : {}),
      ...(card.positionMeaning
        ? { positionMeaning: card.positionMeaning }
        : {}),
      ...(card.meaning ? { meaning: card.meaning } : {}),
      ...(card.keywords?.length ? { keywords: [...card.keywords] } : {}),
    })),
    ...(reading.interpretation
      ? { interpretation: reading.interpretation }
      : {}),
  };
}

function readingContinuationText(reading: ModelReadingContext): string {
  const chinese = reading.language === "zh";
  const lines = [
    chinese
      ? "我已在可视化塔罗牌桌中完成选牌。请基于这次已确认的牌面继续解读并回复，不要重新抽牌。"
      : "I have finished selecting cards in the visual tarot table. Continue the reading from these confirmed cards and reply without drawing again.",
    "",
    `${chinese ? "牌阵" : "Spread"}: ${reading.spreadName}`,
  ];
  if (reading.question) {
    lines.push(`${chinese ? "问题" : "Question"}: ${reading.question}`);
  }
  lines.push(chinese ? "已确认牌面：" : "Confirmed cards:");
  reading.cards.forEach((card, index) => {
    const orientation = chinese
      ? card.orientation === "reversed"
        ? "逆位"
        : "正位"
      : card.orientation;
    const position = card.position ? `${card.position} — ` : "";
    const details = [
      card.keywords?.length ? card.keywords.join(", ") : undefined,
      card.meaning,
    ].filter(Boolean);
    lines.push(
      `${index + 1}. ${position}${card.displayName} (${orientation})${
        details.length ? ` — ${details.join(" — ")}` : ""
      }`,
    );
  });
  if (reading.interpretation) {
    lines.push(
      "",
      `${chinese ? "已有解读" : "Existing interpretation"}: ${reading.interpretation}`,
    );
  }
  return lines.join("\n");
}

function continuationKey(reading: ConfirmedReading): string {
  if (reading.readingId) return `reading:${reading.readingId}`;
  return JSON.stringify({
    drawId: reading.drawId,
    spreadType: reading.spreadType,
    cards: reading.cards.map(({ id, orientation, position }) => ({
      id,
      orientation,
      position,
    })),
  });
}

export function createMcpClient(
  app: App = new App({ name: "Tarot Visual Reading", version: "1.0.0" }),
): DrawClient & { connect(): Promise<void> } {
  const handlers = new Set<InitialHandlers>();
  const imageCache = new Map<string, string>();
  const continuedReadings = new Set<string>();
  let lastInput: BeginReadingInputSnapshot = {};
  let lastBegin: BeginReadingPayload | undefined;
  let lastConfirmed: ConfirmedReading | undefined;
  let lastError: Error | undefined;

  const emit = (): void => {
    for (const handler of handlers) {
      if (lastError) handler.onError(lastError);
      else if (lastConfirmed) handler.onConfirmed(lastConfirmed);
      else if (lastBegin) handler.onBegin(lastBegin);
    }
  };

  const captureBegin = (result: unknown): BeginReadingPayload => {
    const normalized = normalizeBeginPayload(result, lastInput);
    const payload = {
      ...normalized,
      deckBackImageUri: normalized.deckBackImageUri ?? getMcpCardArt("back"),
    };
    assertCompleteVisualDeck(payload);
    lastBegin = payload;
    lastConfirmed = undefined;
    lastError = undefined;
    return payload;
  };

  const captureConfirmed = (result: unknown): ConfirmedReading => {
    const payload = normalizeConfirmedReading(result, lastBegin);
    lastConfirmed = payload;
    lastError = undefined;
    return payload;
  };

  /**
   * Best-effort bridge from an App-only confirm tool call back into the host
   * conversation. Updating context gives the model the exact cards; the user
   * message starts a new assistant turn. Neither request may delay or fail the
   * card reveal in the App.
   */
  const continueInHost = (reading: ConfirmedReading): void => {
    const key = continuationKey(reading);
    if (continuedReadings.has(key)) return;
    continuedReadings.add(key);

    void (async () => {
      let capabilities: ReturnType<App["getHostCapabilities"]>;
      try {
        capabilities = app.getHostCapabilities();
      } catch {
        return;
      }

      const context = modelReadingContext(reading);
      const text = readingContinuationText(context);
      const contextCapability = capabilities?.updateModelContext;
      if (contextCapability) {
        const content = contextCapability.text
          ? [{ type: "text" as const, text }]
          : undefined;
        const structuredContent = contextCapability.structuredContent
          ? { tarotVisualReading: context }
          : undefined;
        if (content || structuredContent) {
          try {
            await app.updateModelContext(
              {
                ...(content ? { content } : {}),
                ...(structuredContent ? { structuredContent } : {}),
              },
              { timeout: HOST_CONTINUATION_TIMEOUT_MS },
            );
          } catch {
            // The full reading is also included in the follow-up message below.
          }
        }
      }

      if (capabilities?.message?.text) {
        try {
          await app.sendMessage(
            {
              role: "user",
              content: [{ type: "text", text }],
            },
            { timeout: HOST_CONTINUATION_TIMEOUT_MS },
          );
        } catch {
          // Host continuation is additive; the confirmed cards stay visible.
        }
      }
    })();
  };

  app.ontoolinput = (params) => {
    lastInput = (params.arguments ?? {}) as BeginReadingInputSnapshot;
  };
  app.ontoolresult = (result) => {
    try {
      if (result.isError)
        throw extractError(result, "The visual reading tool failed.");
      if (hasCards(result.structuredContent)) captureConfirmed(result);
      else captureBegin(result);
      emit();
    } catch (error) {
      lastError = extractError(error, "Invalid tool result");
      emit();
    }
  };
  app.onhostcontextchanged = () => applyHostContext(app);

  const client: DrawClient & { connect(): Promise<void> } = {
    target: "mcp",
    async connect(): Promise<void> {
      try {
        await app.connect();
        applyHostContext(app);
      } catch (error) {
        lastError = extractError(error, "Could not connect to the MCP host.");
        emit();
        throw error;
      }
    },
    subscribeInitial(nextHandlers): () => void {
      handlers.add(nextHandlers);
      emit();
      return () => handlers.delete(nextHandlers);
    },
    async beginReading(input: BeginReadingInput): Promise<BeginReadingPayload> {
      lastInput = input;
      const result = await app.callServerTool({
        name: "begin_visual_reading",
        arguments: input as unknown as Record<string, unknown>,
      });
      if (result.isError) throw extractError(result, "Could not begin reading");
      return captureBegin(result);
    },
    async confirmReading(drawId, selectedSlotIds): Promise<ConfirmedReading> {
      const result = await app.callServerTool({
        name: "confirm_visual_reading",
        arguments: { drawId, selectedSlotIds },
      });
      if (result.isError)
        throw extractError(result, "Could not confirm reading");
      const reading = captureConfirmed(result);
      continueInHost(reading);
      return reading;
    },
    async resolveImage(card: ReadingCard): Promise<string | undefined> {
      if (card.embeddedImage) {
        if (card.embeddedImage.data.startsWith("data:")) {
          return card.embeddedImage.data;
        }
        const cacheKey = `embedded:${card.id}`;
        const cached = imageCache.get(cacheKey);
        if (cached) return cached;
        const url = blobUrl(card.embeddedImage);
        imageCache.set(cacheKey, url);
        return url;
      }
      if (
        card.imageUri?.startsWith("data:") ||
        card.imageUri?.startsWith("blob:")
      ) {
        return card.imageUri;
      }
      // Current MCP artwork is bundled into the App resource itself. Tool
      // results stay text/JSON-only instead of attaching card image payloads
      // to the host model conversation.
      return getMcpCardArt(card.id);
    },
    canRequestFullscreen(): boolean {
      return (app.getHostContext()?.availableDisplayModes ?? []).includes(
        "fullscreen",
      );
    },
    async requestFullscreen(): Promise<void> {
      const available = app.getHostContext()?.availableDisplayModes ?? [];
      if (available.includes("fullscreen")) {
        await app.requestDisplayMode({ mode: "fullscreen" });
      }
    },
  };
  return client;
}
