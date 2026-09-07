import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ClientCapabilities } from "@modelcontextprotocol/sdk/types.js";
import {
  EXTENSION_ID,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { readdir, readFile } from "node:fs/promises";
import { request } from "node:http";
import type { Response as ExpressResponse } from "express";
import {
  createLocalBrowserHandoff,
  LocalBrowserHandoff,
  parseBrowserFallbackMode,
  type VisualBrowserFallback,
} from "../mcp/browser-handoff.js";
import {
  clientSupportsMcpApps,
  createMcpProtocolServer,
} from "../mcp/protocol-server.js";
import { HTTP_ENDPOINTS, TOOL_NAMES } from "../mcp/public-api.js";
import { TarotServer } from "../mcp/tarot-service.js";
import type { VisualBeginPayload } from "../tarot/readings/visual-draw-manager.js";

interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
}

interface BrowserHandoffResponseInternals {
  sendJsonAndWaitForCompletion(
    response: ExpressResponse,
    body: Record<string, unknown>,
  ): Promise<void>;
}

function handoffLocation(url: string): {
  baseUrl: string;
  token: string;
} {
  const parsed = new URL(url);
  const token = new URLSearchParams(parsed.hash.slice(1)).get("handoff");
  if (!token) throw new Error("Browser handoff URL did not contain a token");
  return { baseUrl: parsed.origin, token };
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function rawPost(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  body = "{}",
): Promise<JsonResponse> {
  const endpoint = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port,
        path: endpoint.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body).toString(),
          ...headers,
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.once("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
          });
        });
      },
    );
    req.once("error", reject);
    req.end(body);
  });
}

async function beginThreeCard(
  server: TarotServer,
): Promise<VisualBeginPayload> {
  const result = await server.executeTool(TOOL_NAMES.beginVisualReading, {
    readingKind: "spread",
    spreadType: "three_card",
    question: "What should the browser reveal?",
    language: "en",
  });
  if (!result.ok) throw new Error(result.error);
  return result.structured as VisualBeginPayload;
}

describe("LocalBrowserHandoff", () => {
  let handoff: LocalBrowserHandoff | undefined;

  afterEach(async () => {
    await handoff?.stop();
    handoff = undefined;
  });

  it("runs a token-scoped sidecar on 127.0.0.1 and preserves confirm semantics", async () => {
    const tarotServer = await TarotServer.create();
    const opener = vi.fn(async () => true);
    handoff = new LocalBrowserHandoff(tarotServer, {
      mode: "auto",
      port: 0,
      opener,
      // Isolated from process.env so CI=true does not suppress auto-open.
      // Linux still requires a display socket before launching a browser.
      env: { NODE_ENV: "production", DISPLAY: ":0" },
    });

    const draw = await beginThreeCard(tarotServer);
    const opened = await handoff.open(draw);
    const location = handoffLocation(opened.url);

    expect(new URL(opened.url)).toMatchObject({
      protocol: "http:",
      hostname: "127.0.0.1",
      pathname: "/draw/",
    });
    expect(opened).toMatchObject({ opened: true, reused: false });
    expect(opener).toHaveBeenCalledTimes(1);
    expect(opener).toHaveBeenCalledWith(opened.url);

    const drawPage = await fetch(opened.url);
    expect([200, 503]).toContain(drawPage.status);
    const drawCsp = drawPage.headers.get("content-security-policy") ?? "";
    expect(drawCsp).toContain("font-src 'self' data:");
    expect(drawCsp).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    if (drawPage.status === 200) {
      expect(await drawPage.text()).toMatch(
        /rel=["']icon["'][^>]+data:image\/svg\+xml/,
      );
    }

    const repeatedOpen = await handoff.open(draw);
    expect(repeatedOpen).toEqual({
      url: opened.url,
      opened: true,
      reused: true,
    });
    expect(opener).toHaveBeenCalledTimes(1);

    const authorization = `Tarot-Handoff ${location.token}`;
    const resolve = await fetch(
      `${location.baseUrl}${HTTP_ENDPOINTS.api.visualHandoffResolve}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization,
          origin: location.baseUrl,
        },
        body: "{}",
      },
    );
    expect(resolve.status).toBe(200);
    expect(resolve.headers.get("cache-control")).toBe("no-store");
    const resolvedBody = await responseJson(resolve);
    const resolvedDraw = resolvedBody.draw as VisualBeginPayload;
    expect(resolvedDraw.drawId).toBe(draw.drawId);
    expect(resolvedDraw.slots).toHaveLength(78);
    expect(new Set(resolvedDraw.slots.map(({ slotId }) => slotId)).size).toBe(
      78,
    );
    expect(JSON.stringify(resolvedDraw.slots)).not.toMatch(
      /cardId|orientation|meaning/,
    );

    const selectedSlotIds = resolvedDraw.slots
      .slice(0, resolvedDraw.requiredCount)
      .map(({ slotId }) => slotId);
    const responseInternals =
      handoff as unknown as BrowserHandoffResponseInternals;
    const sendResponse =
      responseInternals.sendJsonAndWaitForCompletion.bind(handoff);
    let browserResponseCompleted = false;
    vi.spyOn(
      responseInternals,
      "sendJsonAndWaitForCompletion",
    ).mockImplementation(async (response, body) => {
      await sendResponse(response, body);
      browserResponseCompleted = true;
    });
    expect(handoff.hasActiveWaiters()).toBe(false);
    const confirmationWaiter = handoff.waitForConfirmation(draw.drawId);
    expect(handoff.hasActiveWaiters()).toBe(true);
    let idleSettled = false;
    const idle = handoff.waitUntilIdle().then(() => {
      idleSettled = true;
    });
    const confirmUrl = `${location.baseUrl}${HTTP_ENDPOINTS.api.visualHandoffConfirm}`;
    const confirmRequest = (selection: string[]) =>
      fetch(confirmUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization,
          origin: location.baseUrl,
        },
        body: JSON.stringify({ selectedSlotIds: selection }),
      });

    const invalidConfirm = await confirmRequest(selectedSlotIds.slice(0, 2));
    expect(invalidConfirm.status).toBe(400);
    expect(
      await Promise.race([
        confirmationWaiter.then(
          () => "settled",
          () => "settled",
        ),
        Promise.resolve("pending"),
      ]),
    ).toBe("pending");
    expect(handoff.hasActiveWaiters()).toBe(true);
    expect(idleSettled).toBe(false);

    const confirm = await confirmRequest(selectedSlotIds);
    expect(confirm.status).toBe(200);
    const confirmedBody = await responseJson(confirm);
    const confirmedReading = confirmedBody.reading as {
      readingId: string;
      drawId: string;
      cards: unknown[];
    };
    expect(confirmedReading).toMatchObject({
      drawId: draw.drawId,
      cards: expect.arrayContaining([expect.any(Object)]),
    });
    expect(confirmedReading.cards).toHaveLength(3);

    const waitedResult = await confirmationWaiter;
    await idle;
    expect(browserResponseCompleted).toBe(true);
    expect(handoff.hasActiveWaiters()).toBe(false);
    expect(idleSettled).toBe(true);
    await expect(handoff.waitUntilIdle()).resolves.toBeUndefined();
    expect(waitedResult.ok).toBe(true);
    expect(
      (
        waitedResult.structured as {
          readingId: string;
        }
      ).readingId,
    ).toBe(confirmedReading.readingId);
    await expect(handoff.waitForConfirmation(draw.drawId)).resolves.toBe(
      waitedResult,
    );

    const retry = await confirmRequest(selectedSlotIds);
    expect(retry.status).toBe(200);
    const retryBody = await responseJson(retry);
    expect((retryBody.reading as { readingId: string }).readingId).toBe(
      confirmedReading.readingId,
    );

    const conflict = await confirmRequest([...selectedSlotIds].reverse());
    expect(conflict.status).toBe(409);
    await expect(responseJson(conflict)).resolves.toMatchObject({
      code: "DRAW_ALREADY_CONFIRMED",
    });

    const resolvedAgain = await fetch(
      `${location.baseUrl}${HTTP_ENDPOINTS.api.visualHandoffResolve}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization,
          origin: location.baseUrl,
        },
        body: "{}",
      },
    );
    expect(resolvedAgain.status).toBe(200);
    const resolvedAgainBody = await responseJson(resolvedAgain);
    expect((resolvedAgainBody.draw as VisualBeginPayload).slots).toHaveLength(
      78,
    );
    expect((resolvedAgainBody.reading as { readingId: string }).readingId).toBe(
      confirmedReading.readingId,
    );
  });

  it.skipIf(process.platform !== "linux")(
    "does not auto-open a browser on headless Linux",
    async () => {
      const tarotServer = await TarotServer.create();
      const opener = vi.fn(async () => true);
      handoff = new LocalBrowserHandoff(tarotServer, {
        mode: "auto",
        port: 0,
        opener,
        env: { NODE_ENV: "production" },
      });

      const opened = await handoff.open(await beginThreeCard(tarotServer));
      expect(opened).toMatchObject({ opened: false, reused: false });
      expect(opener).not.toHaveBeenCalled();
    },
  );

  it("rejects untrusted origins, Host headers, and missing or invalid tokens", async () => {
    const tarotServer = await TarotServer.create();
    handoff = new LocalBrowserHandoff(tarotServer, {
      mode: "link",
      port: 0,
      opener: vi.fn(async () => true),
      env: { NODE_ENV: "test" },
    });
    const opened = await handoff.open(await beginThreeCard(tarotServer));
    const { baseUrl, token } = handoffLocation(opened.url);
    const endpoint = `${baseUrl}${HTTP_ENDPOINTS.api.visualHandoffResolve}`;

    expect(opened.opened).toBe(false);

    const missing = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: "{}",
    });
    expect(missing.status).toBe(401);

    const bearerInstead = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        origin: baseUrl,
      },
      body: "{}",
    });
    expect(bearerInstead.status).toBe(401);

    const invalid = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Tarot-Handoff invalid-token",
        origin: baseUrl,
      },
      body: "{}",
    });
    expect(invalid.status).toBe(404);

    const foreignOrigin = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Tarot-Handoff ${token}`,
        origin: "https://evil.example",
      },
      body: "{}",
    });
    expect(foreignOrigin.status).toBe(403);
    await expect(responseJson(foreignOrigin)).resolves.toMatchObject({
      error: "Forbidden: origin not allowed",
    });

    const parsedBase = new URL(baseUrl);
    const wrongHost = await rawPost(
      baseUrl,
      HTTP_ENDPOINTS.api.visualHandoffResolve,
      {
        host: `evil.example:${parsedBase.port}`,
        origin: baseUrl,
        authorization: `Tarot-Handoff ${token}`,
      },
    );
    expect(wrongHost).toMatchObject({
      status: 403,
      body: { error: "Forbidden: host not allowed" },
    });
  });

  it("expires the browser capability with its pending visual draw", async () => {
    const tarotServer = await TarotServer.create();
    let now = Date.now();
    handoff = new LocalBrowserHandoff(tarotServer, {
      mode: "link",
      port: 0,
      now: () => now,
      env: { NODE_ENV: "test" },
    });
    const draw = await beginThreeCard(tarotServer);
    const opened = await handoff.open(draw);
    const { baseUrl, token } = handoffLocation(opened.url);
    const waiting = handoff.waitForConfirmation(draw.drawId);
    const expiredWaiter = expect(waiting).rejects.toMatchObject({
      name: "BrowserHandoffWaitError",
      code: "EXPIRED",
    });
    now = Date.parse(draw.expiresAt) + 1;

    const expired = await fetch(
      `${baseUrl}${HTTP_ENDPOINTS.api.visualHandoffResolve}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Tarot-Handoff ${token}`,
          origin: baseUrl,
        },
        body: "{}",
      },
    );
    expect(expired.status).toBe(410);
    await expiredWaiter;
  });

  it("cancels one waiter without leaking its abort listener", async () => {
    const tarotServer = await TarotServer.create();
    handoff = new LocalBrowserHandoff(tarotServer, {
      mode: "link",
      port: 0,
      env: { NODE_ENV: "test" },
    });
    const draw = await beginThreeCard(tarotServer);
    await handoff.open(draw);
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");

    const waiting = handoff.waitForConfirmation(draw.drawId, {
      signal: controller.signal,
    });
    const independentWaiter = handoff.waitForConfirmation(draw.drawId);
    const independentStopped = expect(independentWaiter).rejects.toMatchObject({
      code: "STOPPED",
    });
    controller.abort();

    await expect(waiting).rejects.toMatchObject({
      name: "BrowserHandoffWaitError",
      code: "ABORTED",
    });
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(
      await Promise.race([
        independentWaiter.then(
          () => "settled",
          () => "settled",
        ),
        Promise.resolve("pending"),
      ]),
    ).toBe("pending");
    await handoff.stop();
    handoff = undefined;
    await independentStopped;
  });

  it("ends every outstanding waiter when the sidecar stops", async () => {
    const tarotServer = await TarotServer.create();
    handoff = new LocalBrowserHandoff(tarotServer, {
      mode: "link",
      port: 0,
      env: { NODE_ENV: "test" },
    });
    const draw = await beginThreeCard(tarotServer);
    await handoff.open(draw);
    const waiting = handoff.waitForConfirmation(draw.drawId);
    const stoppedWaiter = expect(waiting).rejects.toMatchObject({
      name: "BrowserHandoffWaitError",
      code: "STOPPED",
    });

    await handoff.stop();
    handoff = undefined;
    await stoppedWaiter;
  });

  it("parses fallback modes and supports a complete opt-out", async () => {
    const tarotServer = await TarotServer.create();
    handoff = new LocalBrowserHandoff(tarotServer, {
      mode: "link",
      env: { NODE_ENV: "test" },
    });
    await expect(
      handoff.waitForConfirmation("draw_unknown"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(parseBrowserFallbackMode(undefined)).toBe("auto");
    expect(parseBrowserFallbackMode("FORCE")).toBe("force");
    expect(parseBrowserFallbackMode("unknown")).toBe("auto");
    expect(
      createLocalBrowserHandoff(tarotServer, {
        TAROT_BROWSER_FALLBACK: "off",
      }),
    ).toBeUndefined();
  });

  it("keeps both visual entrypoints free of external or bundled data fonts", async () => {
    const [webHtml, mcpHtml, styles] = await Promise.all([
      readFile("ui/index.html", "utf8"),
      readFile("ui/mcp-app.html", "utf8"),
      readdir("ui/src/styles").then(async (files) =>
        (
          await Promise.all(
            files
              .filter((file) => file.endsWith(".css"))
              .map((file) => readFile(`ui/src/styles/${file}`, "utf8")),
          )
        ).join("\n"),
      ),
    ]);

    for (const html of [webHtml, mcpHtml]) {
      expect(html).toMatch(/rel="icon"[^>]+data:image\/svg\+xml/);
    }
    const visualSources = `${webHtml}\n${mcpHtml}\n${styles}`;
    expect(visualSources).not.toMatch(
      /fonts\.(?:googleapis|gstatic)\.com|@import\s+url|data:font\//i,
    );
  });
});

describe("MCP App capability browser fallback", () => {
  async function connect(
    capabilities: ClientCapabilities,
    fallback: VisualBrowserFallback,
  ): Promise<{
    client: Client;
    server: ReturnType<typeof createMcpProtocolServer>;
  }> {
    const tarotServer = await TarotServer.create();
    const server = createMcpProtocolServer(tarotServer, {
      visualBrowserFallback: fallback,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "browser-fallback-test", version: "1.0.0" },
      { capabilities },
    );
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return { client, server };
  }

  function fakeFallback(force = false): {
    fallback: VisualBrowserFallback;
    open: ReturnType<typeof vi.fn>;
  } {
    const open = vi.fn(async (_draw: VisualBeginPayload) => ({
      url: "http://127.0.0.1:48123/draw/#handoff=test-token",
      opened: true,
      reused: false,
    }));
    return {
      open,
      fallback: {
        force,
        open,
        waitForConfirmation: vi.fn(async () => ({
          ok: true as const,
          text: "Browser confirmation completed.",
          structured: {
            status: "confirmed",
            readingId: "reading_browser_confirmation",
            cards: [],
          },
        })),
        stop: vi.fn(async () => undefined),
      },
    };
  }

  it("opens the browser fallback when the client does not advertise MCP Apps", async () => {
    const { fallback, open } = fakeFallback();
    const { client, server } = await connect({}, fallback);
    try {
      expect(client.getServerCapabilities()?.extensions).toMatchObject({
        [EXTENSION_ID]: {},
      });
      expect(clientSupportsMcpApps(server)).toBe(false);
      const result = await client.callTool({
        name: TOOL_NAMES.beginVisualReading,
        arguments: {
          readingKind: "spread",
          spreadType: "single_card",
          question: "Open the local browser?",
          language: "en",
        },
      });

      expect(result.isError).toBeUndefined();
      expect(open).toHaveBeenCalledTimes(1);
      const privateDraw = open.mock.calls[0][0] as VisualBeginPayload;
      expect(privateDraw.slots).toHaveLength(78);
      expect(new Set(privateDraw.slots.map(({ slotId }) => slotId)).size).toBe(
        78,
      );
      expect(result.structuredContent).not.toHaveProperty("slots");
      expect(result._meta).toMatchObject({
        browserFallback: { opened: true, reused: false, completed: true },
      });
      expect(
        (result.content[0] as { type: string; text: string }).text,
      ).toContain("Browser confirmation completed");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps the embedded App path when the client advertises the UI MIME type", async () => {
    const { fallback, open } = fakeFallback();
    const capabilities = {
      extensions: {
        [EXTENSION_ID]: { mimeTypes: [RESOURCE_MIME_TYPE] },
      },
    } as ClientCapabilities;
    const { client, server } = await connect(capabilities, fallback);
    try {
      expect(clientSupportsMcpApps(server)).toBe(true);
      const result = await client.callTool({
        name: TOOL_NAMES.beginVisualReading,
        arguments: {
          readingKind: "spread",
          spreadType: "single_card",
          question: "Stay embedded?",
          language: "en",
        },
      });

      expect(result.isError).toBeUndefined();
      expect(open).not.toHaveBeenCalled();
      expect(result._meta).toMatchObject({
        visualDeck: { slots: expect.any(Array) },
      });
      expect(result._meta).not.toHaveProperty("browserFallback");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
