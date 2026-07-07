export const VALID_TRANSPORTS = ["stdio", "http", "sse"] as const;
export type Transport = (typeof VALID_TRANSPORTS)[number];

export interface CliOptions {
  transport: Transport;
  port: number;
  host: string;
}

/** Invalid CLI usage; the caller prints the message and exits non-zero. */
export class CliUsageError extends Error {}

export const HELP_TEXT = `
Tarot MCP Server

Usage: node dist/index.js [options]

Options:
  --transport <type>    Transport type: stdio, http, sse (default: stdio)
  --port <number>       Port for HTTP/SSE transport (default: $PORT or 3000)
  --host <address>      Bind address for HTTP/SSE transport (default: $HOST or 0.0.0.0)
  --help, -h           Show this help message

Examples:
  node dist/index.js                           # Run with stdio transport
  node dist/index.js --transport http          # Run HTTP server on port 3000
  node dist/index.js --transport http --port 8080  # Run HTTP server on port 8080
  node dist/index.js --transport http --host 127.0.0.1  # Local-only HTTP server
`;

function parsePort(value: string, source: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliUsageError(
      `Invalid ${source} value "${value}": expected an integer between 1 and 65535.`,
    );
  }
  return port;
}

/**
 * Parse command line arguments. Returns "help" when usage was requested,
 * throws CliUsageError on invalid input.
 */
export function parseArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): CliOptions | "help" {
  let transport: Transport = "stdio";
  let port: number | undefined;
  let host: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--transport": {
        const value = argv[i + 1];
        if (!value || !VALID_TRANSPORTS.includes(value as Transport)) {
          throw new CliUsageError(
            `Invalid --transport value "${value ?? ""}": expected one of ${VALID_TRANSPORTS.join(", ")}.`,
          );
        }
        transport = value as Transport;
        i++;
        break;
      }
      case "--port":
        port = parsePort(argv[i + 1] ?? "", "--port");
        i++;
        break;
      case "--host": {
        const value = argv[i + 1];
        if (!value) {
          throw new CliUsageError("Missing --host value.");
        }
        host = value;
        i++;
        break;
      }
      case "--help":
      case "-h":
        return "help";
      default:
        throw new CliUsageError(
          `Unknown argument "${argv[i]}". Use --help for usage.`,
        );
    }
  }

  // The PORT/HOST env vars only matter when an HTTP listener will actually
  // start and no explicit flag was given; stdio launches must ignore them.
  if (port === undefined) {
    port =
      transport !== "stdio" && env.PORT ? parsePort(env.PORT, "PORT") : 3000;
  }

  if (host === undefined) {
    host = (transport !== "stdio" && env.HOST) || "0.0.0.0";
  }

  return { transport, port, host };
}
