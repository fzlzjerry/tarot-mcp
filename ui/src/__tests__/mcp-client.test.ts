import type { App } from "@modelcontextprotocol/ext-apps";
import { vi } from "vitest";
import { createMcpClient } from "../mcp-client.js";

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
    async (_params: MessagePayload, _options?: { timeout?: number }) => ({}),
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

describe("embedded MCP App host continuation", () => {
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

  it("updates model context, then sends a user message after confirmation", async () => {
    const { app, updateModelContext, sendMessage } = createFakeApp({
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
      drawId: "draw_confirmed",
      cards: [
        { id: "fool", orientation: "upright" },
        { id: "world", orientation: "reversed" },
      ],
    });
    await vi.waitFor(() => {
      expect(updateModelContext).toHaveBeenCalledOnce();
      expect(sendMessage).toHaveBeenCalledOnce();
    });
    expect(updateModelContext.mock.invocationCallOrder[0]).toBeLessThan(
      sendMessage.mock.invocationCallOrder[0],
    );

    const context = updateModelContext.mock.calls[0]![0];
    expect(context.content![0]!.text).toContain("The Fool (upright)");
    expect(context.content![0]!.text).toContain("The World (reversed)");
    expect(context.structuredContent).toMatchObject({
      tarotVisualReading: {
        status: "confirmed",
        readingId: "reading_confirmed",
        question: "What should I understand?",
        cards: [
          {
            id: "fool",
            position: "Past",
            keywords: ["beginnings", "trust"],
          },
          { id: "world", orientation: "reversed" },
        ],
      },
    });
    expect(JSON.stringify(context.structuredContent)).not.toContain("imageUri");
    expect(JSON.stringify(context.structuredContent)).not.toContain("data:image");

    expect(sendMessage).toHaveBeenCalledWith(
      {
        role: "user",
        content: [
          {
            type: "text",
            text: expect.stringContaining("without drawing again"),
          },
        ],
      },
      { timeout: 10_000 },
    );
  });

  it("uses the follow-up message even when the context update is rejected", async () => {
    const { app, updateModelContext, sendMessage } = createFakeApp({
      updateModelContext: { text: {} },
      message: { text: {} },
    });
    updateModelContext.mockRejectedValueOnce(new Error("unsupported context"));
    sendMessage.mockRejectedValueOnce(new Error("host closed the composer"));
    const client = createMcpClient(app);

    await expect(
      client.confirmReading("draw_confirmed", ["slot-1", "slot-2"]),
    ).resolves.toMatchObject({ readingId: "reading_confirmed" });

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    expect(sendMessage.mock.calls[0]![0].content[0]!.text).toContain(
      "A new path is opening.",
    );
  });

  it("skips unsupported host methods and deduplicates a confirmed reading", async () => {
    const { app, updateModelContext, sendMessage } = createFakeApp({});
    const client = createMcpClient(app);

    const first = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);
    const second = await client.confirmReading("draw_confirmed", [
      "slot-1",
      "slot-2",
    ]);

    expect(first.readingId).toBe("reading_confirmed");
    expect(second.readingId).toBe("reading_confirmed");
    await Promise.resolve();
    expect(updateModelContext).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends only one follow-up for an idempotent confirmation retry", async () => {
    const { app, updateModelContext, sendMessage } = createFakeApp({
      updateModelContext: { structuredContent: {} },
      message: { text: {} },
    });
    const client = createMcpClient(app);

    await client.confirmReading("draw_confirmed", ["slot-1", "slot-2"]);
    await client.confirmReading("draw_confirmed", ["slot-1", "slot-2"]);

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(updateModelContext.mock.calls[0]![0]).not.toHaveProperty("content");
    expect(updateModelContext.mock.calls[0]![0]).toHaveProperty(
      "structuredContent",
    );
  });
});
