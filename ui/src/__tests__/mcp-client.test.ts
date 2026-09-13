import type { App } from "@modelcontextprotocol/ext-apps";
import { vi } from "vitest";
import { createMcpClient } from "../mcp-client.js";
import type { ConfirmedReading, TarotUiSnapshot } from "../types.js";

interface ContextPayload {
  content?: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
}

interface MessagePayload {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
}

function confirmedToolResult() {
  return {
    content: [{ type: "text" as const, text: "# Three Card Reading" }],
    structuredContent: {
      readingId: "reading_confirmed",
      sessionId: "session_confirmed",
      drawId: "draw_confirmed",
      spreadType: "three_card",
      spreadName: "Three Card Spread",
      question: "What should I understand?",
      language: "en",
      timestamp: "2026-08-05T05:00:00.000Z",
      cards: [
        {
          cardId: "fool",
          name: "The Fool",
          displayName: "The Fool",
          orientation: "upright",
          position: "Past",
          positionMeaning: "What shaped the situation",
          keywords: ["beginnings", "trust"],
          meaning: "A new path is opening.",
          imageUri: "/assets/cards/fool.webp",
        },
        {
          cardId: "world",
          name: "The World",
          displayName: "The World",
          orientation: "reversed",
          position: "Present",
          keywords: ["completion"],
          meaning: "One final step remains.",
        },
      ],
    },
  };
}

function beginToolResult() {
  return {
    content: [{ type: "text" as const, text: "Choose three cards." }],
    structuredContent: {
      drawId: "draw_pending",
      status: "pending",
      readingKind: "spread",
      spreadType: "three_card",
      spreadName: "Three Card Spread",
      question: "What should I understand?",
      language: "en",
      requiredCount: 3,
    },
    _meta: {
      visualDeck: {
        slots: Array.from({ length: 78 }, (_, order) => ({
          slotId: `slot-${order}`,
          order,
        })),
      },
    },
  };
}

function createFakeApp(
  capabilities: Record<string, unknown> | undefined,
  toolResult: unknown = confirmedToolResult(),
) {
  const callServerTool = vi.fn(
    async (_params: Record<string, unknown>) => toolResult,
  );
  const updateModelContext = vi.fn(
    async (_params: ContextPayload, _options?: { timeout?: number }) => ({}),
  );
  const sendMessage = vi.fn(
    async (
      _params: MessagePayload,
      _options?: { timeout?: number },
    ): Promise<{ isError?: boolean }> => ({}),
  );
  const app = {
    callServerTool,
    updateModelContext,
    sendMessage,
    getHostCapabilities: vi.fn(() => capabilities),
    getHostContext: vi.fn(() => undefined),
    connect: vi.fn(async () => undefined),
    requestDisplayMode: vi.fn(async () => ({})),
    ontoolinput: undefined,
    ontoolresult: undefined,
    onhostcontextchanged: undefined,
  } as unknown as App;
  return { app, callServerTool, updateModelContext, sendMessage };
}

function checkpoint(reading: ConfirmedReading): TarotUiSnapshot {
  return {
    version: 1,
    drawId: reading.drawId!,
    deckOrder: Array.from({ length: 78 }, (_, index) => `slot-${index}`),
    selectedSlotIds: ["slot-1", "slot-2"],
    confirmedReading: reading,
    revealedIndices: [0, 1],
    continuationSent: false,
  };
}

function installWidgetState() {
  type HostState = {
    modelContent: Record<string, never>;
    privateContent: { tarot: TarotUiSnapshot };
  };
  const bridge = {
    widgetState: undefined as HostState | undefined,
    setWidgetState: vi.fn((state: HostState): void => {
      bridge.widgetState = state;
    }),
  };
  vi.stubGlobal("openai", bridge);
  return bridge;
}

describe("embedded MCP App host continuation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses artwork bundled with the App while the begin result carries slots only", async () => {
    const { app } = createFakeApp(undefined, beginToolResult());
    const client = createMcpClient(app);

    const draw = await client.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What should I understand?",
      language: "en",
    });

    expect(draw.slots).toHaveLength(78);
    expect(draw.deckBackImageUri).toMatch(/^data:image\/webp;base64,/);
  });

  it("resolves confirmed card art from the App bundle, not the tool result", async () => {
    const { app } = createFakeApp(undefined);
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);

    await expect(client.resolveImage!(reading.cards[0]!)).resolves.toMatch(
      /^data:image\/webp;base64,/,
    );
  });

  it("keeps confirmation silent until explicitly asked to continue with semantic cards only", async () => {
    const { app, callServerTool, updateModelContext, sendMessage } =
      createFakeApp({
        updateModelContext: { text: {}, structuredContent: {} },
        message: { text: {} },
      });
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);

    expect(reading).toMatchObject({
      readingId: "reading_confirmed",
      cards: [
        { id: "fool", orientation: "upright" },
        { id: "world", orientation: "reversed" },
      ],
    });
    expect(updateModelContext).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    Object.assign(reading, {
      deckBackImageUri: "data:image/webp;base64,private-back",
      selectedSlotIds: ["opaque-private-slot"],
      token: "private-access-token",
      interpretation: "Consider both the beginning and the unfinished ending.",
    });
    Object.assign(reading.cards[0]!, {
      embeddedImage: { mimeType: "image/webp", data: "private-art-payload" },
      slotId: "opaque-private-slot",
    });

    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(callServerTool).toHaveBeenCalledOnce();
    expect(updateModelContext.mock.invocationCallOrder[0]).toBeLessThan(
      sendMessage.mock.invocationCallOrder[0],
    );
    const context = updateModelContext.mock.calls[0]![0];
    expect(context.content![0]!.text).toContain("The Fool (upright)");
    expect(context.structuredContent).toMatchObject({
      tarotVisualReading: {
        status: "confirmed",
        readingId: "reading_confirmed",
        question: "What should I understand?",
        cards: [
          {
            id: "fool",
            position: "Past",
            positionMeaning: "What shaped the situation",
            keywords: ["beginnings", "trust"],
            meaning: "A new path is opening.",
          },
          { id: "world", position: "Present", orientation: "reversed" },
        ],
      },
    });
    const message = sendMessage.mock.calls[0]![0];
    expect(message.role).toBe("user");
    expect(message.content[0]!.text).toContain("without drawing again");
    expect(message.content[0]!.text).toContain("Past — The Fool (upright)");
    expect(message.content[0]!.text).toContain(
      "Present — The World (reversed)",
    );
    expect(message.content[0]!.text).toContain(reading.interpretation);
    const modelPayloads = JSON.stringify({ context, message });
    expect(modelPayloads).not.toMatch(
      /imageUri|embeddedImage|data:image|private-back|private-art-payload|opaque-private-slot|private-access-token|selectedSlotIds|slotId/,
    );
  });

  it("merges simultaneous requests and remembers success for the same reading key", async () => {
    const { app, callServerTool, updateModelContext, sendMessage } =
      createFakeApp({
        updateModelContext: { structuredContent: {} },
        message: { text: {} },
      });
    let accept!: (result: { isError?: boolean }) => void;
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    const first = client.continueReading!(reading);
    const second = client.continueReading!({ ...reading });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    expect(updateModelContext).toHaveBeenCalledOnce();
    accept({ isError: false });
    await expect(Promise.all([first, second])).resolves.toEqual([
      "sent",
      "sent",
    ]);
    await expect(client.continueReading!({ ...reading })).resolves.toBe("sent");
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(callServerTool).toHaveBeenCalledOnce();

    await expect(
      client.continueReading!({ ...reading, readingId: "another-reading" }),
    ).resolves.toBe("sent");
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("returns unsupported after updating available context and allows a later supported request", async () => {
    const capabilities: Record<string, unknown> = {
      updateModelContext: { structuredContent: {} },
    };
    const { app, updateModelContext, sendMessage } =
      createFakeApp(capabilities);
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);

    await expect(client.continueReading!(reading)).resolves.toBe("unsupported");
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).not.toHaveBeenCalled();
    capabilities.message = { text: {} };
    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("does not invoke absent host capabilities", async () => {
    const { app, updateModelContext, sendMessage } = createFakeApp(undefined);
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);

    await expect(client.continueReading!(reading)).resolves.toBe("unsupported");
    expect(updateModelContext).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("uses the ChatGPT follow-up capability when standard messages are absent, only on explicit request", async () => {
    const { app, callServerTool, updateModelContext, sendMessage } =
      createFakeApp({
        updateModelContext: { text: {} },
      });
    const bridge = {
      sendFollowUpMessage: vi.fn(
        async (_args: { prompt: string }) => undefined,
      ),
    };
    vi.stubGlobal("openai", bridge);
    updateModelContext.mockRejectedValueOnce(new Error("Context unavailable"));
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    expect(bridge.sendFollowUpMessage).not.toHaveBeenCalled();
    Object.assign(reading, {
      selectedSlotIds: ["opaque-private"],
      token: "private-token",
      deckBackImageUri: "data:image/webp;base64,private-back",
    });
    await expect(
      Promise.all([
        client.continueReading!(reading),
        client.continueReading!({ ...reading }),
      ]),
    ).resolves.toEqual(["sent", "sent"]);
    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(bridge.sendFollowUpMessage).toHaveBeenCalledOnce();
    expect(bridge.sendFollowUpMessage.mock.contexts[0]).toBe(bridge);
    const prompt = bridge.sendFollowUpMessage.mock.calls[0][0].prompt;
    expect(prompt).toContain("Past — The Fool (upright)");
    expect(prompt).toContain("Present — The World (reversed)");
    expect(prompt).toContain("What should I understand?");
    expect(prompt).not.toMatch(/opaque-private|private-token|base64|imageUri/);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(callServerTool).toHaveBeenCalledOnce();
  });

  it("prefers standard messages and never switches bridges after a rejected send", async () => {
    const { app, callServerTool, sendMessage } = createFakeApp({
      message: { text: {} },
    });
    const sendFollowUpMessage = vi.fn(async () => undefined);
    vi.stubGlobal("openai", { sendFollowUpMessage });
    sendMessage.mockResolvedValueOnce({ isError: true });
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    await expect(client.continueReading!(reading)).rejects.toThrow(
      "The host rejected the interpretation request.",
    );
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
    expect(callServerTool).toHaveBeenCalledOnce();
  });

  it("allows an explicit retry after ChatGPT rejects a follow-up without reconfirming cards", async () => {
    const { app, callServerTool, sendMessage } = createFakeApp(undefined);
    const rejection = new Error("Host permission denied");
    const sendFollowUpMessage = vi
      .fn(async (_args: { prompt: string }) => undefined)
      .mockRejectedValueOnce(rejection);
    vi.stubGlobal("openai", { sendFollowUpMessage });
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    const failed = await Promise.allSettled([
      client.continueReading!(reading),
      client.continueReading!(reading),
    ]);
    expect(failed).toEqual([
      { status: "rejected", reason: rejection },
      { status: "rejected", reason: rejection },
    ]);
    expect(sendFollowUpMessage).toHaveBeenCalledOnce();
    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(sendFollowUpMessage).toHaveBeenCalledTimes(2);
    expect(sendFollowUpMessage.mock.calls[1][0]).toEqual(
      sendFollowUpMessage.mock.calls[0][0],
    );
    expect(sendMessage).not.toHaveBeenCalled();
    expect(callServerTool).toHaveBeenCalledOnce();
  });

  it("bounds a stalled ChatGPT follow-up and does not confuse late completion with acknowledged delivery", async () => {
    vi.useFakeTimers();
    try {
      const { app, callServerTool, sendMessage } = createFakeApp(undefined);
      let complete!: () => void;
      const sendFollowUpMessage = vi
        .fn<(_: { prompt: string }) => Promise<void>>()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              complete = resolve;
            }),
        )
        .mockResolvedValue(undefined);
      vi.stubGlobal("openai", { sendFollowUpMessage });
      const client = createMcpClient(app);
      const reading = await client.confirmReading("draw_confirmed", [
        "slot-1",
        "slot-2",
      ]);
      const pending = client.continueReading!(reading);
      const timeout = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(10_000);
      await timeout;
      complete();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sendFollowUpMessage).toHaveBeenCalledOnce();
      await expect(client.continueReading!(reading)).resolves.toBe("sent");
      await expect(client.continueReading!(reading)).resolves.toBe("sent");
      expect(sendFollowUpMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).not.toHaveBeenCalled();
      expect(callServerTool).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the full semantic follow-up when context updating fails", async () => {
    const { app, updateModelContext, sendMessage } = createFakeApp({
      updateModelContext: { text: {} },
      message: { text: {} },
    });
    updateModelContext.mockRejectedValueOnce(new Error("unsupported context"));
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);

    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    const text = sendMessage.mock.calls[0]![0].content[0]!.text;
    expect(text).toContain("What should I understand?");
    expect(text).toContain("Past — The Fool (upright)");
    expect(text).toContain("beginnings, trust — A new path is opening.");
    expect(text).toContain("Present — The World (reversed)");
    expect(text).toContain("completion — One final step remains.");
  });

  it.each(["rejection", "isError"] as const)(
    "exposes a host %s and permits an explicit retry without confirming again",
    async (failure) => {
      const { app, callServerTool, sendMessage } = createFakeApp({
        message: { text: {} },
      });
      if (failure === "rejection") {
        sendMessage.mockRejectedValueOnce(
          new Error("host closed the composer"),
        );
      } else {
        sendMessage.mockResolvedValueOnce({ isError: true });
      }
      const client = createMcpClient(app);
      const reading = await client.confirmReading("draw_confirmed", [
        "slot-1",
        "slot-2",
      ]);
      const first = client.continueReading!(reading);
      const concurrent = client.continueReading!({ ...reading });
      const results = await Promise.allSettled([first, concurrent]);
      const error = new Error(
        failure === "rejection"
          ? "host closed the composer"
          : "The host rejected the interpretation request.",
      );
      expect(results).toEqual([
        { status: "rejected", reason: error },
        { status: "rejected", reason: error },
      ]);
      expect(sendMessage).toHaveBeenCalledOnce();

      await expect(client.continueReading!(reading)).resolves.toBe("sent");
      await expect(client.continueReading!(reading)).resolves.toBe("sent");
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(callServerTool).toHaveBeenCalledOnce();
    },
  );

  it("surfaces the bridge timeout and waits for an explicit retry", async () => {
    vi.useFakeTimers();
    try {
      const { app, callServerTool, sendMessage } = createFakeApp({
        message: { text: {} },
      });
      sendMessage.mockImplementationOnce(
        (_params, options) =>
          new Promise((_resolve, reject) => {
            setTimeout(
              () => reject(new Error("Request timed out")),
              options?.timeout,
            );
          }),
      );
      const client = createMcpClient(app);
      const reading = await client.confirmReading("draw_confirmed", [
        "slot-1",
        "slot-2",
      ]);
      let settled = false;
      const continuation = client.continueReading!(reading).finally(() => {
        settled = true;
      });
      const rejection =
        expect(continuation).rejects.toThrow("Request timed out");
      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sendMessage).toHaveBeenCalledOnce();

      await expect(client.continueReading!(reading)).resolves.toBe("sent");
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(callServerTool).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the confirmed result for existing and new subscribers after pending replay", async () => {
    const { app } = createFakeApp(undefined);
    const client = createMcpClient(app);
    const first = { onBegin: vi.fn(), onConfirmed: vi.fn(), onError: vi.fn() };
    client.subscribeInitial!(first);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    const replay = beginToolResult();
    replay.structuredContent.drawId = "draw_confirmed";
    replay.structuredContent.requiredCount = 2;
    await app.ontoolresult!(replay);
    expect(first.onConfirmed).toHaveBeenLastCalledWith(reading);
    expect(first.onBegin).not.toHaveBeenCalled();
    const second = { onBegin: vi.fn(), onConfirmed: vi.fn(), onError: vi.fn() };
    client.subscribeInitial!(second);
    expect(second.onConfirmed).toHaveBeenCalledWith(reading);
    expect(second.onBegin).not.toHaveBeenCalled();
    await app.ontoolresult!(beginToolResult());
    expect(second.onBegin).toHaveBeenCalledWith(
      expect.objectContaining({ drawId: "draw_pending" }),
    );
  });

  it("writes only private whitelisted state and refuses snapshots before authority or for foreign draws", async () => {
    const bridge = installWidgetState();
    const { app, sendMessage, updateModelContext } = createFakeApp({
      message: { text: {} },
    });
    const client = createMcpClient(app);
    const source = createMcpClient(createFakeApp(undefined).app);
    const reading = await source.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    const saved = checkpoint(reading);
    client.writeUiState!(saved);
    expect(bridge.widgetState).toBeUndefined();
    await app.ontoolresult!(confirmedToolResult());
    Object.assign(saved, { token: "private-token" });
    Object.assign(reading, {
      token: "private-token",
      deckBackImageUri: "private-back",
    });
    Object.assign(reading.cards[0]!, {
      embeddedImage: { mimeType: "image/webp", data: "private-art" },
      slotId: "hidden-slot",
    });
    client.writeUiState!(saved);
    expect(bridge.widgetState?.modelContent).toEqual({});
    expect(client.readUiState!()).toMatchObject({
      drawId: "draw_confirmed",
      revealedIndices: [0, 1],
    });
    expect(JSON.stringify(bridge.widgetState)).not.toMatch(
      /private-token|private-back|private-art|hidden-slot|imageUri|embeddedImage/,
    );
    client.writeUiState!({ ...saved, drawId: "foreign-draw" });
    expect(bridge.setWidgetState).toHaveBeenCalledOnce();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(updateModelContext).not.toHaveBeenCalled();
  });

  it("keeps normal in-memory continuation available without widget-state support", async () => {
    vi.stubGlobal("openai", {});
    const { app, sendMessage } = createFakeApp({ message: { text: {} } });
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    client.writeUiState!(checkpoint(reading));
    expect(client.readUiState!()).toBeUndefined();
    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("records only acknowledged delivery and deduplicates it after a client remount", async () => {
    const bridge = installWidgetState();
    const { app, sendMessage } = createFakeApp({ message: { text: {} } });
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    client.writeUiState!(checkpoint(reading));
    sendMessage.mockResolvedValueOnce({ isError: true });
    await expect(client.continueReading!(reading)).rejects.toThrow("rejected");
    expect(bridge.widgetState?.privateContent.tarot.continuationSent).toBe(
      false,
    );
    let accept!: (result: { isError?: boolean }) => void;
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
    const pending = client.continueReading!(reading);
    expect(bridge.widgetState?.privateContent.tarot.continuationSent).toBe(
      false,
    );
    accept({});
    await expect(pending).resolves.toBe("sent");
    expect(bridge.widgetState?.privateContent.tarot.continuationSent).toBe(
      true,
    );

    const remount = createFakeApp({ message: { text: {} } });
    const remountedClient = createMcpClient(remount.app);
    const replay = beginToolResult();
    replay.structuredContent.drawId = "draw_confirmed";
    replay.structuredContent.requiredCount = 2;
    await remount.app.ontoolresult!(replay);
    expect(remount.sendMessage).not.toHaveBeenCalled();
    await expect(remountedClient.continueReading!(reading)).resolves.toBe(
      "sent",
    );
    expect(remount.sendMessage).not.toHaveBeenCalled();
    expect(remount.callServerTool).not.toHaveBeenCalled();
  });

  it("does not let late continuation acknowledgement overwrite a newer draw checkpoint", async () => {
    const bridge = installWidgetState();
    const { app, sendMessage } = createFakeApp({ message: { text: {} } });
    const client = createMcpClient(app);
    const reading = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    client.writeUiState!(checkpoint(reading));
    let accept!: (result: { isError?: boolean }) => void;
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
    const pending = client.continueReading!(reading);
    await app.ontoolresult!(beginToolResult());
    const newer: TarotUiSnapshot = {
      version: 1,
      drawId: "draw_pending",
      deckOrder: checkpoint(reading).deckOrder,
      selectedSlotIds: [],
      revealedIndices: [],
      continuationSent: false,
    };
    client.writeUiState!(newer);
    accept({});
    await pending;
    expect(bridge.widgetState?.privateContent.tarot).toEqual(newer);
  });

  it("does not suppress an explicit request using another reading's saved acknowledgement", async () => {
    const bridge = installWidgetState();
    const first = createFakeApp({ message: { text: {} } });
    const firstClient = createMcpClient(first.app);
    const reading = await firstClient.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    firstClient.writeUiState!({
      ...checkpoint(reading),
      continuationSent: true,
    });
    bridge.widgetState!.privateContent.tarot.confirmedReading!.readingId =
      "another-reading";
    const remount = createFakeApp({ message: { text: {} } });
    const client = createMcpClient(remount.app);
    await remount.app.ontoolresult!(confirmedToolResult());
    expect(remount.sendMessage).not.toHaveBeenCalled();
    await expect(client.continueReading!(reading)).resolves.toBe("sent");
    expect(remount.sendMessage).toHaveBeenCalledOnce();
    expect(
      bridge.widgetState!.privateContent.tarot.confirmedReading!.readingId,
    ).toBe("another-reading");
  });
});
