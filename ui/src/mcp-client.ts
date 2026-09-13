import { App } from "@modelcontextprotocol/ext-apps";
import { getMcpCardArt } from "./mcp-card-art.js";
import {
  assertCompleteVisualDeck,
  extractError,
  normalizeBeginPayload,
  normalizeConfirmedReading,
} from "./normalize.js";
import { modelReadingContext, restoreUiSnapshot } from "./ui-state.js";
import type { ModelReadingContext } from "./ui-state.js";
import type {
  BeginReadingInput,
  BeginReadingInputSnapshot,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  EmbeddedImage,
  ReadingCard,
  TarotUiSnapshot,
} from "./types.js";

type InitialHandlers = Parameters<
  NonNullable<DrawClient["subscribeInitial"]>
>[0];

const HOST_CONTINUATION_TIMEOUT_MS = 10_000;

interface OpenAiFollowUpBridge {
  sendFollowUpMessage?: (args: {
    prompt: string;
    scrollToBottom?: boolean;
  }) => Promise<void>;
  widgetState?: { privateContent?: { tarot?: unknown } };
  setWidgetState?: (state: {
    modelContent: Record<string, never>;
    privateContent: { tarot: TarotUiSnapshot };
  }) => void;
}

function applyHostContext(app: App): void {
  const context = app.getHostContext();
  document.documentElement.dataset.theme =
    context?.theme === "dark" ? "dark" : "light";
  document.documentElement.lang = context?.locale?.startsWith("zh")
    ? "zh"
    : "en";
  for (const side of ["top", "right", "bottom", "left"] as const) {
    document.documentElement.style.setProperty(
      `--host-safe-area-${side}`,
      `${context?.safeAreaInsets?.[side] ?? 0}px`,
    );
  }
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
  const continuingReadings = new Map<string, Promise<"sent" | "unsupported">>();
  let lastInput: BeginReadingInputSnapshot = {};
  let lastBegin: BeginReadingPayload | undefined;
  let lastConfirmed: ConfirmedReading | undefined;
  let lastError: Error | undefined;

  const readUiState = (): unknown => {
    try {
      const openai = (window as Window & { openai?: OpenAiFollowUpBridge })
        .openai;
      return typeof openai?.setWidgetState === "function"
        ? openai.widgetState?.privateContent?.tarot
        : undefined;
    } catch {
      return undefined;
    }
  };

  const matchingSnapshot = (value: unknown): TarotUiSnapshot | undefined => {
    const payload = lastConfirmed ?? lastBegin;
    if (!payload) return undefined;
    return restoreUiSnapshot(
      value,
      lastConfirmed && lastBegin && lastBegin.drawId === lastConfirmed.drawId
        ? { ...lastConfirmed, slots: lastBegin.slots }
        : payload,
    );
  };

  const writeUiState = (state: TarotUiSnapshot): void => {
    try {
      const openai = (window as Window & { openai?: OpenAiFollowUpBridge })
        .openai;
      if (typeof openai?.setWidgetState !== "function") return;
      const snapshot = matchingSnapshot(state);
      if (!snapshot) return;
      openai.setWidgetState({
        modelContent: {},
        privateContent: { tarot: snapshot },
      });
    } catch {
      // Optional host persistence must not interrupt the in-memory ritual.
    }
  };

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
    if (lastConfirmed?.drawId !== payload.drawId) lastConfirmed = undefined;
    lastError = undefined;
    return payload;
  };

  const captureConfirmed = (result: unknown): ConfirmedReading => {
    const payload = normalizeConfirmedReading(result, lastBegin);
    lastConfirmed = payload;
    lastError = undefined;
    return payload;
  };

  /** Send the revealed reading only when the user explicitly requests it. */
  const continueInHost = (
    reading: ConfirmedReading,
  ): Promise<"sent" | "unsupported"> => {
    const key = continuationKey(reading);
    if (continuedReadings.has(key)) return Promise.resolve("sent");
    const saved = matchingSnapshot(readUiState());
    if (
      saved?.continuationSent &&
      saved.confirmedReading &&
      restoreUiSnapshot(saved, reading)?.continuationSent
    ) {
      continuedReadings.add(key);
      return Promise.resolve("sent");
    }
    const pending = continuingReadings.get(key);
    if (pending) return pending;

    const continuation = (async (): Promise<"sent" | "unsupported"> => {
      const capabilities = app.getHostCapabilities();
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
        const result = await app.sendMessage(
          {
            role: "user",
            content: [{ type: "text", text }],
          },
          { timeout: HOST_CONTINUATION_TIMEOUT_MS },
        );
        if (result.isError === true) {
          throw new Error("The host rejected the interpretation request.");
        }
      } else {
        const openai = (window as Window & { openai?: OpenAiFollowUpBridge })
          .openai;
        if (typeof openai?.sendFollowUpMessage !== "function")
          return "unsupported";
        // Select one advertised bridge before sending. Never switch bridges
        // after a rejection or uncertain delivery from the standard API.
        let timer: number | undefined;
        try {
          await Promise.race([
            openai.sendFollowUpMessage({ prompt: text }),
            new Promise<never>((_, reject) => {
              timer = window.setTimeout(
                () =>
                  reject(
                    new Error("The host interpretation request timed out."),
                  ),
                HOST_CONTINUATION_TIMEOUT_MS,
              );
            }),
          ]);
        } finally {
          if (timer !== undefined) window.clearTimeout(timer);
        }
      }
      continuedReadings.add(key);
      const snapshot = matchingSnapshot(readUiState());
      if (snapshot?.confirmedReading && restoreUiSnapshot(snapshot, reading)) {
        writeUiState({ ...snapshot, continuationSent: true });
      }
      return "sent";
    })().finally(() => continuingReadings.delete(key));
    continuingReadings.set(key, continuation);
    return continuation;
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
      return captureConfirmed(result);
    },
    continueReading: continueInHost,
    readUiState,
    writeUiState,
    getPreviewImage: getMcpCardArt,
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
