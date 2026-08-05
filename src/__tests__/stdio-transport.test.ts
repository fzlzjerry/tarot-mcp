import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";

const HANDOFF_URL_PATTERN =
  /http:\/\/127\.0\.0\.1:\d+\/draw\/#handoff=[A-Za-z0-9_%=-]+/;

function timeoutAfter<T>(
  promise: Promise<T>,
  milliseconds: number,
  label: string,
) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for ${label}`)),
        milliseconds,
      );
      timer.unref();
    }),
  ]);
}

function captureHandoffUrl(): {
  promise: Promise<URL>;
  capture(message: string | undefined): void;
} {
  let resolveUrl: ((url: URL) => void) | undefined;
  const promise = new Promise<URL>((resolve) => {
    resolveUrl = resolve;
  });
  return {
    promise,
    capture(message) {
      const match = message?.match(HANDOFF_URL_PATTERN);
      if (!match) return;
      resolveUrl?.(new URL(match[0]));
      resolveUrl = undefined;
    },
  };
}

function handoffRequest(url: URL): {
  headers: Record<string, string>;
  resolveUrl: string;
  confirmUrl: string;
} {
  const token = new URLSearchParams(url.hash.slice(1)).get("handoff");
  if (!token) throw new Error("Browser handoff URL did not contain a token");
  return {
    headers: {
      "content-type": "application/json",
      authorization: `Tarot-Handoff ${token}`,
      origin: url.origin,
    },
    resolveUrl: `${url.origin}/api/visual-handoff/resolve`,
    confirmUrl: `${url.origin}/api/visual-handoff/confirm`,
  };
}

function makeStdioClient(): {
  client: Client;
  transport: StdioClientTransport;
  stderr(): string;
} {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/index.ts"],
    cwd: process.cwd(),
    env: {
      TAROT_BROWSER_FALLBACK: "link",
      TAROT_BROWSER_FALLBACK_PORT: "0",
      LOG_FORMAT: "json",
    },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return {
    client: new Client({
      name: "browser-handoff-stdio-e2e",
      version: "1.0.0",
    }),
    transport,
    stderr: () => stderr,
  };
}

/**
 * With the stdio transport, stdout is the JSON-RPC channel. Any stray
 * logging on stdout corrupts the protocol, so every stdout line must parse
 * as JSON.
 */
describe("stdio transport stdout purity", () => {
  it("emits only JSON-RPC on stdout while logs go to stderr", async () => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TAROT_BROWSER_FALLBACK: "off",
      },
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const initialize = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "jest-stdio", version: "1.0.0" },
      },
    };

    try {
      // Wait for startup, send initialize, wait for the response.
      const deadline = Date.now() + 15000;
      while (
        !stderr.includes("stdio_server_started") &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      child.stdin.write(JSON.stringify(initialize) + "\n");

      while (!stdout.includes('"serverInfo"') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await exited;
      }
    }

    const stdoutLines = stdout.split("\n").filter((line) => line.trim() !== "");
    expect(stdoutLines.length).toBeGreaterThan(0);
    for (const line of stdoutLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    const response = JSON.parse(stdoutLines[0]);
    expect(response.result.serverInfo.name).toBe("tarot-mcp-server");

    // Human-readable logs landed on stderr, not stdout.
    expect(stderr).toContain("server_starting");
    expect(stderr).toContain("stdio_server_started");
  }, 20000);

  it("keeps one MCP tool call pending until the browser confirms, then returns the reading to the AI", async () => {
    const { client, transport, stderr } = makeStdioClient();

    try {
      // This client intentionally advertises no MCP Apps extension. Link mode
      // exercises the real fallback without launching a desktop browser.
      await client.connect(transport);
      const handoff = captureHandoffUrl();
      let beginSettled = false;
      const beginPromise = client.callTool(
        {
          name: "begin_visual_reading",
          arguments: {
            readingKind: "spread",
            spreadType: "single_card",
            question: "Can the browser finish before stdio closes?",
            language: "en",
          },
        },
        undefined,
        {
          timeout: 15_000,
          resetTimeoutOnProgress: true,
          onprogress: ({ message }) => handoff.capture(message),
        },
      );
      beginPromise.then(
        () => {
          beginSettled = true;
        },
        () => {
          beginSettled = true;
        },
      );

      // Progress is the side channel that exposes link mode while the actual
      // tools/call request remains in flight. The bearer token is never logged.
      const handoffUrl = await timeoutAfter(
        handoff.promise,
        10_000,
        "browser handoff progress",
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(beginSettled).toBe(false);
      expect(transport.pid).not.toBeNull();
      expect(stderr()).not.toContain(handoffUrl.hash.slice(1));

      const request = handoffRequest(handoffUrl);
      const resolve = await fetch(request.resolveUrl, {
        method: "POST",
        headers: request.headers,
        body: "{}",
      });
      expect(resolve.status).toBe(200);
      const resolved = (await resolve.json()) as {
        draw: {
          drawId: string;
          requiredCount: number;
          slots: Array<{ slotId: string; order: number }>;
        };
      };
      expect(resolved.draw.requiredCount).toBe(1);
      expect(resolved.draw.slots).toHaveLength(78);
      expect(
        new Set(resolved.draw.slots.map(({ slotId }) => slotId)).size,
      ).toBe(78);

      expect(beginSettled).toBe(false);
      const confirm = await fetch(request.confirmUrl, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          selectedSlotIds: [resolved.draw.slots[0].slotId],
        }),
      });
      expect(confirm.status).toBe(200);
      const confirmed = (await confirm.json()) as {
        reading: {
          readingId: string;
          drawId: string;
          cards: unknown[];
        };
      };
      expect(confirmed.reading).toMatchObject({
        readingId: expect.stringMatching(/^reading_/),
        drawId: resolved.draw.drawId,
      });
      expect(confirmed.reading.cards).toHaveLength(1);

      // The response to the original begin_visual_reading call is the
      // confirmed reading. The model does not have to poll or issue a second
      // confirm_visual_reading call after the user finishes in the browser.
      const begin = await timeoutAfter(
        beginPromise,
        5_000,
        "confirmed MCP tool result",
      );
      expect(begin.isError).toBeUndefined();
      expect(begin.structuredContent).toMatchObject({
        readingId: confirmed.reading.readingId,
        drawId: resolved.draw.drawId,
        status: "confirmed",
        cards: expect.arrayContaining([expect.any(Object)]),
      });
      expect(begin._meta).toMatchObject({
        browserFallback: { opened: false, reused: false, completed: true },
      });
      expect(begin._meta).not.toHaveProperty("cardImages");
      expect(begin._meta).not.toHaveProperty("backImage");
      expect(JSON.stringify(begin)).not.toContain("data:image");
      expect(JSON.stringify(begin)).not.toContain("imageUri");
      expect(
        (begin.content[0] as { type: string; text: string }).text,
      ).toContain("Single Card Reading");

      const logDeadline = Date.now() + 2_000;
      while (
        !stderr().includes('"browser_fallback_ready"') &&
        Date.now() < logDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(stderr()).toContain('"browser_fallback_ready"');
      expect(stderr()).toContain('"opened":false');
    } finally {
      await client.close();
    }

    expect(transport.pid).toBeNull();
  }, 20000);

  it.each(["cancel", "close"] as const)(
    "%s releases a pending browser waiter and does not leave the stdio process running",
    async (operation) => {
      const { client, transport } = makeStdioClient();
      const controller = new AbortController();
      let closed = false;

      try {
        await client.connect(transport);
        const handoff = captureHandoffUrl();
        const beginPromise = client.callTool(
          {
            name: "begin_visual_reading",
            arguments: {
              readingKind: "spread",
              spreadType: "single_card",
              question: "Release this pending browser waiter?",
              language: "en",
            },
          },
          undefined,
          {
            signal: controller.signal,
            timeout: 15_000,
            onprogress: ({ message }) => handoff.capture(message),
          },
        );
        const beginOutcome = beginPromise.then(
          () => ({ resolved: true as const }),
          (error: unknown) => ({ resolved: false as const, error }),
        );

        await timeoutAfter(
          handoff.promise,
          10_000,
          "pending browser handoff progress",
        );
        expect(transport.pid).not.toBeNull();

        if (operation === "cancel") {
          controller.abort();
          const outcome = await timeoutAfter(
            beginOutcome,
            3_000,
            "cancelled tool call",
          );
          expect(outcome.resolved).toBe(false);
        }

        await timeoutAfter(client.close(), 5_000, "stdio client close");
        closed = true;
        const outcome = await timeoutAfter(
          beginOutcome,
          3_000,
          "closed tool call",
        );
        if (operation === "cancel") {
          expect(outcome.resolved).toBe(false);
        }
        // A transport close may either reject the in-flight request or settle
        // it while tearing down protocol state. Its required invariant is that
        // both the waiter and stdio child terminate promptly.
        expect(transport.pid).toBeNull();
      } finally {
        if (!closed) await client.close().catch(() => undefined);
      }
    },
    20000,
  );
});
