#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TarotServer } from "./mcp/tarot-service.js";
import { TarotHttpServer } from "./mcp/http-server.js";
import { createMcpProtocolServer } from "./mcp/protocol-server.js";

const VALID_TRANSPORTS = ["stdio", "http", "sse"] as const;
type Transport = (typeof VALID_TRANSPORTS)[number];

function parsePort(value: string, source: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(
      `Invalid ${source} value "${value}": expected an integer between 1 and 65535.`,
    );
    process.exit(1);
  }
  return port;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { transport: Transport; port: number } {
  const args = process.argv.slice(2);
  let transport: Transport = "stdio";
  let port: number | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--transport": {
        const value = args[i + 1];
        if (!value || !VALID_TRANSPORTS.includes(value as Transport)) {
          console.error(
            `Invalid --transport value "${value ?? ""}": expected one of ${VALID_TRANSPORTS.join(", ")}.`,
          );
          process.exit(1);
        }
        transport = value as Transport;
        i++;
        break;
      }
      case "--port":
        port = parsePort(args[i + 1] ?? "", "--port");
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`
Tarot MCP Server

Usage: node dist/index.js [options]

Options:
  --transport <type>    Transport type: stdio, http, sse (default: stdio)
  --port <number>       Port for HTTP/SSE transport (default: $PORT or 3000)
  --help, -h           Show this help message

Examples:
  node dist/index.js                           # Run with stdio transport
  node dist/index.js --transport http          # Run HTTP server on port 3000
  node dist/index.js --transport http --port 8080  # Run HTTP server on port 8080
        `);
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument "${args[i]}". Use --help for usage.`);
        process.exit(1);
    }
  }

  // The PORT env var only matters when an HTTP listener will actually start
  // and no explicit --port was given; stdio launches must ignore it.
  if (port === undefined) {
    port =
      transport !== "stdio" && process.env.PORT
        ? parsePort(process.env.PORT, "PORT")
        : 3000;
  }

  return { transport, port };
}

let runningHttpServer: TarotHttpServer | undefined;

/**
 * Main entry point for the Tarot MCP Server
 */
async function main() {
  const { transport, port } = parseArgs();

  console.error(`Starting Tarot MCP Server with ${transport} transport...`);

  // Asynchronously initialize the TarotServer
  const tarotServer = await TarotServer.create();
  console.error("Tarot card data loaded successfully.");

  if (transport === "http" || transport === "sse") {
    // Start HTTP server with the initialized TarotServer
    runningHttpServer = new TarotHttpServer(tarotServer, port);
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
