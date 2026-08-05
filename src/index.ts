#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TarotServer } from "./mcp/tarot-service.js";
import { TarotHttpServer } from "./mcp/http-server.js";
import { createMcpProtocolServer } from "./mcp/protocol-server.js";
import {
  createLocalBrowserHandoff,
  type LocalBrowserHandoff,
} from "./mcp/browser-handoff.js";
import { CliOptions, CliUsageError, HELP_TEXT, parseArgs } from "./mcp/args.js";
import { logger } from "./tarot/shared/logger.js";

let runningHttpServer: TarotHttpServer | undefined;
let runningBrowserHandoff: LocalBrowserHandoff | undefined;
let runningProtocolServer:
  ReturnType<typeof createMcpProtocolServer> | undefined;
let shutdownPromise: Promise<void> | undefined;
let forceDeferredShutdown: (() => void) | undefined;

const CHATWISE_CLIENT_NAME = "chatwise";
const CHATWISE_PARENT_POLL_MS = 100;
const CHATWISE_RESPONSE_FLUSH_GRACE_MS = 1_500;
const CHATWISE_STDOUT_DRAIN_TIMEOUT_MS = 1_500;

interface ParentExitWatcher {
  promise: Promise<void>;
  cancel(): void;
}

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
  runningBrowserHandoff = createLocalBrowserHandoff(tarotServer);
  const server = createMcpProtocolServer(tarotServer, {
    ...(runningBrowserHandoff
      ? { visualBrowserFallback: runningBrowserHandoff }
      : {}),
  });
  runningProtocolServer = server;
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // A genuine protocol/transport close is terminal and must release the
  // loopback listener. Do not mirror this hook onto stdin end/close: some MCP
  // hosts half-close stdin while continuing to wait for a pending result on
  // stdout.
  server.onclose = () => {
    void runningBrowserHandoff?.stop().catch((error) => {
      logger.error("browser_fallback_stop_failed", { error: String(error) });
    });
  };

  logger.info("stdio_server_started");
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createParentExitWatcher(parentPid: number): ParentExitWatcher {
  let interval: NodeJS.Timeout | undefined;
  let settled = false;
  let resolveExit!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });
  const finish = (): void => {
    if (settled) return;
    settled = true;
    if (interval) clearInterval(interval);
    resolveExit();
  };
  const parentIsAlive = (): boolean => {
    if (parentPid <= 1 || process.ppid !== parentPid) return false;
    try {
      process.kill(parentPid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== "ESRCH";
    }
  };
  const check = (): void => {
    if (!parentIsAlive()) finish();
  };

  check();
  if (!settled) {
    interval = setInterval(check, CHATWISE_PARENT_POLL_MS);
    interval.unref();
  }

  return {
    promise,
    cancel: () => {
      if (interval) clearInterval(interval);
      interval = undefined;
    },
  };
}

async function waitForStdoutFlushGrace(): Promise<void> {
  await sleep(CHATWISE_RESPONSE_FLUSH_GRACE_MS);
  if (process.stdout.destroyed) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      process.stdout.off("error", finish);
      process.stdout.off("close", finish);
      resolve();
    };
    const timeout = setTimeout(finish, CHATWISE_STDOUT_DRAIN_TIMEOUT_MS);
    process.stdout.once("error", finish);
    process.stdout.once("close", finish);
    try {
      // Writable callbacks run in stream order. This empty sentinel therefore
      // completes only after the preceding JSON-RPC result has reached the
      // stdout transport, even when the high-water mark never emitted drain.
      process.stdout.write("", finish);
    } catch {
      finish();
    }
  });
}

function shouldDeferForChatWise(signal: NodeJS.Signals): boolean {
  const clientName = runningProtocolServer
    ?.getClientVersion()
    ?.name.trim()
    .toLowerCase();
  return (
    signal === "SIGTERM" &&
    clientName === CHATWISE_CLIENT_NAME &&
    runningBrowserHandoff?.hasActiveWaiters() === true
  );
}

async function deferChatWiseShutdownUntilIdle(
  handoff: LocalBrowserHandoff,
): Promise<void> {
  const parentPid = process.ppid;
  const parentExit = createParentExitWatcher(parentPid);
  let resolveForced!: () => void;
  const forced = new Promise<void>((resolve) => {
    resolveForced = resolve;
  });
  forceDeferredShutdown = resolveForced;

  logger.info("shutdown_deferred_for_browser_confirmation", {
    signal: "SIGTERM",
    client: CHATWISE_CLIENT_NAME,
    parentPid,
  });

  try {
    const interruption = Promise.race([
      parentExit.promise.then(() => "parent_exit" as const),
      forced.then(() => "forced" as const),
    ]);

    while (handoff.hasActiveWaiters()) {
      const idleOutcome = await Promise.race([
        handoff.waitUntilIdle().then(() => "idle" as const),
        interruption,
      ]);
      if (idleOutcome !== "idle") {
        logger.info("shutdown_deferred_interrupted", {
          reason: idleOutcome,
        });
        return;
      }

      const flushOutcome = await Promise.race([
        waitForStdoutFlushGrace().then(() => "flushed" as const),
        interruption,
      ]);
      if (flushOutcome !== "flushed") {
        logger.info("shutdown_deferred_interrupted", {
          reason: flushOutcome,
        });
        return;
      }
    }

    logger.info("shutdown_deferred_completed", {
      client: CHATWISE_CLIENT_NAME,
    });
  } finally {
    parentExit.cancel();
    forceDeferredShutdown = undefined;
  }
}

// Handle graceful shutdown: close active MCP sessions and the HTTP listener.
async function performShutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("shutdown_requested", { signal });
  try {
    const handoff = runningBrowserHandoff;
    if (handoff && shouldDeferForChatWise(signal)) {
      await deferChatWiseShutdownUntilIdle(handoff);
    }
    await runningHttpServer?.stop();
    await runningBrowserHandoff?.stop();
  } catch (error) {
    logger.error("shutdown_error", { error: String(error) });
    process.exit(1);
  }
  process.exit(0);
}

function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) {
    // A second termination request always overrides the compatibility wait.
    // ChatWise's lifecycle refresh sends one SIGTERM; operators retain the
    // conventional ability to force shutdown with a repeated signal.
    forceDeferredShutdown?.();
    return shutdownPromise;
  }
  shutdownPromise = performShutdown(signal);
  return shutdownPromise;
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Start the server
main().catch((error) => {
  logger.error("fatal_error", { error: String(error) });
  process.exit(1);
});
