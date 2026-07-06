/**
 * Minimal leveled logger. Always writes to stderr: with the stdio transport
 * stdout is the JSON-RPC protocol channel and must stay clean.
 *
 * - LOG_LEVEL: debug | info | warn | error (default info)
 * - LOG_FORMAT: "json" for JSON-lines output (default human-readable)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LEVEL_ORDER[env] ?? LEVEL_ORDER.info;
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < threshold()) {
    return;
  }

  const time = new Date().toISOString();
  if (process.env.LOG_FORMAT === "json") {
    process.stderr.write(
      JSON.stringify({ time, level, msg: message, ...fields }) + "\n",
    );
    return;
  }

  const suffix =
    fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
  process.stderr.write(`${time} [${level.toUpperCase()}] ${message}${suffix}\n`);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
