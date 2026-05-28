import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_SERVER_INFO } from "./public-api.js";
import { TarotServer } from "./tarot-service.js";

/**
 * Create a fresh MCP protocol server wired to the tarot domain service.
 *
 * Each transport session gets its own Server instance. This avoids sharing
 * request/response state across stdio, Streamable HTTP, and legacy SSE clients.
 */
export function createMcpProtocolServer(tarotServer: TarotServer): Server {
  const server = new Server(MCP_SERVER_INFO, {
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tarotServer.getAvailableTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await tarotServer.executeTool(name, args || {});
      return {
        content: [
          {
            type: "text",
            text: result,
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
