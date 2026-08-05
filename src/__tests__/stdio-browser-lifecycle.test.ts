import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const HANDOFF_URL_PATTERN =
  /http:\/\/127\.0\.0\.1:\d+\/draw\/#handoff=[A-Za-z0-9_%=-]+/;

type JsonRpcMessage = {
  id?: number;
  method?: string;
  params?: { message?: string };
  result?: {
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
    content?: Array<{ type: string; text?: string }>;
  };
};

function waitFor<T>(
  read: () => T | undefined,
  label: string,
  timeoutMs = 10_000,
): Promise<T> {
  const existing = read();
  if (existing !== undefined) return Promise.resolve(existing);
  return new Promise<T>((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      const value = read();
      if (value !== undefined) {
        clearInterval(poll);
        resolve(value);
      } else if (Date.now() - started >= timeoutMs) {
        clearInterval(poll);
        reject(new Error(`Timed out waiting for ${label}`));
      }
    }, 10);
  });
}

function handoffRequest(url: URL) {
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

function send(child: ChildProcessWithoutNullStreams, message: unknown): void {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function expectNoArtworkInToolResult(result: JsonRpcMessage["result"]): void {
  const serialized = JSON.stringify(result);
  expect(result?.content?.every(({ type }) => type === "text")).toBe(true);
  expect(serialized).not.toContain("cardImages");
  expect(serialized).not.toContain("backImage");
  expect(serialized).not.toContain("imageUri");
  expect(serialized).not.toContain("data:image");
}

describe("stdio browser handoff lifecycle", () => {
  it("survives stdin EOF until browser confirmation and flushes the original tool result", async () => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TAROT_BROWSER_FALLBACK: "link",
        TAROT_BROWSER_FALLBACK_PORT: "0",
        LOG_FORMAT: "json",
      },
      stdio: "pipe",
    });
    const messages: JsonRpcMessage[] = [];
    let stdoutBuffer = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) messages.push(JSON.parse(line) as JsonRpcMessage);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    try {
      send(child, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "half-close-regression", version: "1.0.0" },
        },
      });
      await waitFor(
        () => messages.find(({ id }) => id === 1),
        "initialize response",
      );
      send(child, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      send(child, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "begin_visual_reading",
          arguments: {
            readingKind: "spread",
            spreadType: "single_card",
            question: "Can confirmation survive a half-closed stdin?",
            language: "en",
          },
          _meta: { progressToken: "half-close-progress" },
        },
      });

      const handoffUrl = await waitFor(() => {
        for (const message of messages) {
          const match = message.params?.message?.match(HANDOFF_URL_PATTERN);
          if (match) return new URL(match[0]);
        }
        return undefined;
      }, "handoff progress URL");

      // Some MCP hosts half-close their write side after dispatching the
      // tools/call but continue reading stdout. That is not a request cancel.
      child.stdin.end();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(child.exitCode).toBeNull();
      expect(messages.find(({ id }) => id === 2)).toBeUndefined();

      const request = handoffRequest(handoffUrl);
      const resolvedResponse = await fetch(request.resolveUrl, {
        method: "POST",
        headers: request.headers,
        body: "{}",
      });
      expect(resolvedResponse.status).toBe(200);
      const resolved = (await resolvedResponse.json()) as {
        draw: { drawId: string; slots: Array<{ slotId: string }> };
      };
      const confirmResponse = await fetch(request.confirmUrl, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          selectedSlotIds: [resolved.draw.slots[0].slotId],
        }),
      });
      expect(confirmResponse.status).toBe(200);

      const resultMessage = await waitFor(
        () => messages.find(({ id }) => id === 2),
        "confirmed tools/call response",
      );
      expect(resultMessage.result).toMatchObject({
        structuredContent: {
          drawId: resolved.draw.drawId,
          status: "confirmed",
        },
      });
      expect(resultMessage.result?.isError).toBeUndefined();
      expect(resultMessage.result?.content?.[0]?.text).not.toContain(
        "Browser handoff stopped",
      );
      expectNoArtworkInToolResult(resultMessage.result);

      const exitCode = await waitFor(
        () => (child.exitCode === null ? undefined : child.exitCode),
        "stdio process exit after result flush",
        5_000,
      );
      expect(exitCode).toBe(0);
      expect(stderr).not.toContain("browser_fallback_wait_failed");
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise<void>((resolve) => {
          child.once("exit", () => resolve());
        });
        child.kill("SIGTERM");
        await exited;
      }
    }
  }, 20_000);

  it("defers ChatWise's SIGTERM close until the browser result reaches the original tool call", async () => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TAROT_BROWSER_FALLBACK: "link",
        TAROT_BROWSER_FALLBACK_PORT: "0",
        LOG_FORMAT: "json",
      },
      stdio: "pipe",
    });
    const messages: JsonRpcMessage[] = [];
    let stdoutBuffer = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) messages.push(JSON.parse(line) as JsonRpcMessage);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    try {
      send(child, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "chatwise", version: "26.7.8" },
        },
      });
      await waitFor(
        () => messages.find(({ id }) => id === 1),
        "ChatWise initialize response",
      );
      send(child, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      send(child, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "begin_visual_reading",
          arguments: {
            readingKind: "spread",
            spreadType: "single_card",
            question: "Can ChatWise receive this browser confirmation?",
            language: "en",
          },
          _meta: { progressToken: "chatwise-close-progress" },
        },
      });

      const handoffUrl = await waitFor(() => {
        for (const message of messages) {
          const match = message.params?.message?.match(HANDOFF_URL_PATTERN);
          if (match) return new URL(match[0]);
        }
        return undefined;
      }, "ChatWise handoff progress URL");

      // ChatWise's custom stdio transport closes a server with child.kill(),
      // which sends SIGTERM but leaves its response handler able to read stdout.
      expect(child.kill("SIGTERM")).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(child.exitCode).toBeNull();
      expect(messages.find(({ id }) => id === 2)).toBeUndefined();

      const request = handoffRequest(handoffUrl);
      const resolvedResponse = await fetch(request.resolveUrl, {
        method: "POST",
        headers: request.headers,
        body: "{}",
      });
      expect(resolvedResponse.status).toBe(200);
      const resolved = (await resolvedResponse.json()) as {
        draw: { drawId: string; slots: Array<{ slotId: string }> };
      };
      const confirmResponse = await fetch(request.confirmUrl, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          selectedSlotIds: [resolved.draw.slots[0].slotId],
        }),
      });
      expect(confirmResponse.status).toBe(200);

      const resultMessage = await waitFor(
        () => messages.find(({ id }) => id === 2),
        "ChatWise confirmed tools/call response",
      );
      expect(resultMessage.result).toMatchObject({
        structuredContent: {
          drawId: resolved.draw.drawId,
          status: "confirmed",
        },
      });
      expect(resultMessage.result?.isError).toBeUndefined();
      expect(resultMessage.result?.content?.[0]?.text).not.toContain(
        "Browser handoff stopped",
      );
      expectNoArtworkInToolResult(resultMessage.result);

      const exitCode = await waitFor(
        () => (child.exitCode === null ? undefined : child.exitCode),
        "ChatWise stdio process exit after deferred result flush",
        7_000,
      );
      expect(exitCode).toBe(0);
      expect(stderr).toContain("shutdown_deferred_for_browser_confirmation");
      expect(stderr).toContain("shutdown_deferred_completed");
      expect(stderr).not.toContain("browser_fallback_wait_failed");
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise<void>((resolve) => {
          child.once("exit", () => resolve());
        });
        child.kill("SIGKILL");
        await exited;
      }
    }
  }, 25_000);
});
