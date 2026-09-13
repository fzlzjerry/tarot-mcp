import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ListToolsResultSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { VisualBrowserFallback } from "../mcp/browser-handoff.js";
import { createMcpProtocolServer } from "../mcp/protocol-server.js";
import { TOOL_NAMES } from "../mcp/public-api.js";
import { TarotServer, type ToolResult } from "../mcp/tarot-service.js";
import type { VisualBeginPayload } from "../tarot/readings/visual-draw-manager.js";

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("MCP protocol server error contract", () => {
  let client: Client;

  beforeAll(async () => {
    const tarotServer = await TarotServer.create();
    const server = createMcpProtocolServer(tarotServer);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    client = new Client({ name: "jest", version: "1.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  it("keeps an expired or missing deck distinguishable from retryable transport failures", async () => {
    const result = await client.callTool({
      name: "confirm_visual_reading",
      arguments: {
        drawId: "draw_missing",
        selectedSlotIds: ["opaque-1"],
      },
    });
    expect(result.isError).toBe(true);
    expect(result._meta).toMatchObject({
      tarotError: { code: "DRAW_NOT_FOUND", httpStatus: 404 },
    });
  });

  it("marks invalid reading inputs as failed executions", async () => {
    const result = await client.callTool({
      name: "perform_reading",
      arguments: { spreadType: "not_a_spread", question: "Hi?" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it("marks unknown session errors from the domain layer with isError", async () => {
    const result = await client.callTool({
      name: "perform_reading",
      arguments: {
        spreadType: "single_card",
        question: "Hi?",
        sessionId: "session_does_not_exist",
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it.each(["", "   ", "new", "fresh-reading-label"])(
    "treats model-generated sessionId %j as a request for a new session",
    async (sessionId) => {
      const result = await client.callTool({
        name: "perform_reading",
        arguments: {
          spreadType: "single_card",
          question: "Start a compatible session?",
          sessionId,
        },
      });

      expect(result.isError).toBeUndefined();
      const structured = result.structuredContent as { sessionId: string };
      expect(structured.sessionId).toMatch(/^session_/);
    },
  );

  it("returns structuredContent for readings that matches the declared shape", async () => {
    const result = await client.callTool({
      name: "perform_reading",
      arguments: { spreadType: "three_card", question: "Structured?" },
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      readingId: string;
      sessionId?: string;
      spreadType: string;
      spreadName: string;
      question: string;
      timestamp: string;
      cards: Array<{ name: string; orientation: string; position?: string }>;
    };

    expect(structured).toBeDefined();
    expect(structured.readingId).toMatch(/^reading_/);
    expect(structured.sessionId).toMatch(/^session_/);
    expect(structured.spreadType).toBe("three_card");
    expect(structured.question).toBe("Structured?");
    expect(new Date(structured.timestamp).getTime()).not.toBeNaN();
    expect(structured.cards).toHaveLength(3);
    for (const card of structured.cards) {
      expect(card.name).toBeTruthy();
      expect(["upright", "reversed"]).toContain(card.orientation);
      expect(card.position).toBeTruthy();
      expect(card).not.toHaveProperty("imageUri");
      expect(card).not.toHaveProperty("embeddedImage");
    }
  });

  it("returns structured session history", async () => {
    const reading = await client.callTool({
      name: "perform_reading",
      arguments: { spreadType: "single_card", question: "History?" },
    });
    const { sessionId } = reading.structuredContent as { sessionId: string };

    const history = await client.callTool({
      name: "get_session_history",
      arguments: { sessionId },
    });

    const structured = history.structuredContent as {
      sessionId: string;
      readingCount: number;
      storedReadings: Array<{ question: string }>;
    };
    expect(structured.sessionId).toBe(sessionId);
    expect(structured.readingCount).toBe(1);
    expect(structured.storedReadings[0].question).toBe("History?");
  });

  it("returns opaque deck slots without attaching artwork to tool results", async () => {
    const begin = await client.callTool({
      name: "begin_visual_reading",
      arguments: {
        readingKind: "spread",
        spreadType: "three_card",
        question: "Which direction should I take?",
        language: "en",
      },
    });

    expect(begin.isError).toBeUndefined();
    const prepared = begin.structuredContent as Record<string, unknown>;
    expect(prepared.drawId).toMatch(/^draw_/);
    expect(prepared.requiredCount).toBe(3);
    expect(prepared).not.toHaveProperty("slots");
    expect(prepared).not.toHaveProperty("deck");

    const beginMeta = (
      begin as unknown as {
        _meta: {
          visualDeck: {
            slots: Array<{ slotId: string; order: number }>;
          };
        };
      }
    )._meta;
    expect(beginMeta.visualDeck.slots).toHaveLength(78);
    expect(beginMeta.visualDeck.slots[0]).toEqual({
      slotId: expect.stringMatching(/^slot_/),
      order: 0,
    });
    expect(beginMeta.visualDeck).not.toHaveProperty("backImage");
    expect(JSON.stringify(begin)).not.toContain("data:image");

    const selectedSlotIds = beginMeta.visualDeck.slots
      .slice(0, 3)
      .map((slot) => slot.slotId);
    const confirm = await client.callTool({
      name: "confirm_visual_reading",
      arguments: { drawId: prepared.drawId, selectedSlotIds },
    });

    expect(confirm.isError).toBeUndefined();
    const reading = confirm.structuredContent as {
      drawId: string;
      cards: Array<{ cardId: string; imageUri?: string }>;
    };
    expect(reading.drawId).toBe(prepared.drawId);
    expect(reading.cards).toHaveLength(3);
    for (const card of reading.cards) {
      expect(card).not.toHaveProperty("imageUri");
      expect(card).not.toHaveProperty("embeddedImage");
    }
    expect(confirm).not.toHaveProperty("_meta");
    expect(JSON.stringify(confirm)).not.toContain("data:image");
    expect(JSON.stringify(confirm)).not.toContain("cardImages");
    expect(JSON.stringify(confirm)).not.toContain("backImage");
  });

  it("returns a browser-confirmed reading from the original pending tool call", async () => {
    const tarotServer = await TarotServer.create();
    const completion = deferred<Extract<ToolResult, { ok: true }>>();
    let privateDraw: VisualBeginPayload | undefined;
    let waiterSignal: AbortSignal | undefined;
    const handoffUrl =
      "http://127.0.0.1:48123/draw/#handoff=protocol-test-token";
    const fallback: VisualBrowserFallback = {
      force: false,
      open: vi.fn(async (draw) => {
        privateDraw = draw;
        return { url: handoffUrl, opened: false, reused: false };
      }),
      waitForConfirmation: vi.fn((drawId, options) => {
        expect(drawId).toBe(privateDraw?.drawId);
        waiterSignal = options?.signal;
        return completion.promise;
      }),
      stop: vi.fn(async () => undefined),
    };
    const server = createMcpProtocolServer(tarotServer, {
      visualBrowserFallback: fallback,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const fallbackClient = new Client({
      name: "pending-browser-protocol-test",
      version: "1.0.0",
    });

    try {
      await Promise.all([
        server.connect(serverTransport),
        fallbackClient.connect(clientTransport),
      ]);
      // Populate the SDK client's output validator cache. This makes the test
      // exercise the advertised pending|confirmed oneOf schema, not only the
      // raw protocol payload.
      await fallbackClient.listTools();
      const progressMessages: string[] = [];
      let settled = false;
      const beginPromise = fallbackClient.callTool(
        {
          name: TOOL_NAMES.beginVisualReading,
          arguments: {
            readingKind: "spread",
            spreadType: "single_card",
            question: "Will this result return to the assistant?",
            language: "en",
          },
        },
        undefined,
        {
          timeout: 5_000,
          resetTimeoutOnProgress: true,
          onprogress: ({ message }) => {
            if (message) progressMessages.push(message);
          },
        },
      );
      beginPromise.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );

      await vi.waitFor(() => {
        expect(fallback.open).toHaveBeenCalledTimes(1);
        expect(fallback.waitForConfirmation).toHaveBeenCalledTimes(1);
        expect(progressMessages.join("\n")).toContain(handoffUrl);
      });
      expect(settled).toBe(false);
      expect(privateDraw?.slots).toHaveLength(78);
      expect(waiterSignal?.aborted).toBe(false);

      const selectedSlotId = privateDraw!.slots[0].slotId;
      const confirmed = await tarotServer.executeTool(
        TOOL_NAMES.confirmVisualReading,
        {
          drawId: privateDraw!.drawId,
          selectedSlotIds: [selectedSlotId],
        },
      );
      if (!confirmed.ok) throw new Error(confirmed.error);
      completion.resolve(confirmed);

      const result = await beginPromise;
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toMatchObject({
        readingId: (confirmed.structured as { readingId: string }).readingId,
        drawId: privateDraw!.drawId,
        status: "confirmed",
        cards: expect.arrayContaining([expect.any(Object)]),
      });
      expect(result._meta).toMatchObject({
        browserFallback: { opened: false, reused: false, completed: true },
      });
      expect(result._meta).not.toHaveProperty("cardImages");
      expect(result._meta).not.toHaveProperty("backImage");
      expect(JSON.stringify(result)).not.toContain("data:image");
      expect(JSON.stringify(result)).not.toContain("imageUri");
    } finally {
      await fallbackClient.close();
      await server.close();
    }
  });

  it("exposes card and spread catalogs as resources", async () => {
    const resources = await client.listResources();
    const uris = resources.resources.map((resource) => resource.uri);
    expect(uris).toContain("tarot://cards");
    expect(uris).toContain("tarot://spreads");

    const cards = await client.readResource({ uri: "tarot://cards" });
    const cardsJson = JSON.parse((cards.contents[0] as { text: string }).text);
    expect(cardsJson.cards).toHaveLength(78);

    const fool = await client.readResource({
      uri: `tarot://cards/${encodeURIComponent("The Fool")}`,
    });
    const foolJson = JSON.parse((fool.contents[0] as { text: string }).text);
    expect(foolJson.name).toBe("The Fool");
    expect(foolJson.meanings.upright.general).toBeTruthy();

    const spread = await client.readResource({
      uri: "tarot://spreads/celtic_cross",
    });
    const spreadJson = JSON.parse(
      (spread.contents[0] as { text: string }).text,
    );
    expect(spreadJson.positions).toHaveLength(10);

    await expect(
      client.readResource({ uri: "tarot://cards/not_a_card" }),
    ).rejects.toThrow();
  });

  it("exposes reading workflows as prompts", async () => {
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining(["perform-reading", "daily-draw"]),
    );

    const prompt = await client.getPrompt({
      name: "perform-reading",
      arguments: { question: "What next?", spreadType: "three_card" },
    });
    const text = (prompt.messages[0].content as { text: string }).text;
    expect(text).toContain('"What next?"');
    expect(text).toContain('"three_card"');
    expect(text).toContain("perform_reading");
  });

  it("advertises all tools with explicit authorization and honest safety semantics", async () => {
    // SDK 1.30 strips nonstandard Tool fields; preserve OpenAI's securitySchemes
    // extension when consuming the actual tools/list response.
    const { tools } = await client.request(
      { method: "tools/list" },
      ListToolsResultSchema.extend({ tools: ToolSchema.passthrough().array() }),
    );
    const expected = [
      [TOOL_NAMES.getCardInfo, "Get card information", true, true],
      [TOOL_NAMES.listAllCards, "List tarot cards", true, true],
      [TOOL_NAMES.listAvailableSpreads, "List tarot spreads", true, true],
      [TOOL_NAMES.performReading, "Perform a tarot reading", false, false],
      [
        TOOL_NAMES.beginVisualReading,
        "Begin a visual tarot ritual",
        false,
        false,
      ],
      [TOOL_NAMES.confirmVisualReading, "Confirm selected cards", false, true],
      [TOOL_NAMES.searchCards, "Search tarot cards", true, true],
      [TOOL_NAMES.findSimilarCards, "Find similar cards", true, true],
      [TOOL_NAMES.getDatabaseAnalytics, "Explore deck statistics", true, true],
      [TOOL_NAMES.getRandomCards, "Draw random cards", true, false],
      [TOOL_NAMES.getDailyCard, "Draw daily guidance", true, false],
      [TOOL_NAMES.recommendSpread, "Recommend a spread", true, true],
      [TOOL_NAMES.getMoonPhaseReading, "Read the moon phase", true, false],
      [
        TOOL_NAMES.getCardMeaningsComparison,
        "Compare card meanings",
        true,
        true,
      ],
      [TOOL_NAMES.createCustomSpread, "Create a custom reading", false, false],
      [TOOL_NAMES.getSessionHistory, "View reading history", true, true],
    ] as const;
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      expected.map(([name]) => name).sort(),
    );
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    for (const [name, title, readOnlyHint, idempotentHint] of expected) {
      const tool = byName.get(name)!;
      expect(tool.title).toBe(title);
      expect(tool.annotations).toMatchObject({
        readOnlyHint,
        idempotentHint,
        destructiveHint: false,
        openWorldHint: false,
      });
      expect(tool.securitySchemes).toEqual([{ type: "noauth" }]);
      expect(tool._meta ?? {}).not.toHaveProperty("securitySchemes");
    }
  });

  it("opens a readable UI only for begin and keeps confirmation app-only", async () => {
    const { tools } = await client.listTools();
    const templates = tools.flatMap((tool) => {
      const ui = tool._meta?.ui;
      if (
        ui &&
        typeof ui === "object" &&
        "resourceUri" in ui &&
        typeof ui.resourceUri === "string"
      ) {
        return [{ tool, resourceUri: ui.resourceUri }];
      }
      return [];
    });
    expect(templates.map(({ tool }) => tool.name)).toEqual([
      TOOL_NAMES.beginVisualReading,
    ]);
    const { tool: begin, resourceUri } = templates[0];
    expect(begin._meta?.ui).toEqual({
      resourceUri: "ui://tarot-mcp/visual-reading.html",
      visibility: ["model", "app"],
    });
    const confirm = tools.find(
      (tool) => tool.name === TOOL_NAMES.confirmVisualReading,
    )!;
    expect(confirm._meta?.ui).toEqual({ visibility: ["app"] });
    for (const tool of tools) {
      const meta = tool._meta ?? {};
      expect(meta).not.toHaveProperty("ui/resourceUri");
      expect(meta).not.toHaveProperty("openai/outputTemplate");
      expect(meta).not.toHaveProperty("openai/widgetAccessible");
    }

    const { resources } = await client.listResources();
    const visualApp = resources.find(
      (resource) => resource.uri === resourceUri,
    );
    expect(visualApp?.mimeType).toBe("text/html;profile=mcp-app");
    expect(visualApp?._meta).toMatchObject({
      ui: {
        prefersBorder: false,
        csp: {
          connectDomains: [],
          resourceDomains: [],
          frameDomains: [],
          baseUriDomains: [],
        },
      },
    });
    const resource = await client.readResource({ uri: resourceUri });
    expect(resource.contents).toHaveLength(1);
    expect(resource.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    const content = resource.contents[0];
    if (!("text" in content) || typeof content.text !== "string") {
      throw new Error("The UI resource must contain HTML text.");
    }
    const html = content.text;
    expect(html).toMatch(/<div\s+id=["']root["']/);
    expect(html).toContain("data:image/webp;base64,");
    expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(html).not.toMatch(/<link\b[^>]*\brel=["']stylesheet["']/i);
  });

  it("marks unexpected execution failures with isError", async () => {
    const result = await client.callTool({
      name: "get_random_cards",
      arguments: { count: 30, arcana: "major" },
    });

    // Only 22 Major Arcana exist; drawing 30 throws inside the search
    // layer, which the transport reports as an execution failure.
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });
});
