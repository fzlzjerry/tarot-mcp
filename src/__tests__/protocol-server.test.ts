import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpProtocolServer } from "../mcp/protocol-server.js";
import { TarotServer } from "../mcp/tarot-service.js";

interface TextContent {
  type: string;
  text: string;
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

  it("marks failed executions with isError and keeps the Error: text", async () => {
    const result = await client.callTool({
      name: "perform_reading",
      arguments: { spreadType: "not_a_spread", question: "Hi?" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as TextContent[];
    expect(content[0].text).toContain("Error: Invalid spreadType");
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
    const content = result.content as TextContent[];
    expect(content[0].text).toContain(
      'Error: Session "session_does_not_exist" not found',
    );
  });

  it("does not set isError on successful calls", async () => {
    const result = await client.callTool({
      name: "perform_reading",
      arguments: { spreadType: "single_card", question: "What today?" },
    });

    expect(result.isError).toBeUndefined();
    const content = result.content as TextContent[];
    expect(content[0].text).toContain("# Single Card Reading");
  });

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

  it("marks unexpected execution failures with isError", async () => {
    const result = await client.callTool({
      name: "get_random_cards",
      arguments: { count: 30, arcana: "major" },
    });

    // Only 22 Major Arcana exist; drawing 30 throws inside the search
    // layer, which the transport reports as an execution failure.
    expect(result.isError).toBe(true);
    const content = result.content as TextContent[];
    expect(content[0].text).toContain("Error executing tool get_random_cards");
  });
});
