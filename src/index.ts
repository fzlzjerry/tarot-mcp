#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TarotServer } from "./mcp/tarot-service.js";
import { TarotHttpServer } from "./mcp/http-server.js";
import { createMcpProtocolServer } from "./mcp/protocol-server.js";
import { CliOptions, CliUsageError, HELP_TEXT, parseArgs } from "./mcp/args.js";
import { logger } from "./tarot/shared/logger.js";

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

  logger.info("server_starting", { transport });

  // Asynchronously initialize the TarotServer
  const tarotServer = await TarotServer.create();
  logger.info("card_data_loaded");

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

  logger.info("stdio_server_started");
}

// Handle graceful shutdown: close active MCP sessions and the HTTP listener
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("shutdown_requested", { signal });
  try {
    await runningHttpServer?.stop();
  } catch (error) {
    logger.error("shutdown_error", { error: String(error) });
    process.exit(1);
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Start the server
main().catch((error) => {
  logger.error("fatal_error", { error: String(error) });
  process.exit(1);
});
