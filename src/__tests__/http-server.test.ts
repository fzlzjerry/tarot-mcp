import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PORT = 3379;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const LATEST_PROTOCOL_VERSION = "2025-06-18";

async function waitForHealth(
  getFailureDetails: () => string | undefined,
): Promise<void> {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    const failureDetails = getFailureDetails();
    if (failureDetails) {
      throw new Error(failureDetails);
    }

    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `HTTP server did not become healthy in time\n${getFailureDetails() || ""}`,
  );
}

function mcpInitializeRequest(id: number) {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "jest-smoke",
        version: "1.0.0",
      },
    },
  };
}

describe("HTTP MCP server", () => {
  let serverProcess: ChildProcessWithoutNullStreams;
  let serverExit:
    | {
        code: number | null;
        signal: NodeJS.Signals | null;
      }
    | undefined;
  let serverStderr = "";
  let tsxTempDir: string | undefined;

  beforeAll(async () => {
    const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    tsxTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tarot-mcp-tsx-"));
    serverProcess = spawn(
      tsxBin,
      ["src/index.ts", "--transport", "http", "--port", String(PORT)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TMPDIR: tsxTempDir,
        },
        stdio: "pipe",
      },
    );
    serverProcess.stderr.on("data", (chunk) => {
      serverStderr += chunk.toString();
    });
    serverProcess.once("exit", (code, signal) => {
      serverExit = { code, signal };
    });

    await waitForHealth(() => {
      if (!serverExit) {
        return undefined;
      }

      return [
        `HTTP server process exited before becoming healthy.`,
        `exitCode=${serverExit.code} signal=${serverExit.signal}`,
        serverStderr.trim(),
      ]
        .filter(Boolean)
        .join("\n");
    });
  }, 20000);

  afterAll(async () => {
    if (serverProcess && serverExit === undefined) {
      serverProcess.kill("SIGTERM");
      await new Promise((resolve) => serverProcess.once("exit", resolve));
    }

    if (tsxTempDir) {
      await fs.rm(tsxTempDir, { recursive: true, force: true });
    }
  });

  it("serves health, info, and spreads endpoints", async () => {
    const health = await fetch(`${BASE_URL}/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      status: "ok",
    });

    const info = await fetch(`${BASE_URL}/api/info`);
    const infoJson = await info.json();
    expect(infoJson.tools).toHaveLength(13);

    const spreads = await fetch(`${BASE_URL}/api/spreads`);
    const spreadsJson = await spreads.json();
    expect(spreadsJson.spreads.length).toBeGreaterThanOrEqual(20);
    expect(spreadsJson.spreads[0]).toHaveProperty("type");
  });

  it("serves card listing and card detail endpoints", async () => {
    const cards = await fetch(`${BASE_URL}/api/cards?category=major_arcana`);
    expect(cards.status).toBe(200);
    const cardsJson = await cards.json();
    expect(cardsJson.result).toContain("Major Arcana (22 cards)");

    const card = await fetch(
      `${BASE_URL}/api/cards/${encodeURIComponent("The Fool")}?orientation=reversed`,
    );
    expect(card.status).toBe(200);
    const cardJson = await card.json();
    expect(cardJson.result).toContain("# The Fool (Reversed)");

    const badCategory = await fetch(`${BASE_URL}/api/cards?category=swirls`);
    expect(badCategory.status).toBe(400);
  });

  it("returns HTTP 400 for invalid reading parameters", async () => {
    const response = await fetch(`${BASE_URL}/api/reading`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spreadType: "not_a_spread", question: "Hi?" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Invalid spreadType");
  });

  it("handles Streamable HTTP initialize, initialized, and tools/list", async () => {
    const initializeResponse = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify(mcpInitializeRequest(1)),
    });

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const initializeJson = await initializeResponse.json();
    expect(initializeJson.result.serverInfo.name).toBe("tarot-mcp-server");

    const initializedResponse = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    expect([200, 202]).toContain(initializedResponse.status);

    const listResponse = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    expect(listResponse.status).toBe(200);
    const listJson = await listResponse.json();
    expect(
      listJson.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain("list_available_spreads");

    const callResponse = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "list_available_spreads",
          arguments: {},
        },
      }),
    });

    expect(callResponse.status).toBe(200);
    const callJson = await callResponse.json();
    expect(callJson.result.content[0].text).toContain(
      "# Available Tarot Spreads",
    );
  });

  it("routes legacy SSE messages through /messages", async () => {
    const controller = new AbortController();
    const sseResponse = await fetch(`${BASE_URL}/sse`, {
      headers: {
        accept: "text/event-stream",
      },
      signal: controller.signal,
    });

    expect(sseResponse.status).toBe(200);
    const reader = sseResponse.body!.getReader();
    const chunk = await reader.read();
    const text = new TextDecoder().decode(chunk.value);
    const endpoint = text.match(/data: (\/messages\?sessionId=[^\n]+)/)?.[1];
    expect(endpoint).toBeTruthy();

    const postResponse = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(mcpInitializeRequest(3)),
    });

    expect(postResponse.status).toBe(202);
    controller.abort();
  });
});
