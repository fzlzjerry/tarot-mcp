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
