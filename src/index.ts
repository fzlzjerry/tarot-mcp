#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TarotServer } from "./mcp/tarot-service.js";
import { TarotHttpServer } from "./mcp/http-server.js";
import { createMcpProtocolServer } from "./mcp/protocol-server.js";
import { CliOptions, CliUsageError, HELP_TEXT, parseArgs } from "./mcp/args.js";

let runningHttpServer: TarotHttpServer | undefined;

/**
 * Main entry point for the Tarot MCP Server
 */
async function main() {
  let options: CliOptions;
  try {
    const parsed = parseArgs(process.argv.slice(2), process.env);
    if (parsed === "help") {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    options = parsed;
  } catch (error) {
    if (error instanceof CliUsageError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const { transport, port, host } = options;

  console.error(`Starting Tarot MCP Server with ${transport} transport...`);

  // Asynchronously initialize the TarotServer
  const tarotServer = await TarotServer.create();
  console.error("Tarot card data loaded successfully.");

  if (transport === "http" || transport === "sse") {
    // Start HTTP server with the initialized TarotServer
    runningHttpServer = new TarotHttpServer(tarotServer, port, host);
    await runningHttpServer.start();
  } else {
    // Start stdio server with the initialized TarotServer
    await startStdioServer(tarotServer);
  }
}

/**
 * Start the stdio-based MCP server
 */
async function startStdioServer(tarotServer: TarotServer) {
  const server = createMcpProtocolServer(tarotServer);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Tarot MCP Server running on stdio");
}

// Handle graceful shutdown: close active MCP sessions and the HTTP listener
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.error(`Received ${signal}, shutting down Tarot MCP Server...`);
  try {
    await runningHttpServer?.stop();
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Start the server
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
