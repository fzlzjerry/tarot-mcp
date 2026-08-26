import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import type { Server as HttpServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../tarot/shared/logger.js";
import type { VisualBeginPayload } from "../tarot/readings/visual-draw-manager.js";
import { HTTP_ENDPOINTS, TOOL_NAMES } from "./public-api.js";
import {
  mountVisualWebAssets,
  timingSafeStringEqual,
} from "./static-assets.js";
import type { TarotServer, ToolResult } from "./tarot-service.js";

export const BROWSER_FALLBACK_MODES = ["auto", "off", "force", "link"] as const;
export type BrowserFallbackMode = (typeof BROWSER_FALLBACK_MODES)[number];

export interface BrowserHandoffOpenResult {
  url: string;
  opened: boolean;
  reused: boolean;
}

export interface VisualBrowserFallback {
  readonly force: boolean;
  open(draw: VisualBeginPayload): Promise<BrowserHandoffOpenResult>;
  waitForConfirmation(
    drawId: string,
    options?: BrowserHandoffWaitOptions,
  ): Promise<Extract<ToolResult, { ok: true }>>;
  stop(): Promise<void>;
}

export interface BrowserHandoffWaitOptions {
  signal?: AbortSignal;
}

export type BrowserHandoffWaitErrorCode =
  "NOT_FOUND" | "EXPIRED" | "STOPPED" | "ABORTED";

/** A terminal state for a browser handoff that was waiting on human input. */
export class BrowserHandoffWaitError extends Error {
  public readonly code: BrowserHandoffWaitErrorCode;

  constructor(code: BrowserHandoffWaitErrorCode, message: string) {
    super(message);
    this.name = "BrowserHandoffWaitError";
    this.code = code;
  }
}

export type BrowserOpener = (url: string) => Promise<boolean>;

interface HandoffRecord {
  drawId: string;
  beginPayload: VisualBeginPayload;
  expiresAt: number;
  retainUntil: number;
  confirmed?: Extract<ToolResult, { ok: true }>;
  waiters: Set<HandoffWaiter>;
  expirationTimer?: NodeJS.Timeout;
  confirmationsInFlight: number;
}

interface HandoffWaiter {
  resolve(result: Extract<ToolResult, { ok: true }>): void;
  reject(error: BrowserHandoffWaitError): void;
}

export interface LocalBrowserHandoffOptions {
  mode?: BrowserFallbackMode;
  port?: number;
  opener?: BrowserOpener;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
}

const LOOPBACK_HOST = "127.0.0.1";
const CONFIRMED_RETENTION_MS = 24 * 60 * 60 * 1000;
const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseFallbackPort(value: string | undefined): number {
  if (!value) return 0;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    logger.warn("browser_fallback_invalid_port", { value });
    return 0;
  }
  return port;
}

export function parseBrowserFallbackMode(
  value: string | undefined,
): BrowserFallbackMode {
  const normalized = (value ?? "auto").trim().toLowerCase();
  return BROWSER_FALLBACK_MODES.includes(normalized as BrowserFallbackMode)
    ? (normalized as BrowserFallbackMode)
    : "auto";
}

function canLaunchBrowserAutomatically(
  mode: BrowserFallbackMode,
  env: NodeJS.ProcessEnv,
): boolean {
  if (mode === "force") return true;
  if (mode !== "auto") return false;
  if (
    env.CI ||
    env.HEADLESS ||
    env.SSH_CONNECTION ||
    env.SSH_CLIENT ||
    env.NODE_ENV === "test"
  ) {
    return false;
  }
  if (process.platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    return false;
  }
  return true;
}

/** Open only a server-generated loopback URL without invoking a shell. */
export async function openLocalBrowser(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== LOOPBACK_HOST ||
    !parsed.pathname.startsWith(`${HTTP_ENDPOINTS.draw}/`)
  ) {
    return false;
  }

  const command =
    process.platform === "darwin"
      ? "/usr/bin/open"
      : process.platform === "win32"
        ? "explorer.exe"
        : "xdg-open";

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    const finish = (opened: boolean): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(opened);
    };
    try {
      const child = spawn(command, [url], {
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      });
      child.once("error", () => finish(false));
      child.once("close", (code) => finish(code === 0));
      timeout = setTimeout(() => {
        child.kill();
        finish(false);
      }, 10_000);
      child.unref();
    } catch {
      finish(false);
    }
  });
}

/**
 * Local capability handoff for stdio MCP clients without embedded-App support.
 * The listener is lazy, loopback-only, normally unreferenced outside an active
 * confirmation waiter, and exposes no general API.
 */
export class LocalBrowserHandoff implements VisualBrowserFallback {
  public readonly force: boolean;

  private readonly app = express();
  private readonly secret = randomBytes(32);
  private readonly records = new Map<string, HandoffRecord>();
  private readonly openedDraws = new Set<string>();
  private readonly mode: BrowserFallbackMode;
  private readonly port: number;
  private readonly opener: BrowserOpener;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => number;
  private httpServer?: HttpServer;
  private startPromise?: Promise<void>;
  private baseUrl?: string;
  private activeWaiterCount = 0;
  private readonly idleWaiters = new Set<() => void>();
  private pendingWaiterUnref?: NodeJS.Immediate;

  constructor(
    private readonly tarotServer: TarotServer,
    options: LocalBrowserHandoffOptions = {},
  ) {
    this.mode = options.mode ?? "auto";
    this.force = this.mode === "force";
    this.port = options.port ?? 0;
    this.opener = options.opener ?? openLocalBrowser;
    this.env = options.env ?? process.env;
    this.now = options.now ?? Date.now;
    this.setupMiddleware();
    this.setupRoutes();
  }

  public async open(
    draw: VisualBeginPayload,
  ): Promise<BrowserHandoffOpenResult> {
    this.sweep();
    const token = this.tokenForDraw(draw.drawId);
    const tokenHash = sha256(token);
    const reused = this.records.has(tokenHash);
    const expiresAt = Date.parse(draw.expiresAt);
    const existing = this.records.get(tokenHash);
    const normalizedExpiry = Number.isFinite(expiresAt)
      ? expiresAt
      : this.now();
    const record: HandoffRecord = existing ?? {
      drawId: draw.drawId,
      beginPayload: draw,
      expiresAt: normalizedExpiry,
      retainUntil: normalizedExpiry + CONFIRMED_RETENTION_MS,
      waiters: new Set(),
      confirmationsInFlight: 0,
    };
    record.beginPayload = draw;
    record.expiresAt = normalizedExpiry;
    if (!record.confirmed) {
      record.retainUntil = normalizedExpiry + CONFIRMED_RETENTION_MS;
    }
    this.records.set(tokenHash, record);
    this.scheduleExpiration(record);
    await this.start();
    const url = `${this.baseUrl}${HTTP_ENDPOINTS.draw}/#handoff=${encodeURIComponent(token)}`;

    if (this.openedDraws.has(draw.drawId)) {
      return { url, opened: true, reused: true };
    }

    let opened = false;
    if (canLaunchBrowserAutomatically(this.mode, this.env)) {
      try {
        opened = await this.opener(url);
      } catch (error) {
        logger.warn("browser_fallback_open_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (opened) this.openedDraws.add(draw.drawId);

    logger.info("browser_fallback_ready", {
      port: new URL(this.baseUrl!).port,
      opened,
      reused,
    });
    return { url, opened, reused };
  }

  /**
   * Hold an MCP tool request open until the matching browser confirms its
   * selection. Every waiter receives the exact successful ToolResult cached by
   * the HTTP confirmation handler.
   */
  public waitForConfirmation(
    drawId: string,
    options: BrowserHandoffWaitOptions = {},
  ): Promise<Extract<ToolResult, { ok: true }>> {
    this.sweep();
    const record = this.recordForDraw(drawId);
    if (!record) {
      return Promise.reject(
        this.waitError(
          "NOT_FOUND",
          drawId,
          `Browser handoff for visual draw "${drawId}" was not found.`,
        ),
      );
    }
    if (record.confirmed) return Promise.resolve(record.confirmed);
    if (this.now() >= record.expiresAt) {
      this.expireRecord(record);
      return Promise.reject(
        this.waitError(
          "EXPIRED",
          drawId,
          `Visual draw "${drawId}" expired before browser confirmation.`,
        ),
      );
    }
    if (options.signal?.aborted) {
      return Promise.reject(
        this.waitError(
          "ABORTED",
          drawId,
          `Waiting for visual draw "${drawId}" confirmation was cancelled.`,
        ),
      );
    }

    return new Promise<Extract<ToolResult, { ok: true }>>((resolve, reject) => {
      const signal = options.signal;
      let settled = false;
      const cleanup = (): void => {
        record.waiters.delete(waiter);
        signal?.removeEventListener("abort", handleAbort);
        this.releaseWaiterReference();
      };
      const waiter: HandoffWaiter = {
        resolve: (result) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        },
        reject: (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        },
      };
      const handleAbort = (): void => {
        waiter.reject(
          this.waitError(
            "ABORTED",
            drawId,
            `Waiting for visual draw "${drawId}" confirmation was cancelled.`,
          ),
        );
      };

      record.waiters.add(waiter);
      this.retainWaiterReference();
      signal?.addEventListener("abort", handleAbort, { once: true });
      // Covers a signal aborted between the early check and listener setup.
      if (signal?.aborted) handleAbort();
    });
  }

  /** Whether at least one MCP tool call is waiting on browser confirmation. */
  public hasActiveWaiters(): boolean {
    return this.activeWaiterCount > 0;
  }

  /** Resolve once every currently active browser-confirmation waiter settles. */
  public waitUntilIdle(): Promise<void> {
    if (!this.hasActiveWaiters()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.idleWaiters.add(resolve);
    });
  }

  public async stop(): Promise<void> {
    if (this.pendingWaiterUnref) {
      clearImmediate(this.pendingWaiterUnref);
      this.pendingWaiterUnref = undefined;
    }
    for (const record of this.records.values()) {
      this.clearExpiration(record);
      this.rejectWaiters(
        record,
        this.waitError(
          "STOPPED",
          record.drawId,
          `Browser handoff stopped before visual draw "${record.drawId}" was confirmed.`,
        ),
      );
    }
    // Rejecting the last waiter schedules a deferred unref. Cancel it again
    // before this instance can be stopped and subsequently restarted.
    if (this.pendingWaiterUnref) {
      clearImmediate(this.pendingWaiterUnref);
      this.pendingWaiterUnref = undefined;
    }
    this.records.clear();
    this.openedDraws.clear();
    this.activeWaiterCount = 0;
    this.resolveIdleWaiters();
    // Rejecting the final waiter schedules a deferred unref. Cancel it before
    // clearing the server fields so a later explicit restart cannot inherit a
    // stale callback aimed at its new listener.
    if (this.pendingWaiterUnref) {
      clearImmediate(this.pendingWaiterUnref);
      this.pendingWaiterUnref = undefined;
    }
    const server = this.httpServer;
    this.httpServer = undefined;
    this.startPromise = undefined;
    this.baseUrl = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private tokenForDraw(drawId: string): string {
    return createHmac("sha256", this.secret).update(drawId).digest("base64url");
  }

  private recordForDraw(drawId: string): HandoffRecord | undefined {
    return this.records.get(sha256(this.tokenForDraw(drawId)));
  }

  private waitError(
    code: BrowserHandoffWaitErrorCode,
    _drawId: string,
    message: string,
  ): BrowserHandoffWaitError {
    return new BrowserHandoffWaitError(code, message);
  }

  private scheduleExpiration(record: HandoffRecord): void {
    this.clearExpiration(record);
    if (record.confirmed) return;
    const delay = Math.max(0, record.expiresAt - this.now());
    record.expirationTimer = setTimeout(() => {
      record.expirationTimer = undefined;
      if (record.confirmed) return;
      if (record.confirmationsInFlight > 0) {
        this.scheduleExpirationRetry(record);
        return;
      }
      this.expireRecord(record);
    }, delay);
    record.expirationTimer.unref();
  }

  private scheduleExpirationRetry(record: HandoffRecord): void {
    this.clearExpiration(record);
    record.expirationTimer = setTimeout(() => {
      record.expirationTimer = undefined;
      if (record.confirmed) return;
      if (record.confirmationsInFlight > 0) {
        this.scheduleExpirationRetry(record);
        return;
      }
      this.expireRecord(record);
    }, 25);
    record.expirationTimer.unref();
  }

  private clearExpiration(record: HandoffRecord): void {
    if (!record.expirationTimer) return;
    clearTimeout(record.expirationTimer);
    record.expirationTimer = undefined;
  }

  private expireRecord(record: HandoffRecord): void {
    if (record.confirmed || record.confirmationsInFlight > 0) return;
    this.clearExpiration(record);
    this.rejectWaiters(
      record,
      this.waitError(
        "EXPIRED",
        record.drawId,
        `Visual draw "${record.drawId}" expired before browser confirmation.`,
      ),
    );
  }

  private rejectWaiters(
    record: HandoffRecord,
    error: BrowserHandoffWaitError,
  ): void {
    for (const waiter of [...record.waiters]) waiter.reject(error);
  }

  /**
   * The loopback listener normally stays unreferenced so merely registering a
   * browser handoff cannot keep a stdio child alive. A pending tools/call is
   * different: some hosts half-close the server's stdin while they keep
   * reading stdout for the eventual result. Keep the listener referenced only
   * for that human-confirmation window.
   */
  private retainWaiterReference(): void {
    if (this.pendingWaiterUnref) {
      clearImmediate(this.pendingWaiterUnref);
      this.pendingWaiterUnref = undefined;
    }
    this.activeWaiterCount += 1;
    this.httpServer?.ref();
  }

  private releaseWaiterReference(): void {
    if (this.activeWaiterCount > 0) this.activeWaiterCount -= 1;
    if (this.activeWaiterCount > 0) return;
    this.resolveIdleWaiters();
    if (this.pendingWaiterUnref) return;

    // Resolving a waiter resumes the MCP request handler in a microtask. Keep
    // one event-loop turn referenced so its JSON-RPC response can be queued to
    // stdout before a half-closed stdio process is allowed to exit naturally.
    this.pendingWaiterUnref = setImmediate(() => {
      this.pendingWaiterUnref = undefined;
      if (this.activeWaiterCount === 0) this.httpServer?.unref();
    });
  }

  private resolveIdleWaiters(): void {
    if (this.activeWaiterCount > 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }

  private resolveWaiters(
    record: HandoffRecord,
    result: Extract<ToolResult, { ok: true }>,
  ): void {
    for (const waiter of [...record.waiters]) waiter.resolve(result);
  }

  private async start(): Promise<void> {
    if (this.httpServer && this.baseUrl) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = new Promise<void>((resolve, reject) => {
      const server = this.app.listen(this.port, LOOPBACK_HOST);
      this.httpServer = server;
      const onError = (error: Error): void => {
        this.httpServer = undefined;
        this.startPromise = undefined;
        reject(error);
      };
      server.once("error", onError);
      server.once("listening", () => {
        server.off("error", onError);
        const address = server.address();
        if (!address || typeof address === "string") {
          onError(new Error("Browser fallback did not receive a TCP address."));
          return;
        }
        this.baseUrl = `http://${LOOPBACK_HOST}:${address.port}`;
        server.unref();
        resolve();
      });
    });
    return this.startPromise;
  }

  private setupMiddleware(): void {
    this.app.disable("x-powered-by");
    this.app.use((req, res, next) => {
      if (!this.baseUrl) {
        res.status(503).json({ error: "Browser handoff is starting" });
        return;
      }
      if (
        !timingSafeStringEqual(req.headers.host ?? "", new URL(this.baseUrl).host)
      ) {
        res.status(403).json({ error: "Forbidden: host not allowed" });
        return;
      }
      if (
        req.method !== "GET" &&
        !timingSafeStringEqual(req.headers.origin ?? "", this.baseUrl)
      ) {
        res.status(403).json({ error: "Forbidden: origin not allowed" });
        return;
      }
      next();
    });
    this.app.use(
      [
        HTTP_ENDPOINTS.api.visualHandoffResolve,
        HTTP_ENDPOINTS.api.visualHandoffConfirm,
      ],
      rateLimit({
        windowMs: 60_000,
        limit: 120,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
    this.app.use(express.json({ limit: "32kb" }));
  }

  private setupRoutes(): void {
    mountVisualWebAssets(this.app, MODULE_DIRECTORY, {
      htmlCacheControl: "no-store",
      missingBuildMessage:
        "Visual reading Web build is not available. Run npm run build.",
      setDocumentHeaders: (res) => this.setDocumentHeaders(res),
    });

    this.app.post(HTTP_ENDPOINTS.api.visualHandoffResolve, (req, res, next) => {
      void this.handleResolve(req, res).catch(next);
    });
    this.app.post(HTTP_ENDPOINTS.api.visualHandoffConfirm, (req, res, next) => {
      void this.handleConfirm(req, res).catch(next);
    });

    this.app.use(
      (
        error: Error & { type?: string },
        _req: Request,
        res: Response,
        _next: NextFunction,
      ) => {
        if (res.headersSent) return;
        if (error.type === "entity.parse.failed") {
          res.status(400).json({ error: "Invalid JSON in request body" });
          return;
        }
        if (error.type === "entity.too.large") {
          res.status(413).json({ error: "Request body too large" });
          return;
        }
        logger.error("browser_handoff_request_error", {
          error: error.message,
        });
        res.status(500).json({ error: "Internal server error" });
      },
    );
  }

  private setDocumentHeaders(res: Response): void {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
  }

  private authenticate(req: Request, res: Response): HandoffRecord | undefined {
    this.sweep();
    const header = req.headers.authorization ?? "";
    const prefix = "Tarot-Handoff ";
    if (!header.startsWith(prefix)) {
      res.status(401).json({ error: "Missing browser handoff token" });
      return undefined;
    }
    const record = this.records.get(sha256(header.slice(prefix.length)));
    if (!record) {
      res.status(404).json({ error: "Browser handoff was not found" });
      return undefined;
    }
    if (!record.confirmed && this.now() >= record.expiresAt) {
      res
        .status(410)
        .json({ error: "Visual draw expired; start a new reading" });
      return undefined;
    }
    return record;
  }

  private async handleResolve(req: Request, res: Response): Promise<void> {
    const record = this.authenticate(req, res);
    if (!record) return;
    res.setHeader("Cache-Control", "no-store");
    if (record.confirmed) {
      res.json({
        result: record.confirmed.text,
        draw: record.beginPayload,
        ...(record.confirmed.structured
          ? { reading: record.confirmed.structured }
          : {}),
      });
      return;
    }
    res.json({ result: "Visual reading ready", draw: record.beginPayload });
  }

  private async handleConfirm(req: Request, res: Response): Promise<void> {
    const record = this.authenticate(req, res);
    if (!record) return;
    if (
      typeof req.body !== "object" ||
      req.body === null ||
      Array.isArray(req.body)
    ) {
      res
        .status(400)
        .json({ error: "Visual confirmation must be a JSON object" });
      return;
    }
    record.confirmationsInFlight += 1;
    let result: ToolResult;
    try {
      result = await this.tarotServer.executeTool(
        TOOL_NAMES.confirmVisualReading,
        {
          drawId: record.drawId,
          selectedSlotIds: (req.body as Record<string, unknown>)
            .selectedSlotIds,
        },
      );
    } finally {
      record.confirmationsInFlight -= 1;
    }
    res.setHeader("Cache-Control", "no-store");
    if (!result.ok) {
      if (this.now() >= record.expiresAt) this.expireRecord(record);
      res.status(result.httpStatus ?? 400).json({
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
      });
      return;
    }
    record.confirmed = result;
    record.retainUntil = this.now() + CONFIRMED_RETENTION_MS;
    this.clearExpiration(record);
    try {
      await this.sendJsonAndWaitForCompletion(res, {
        result: result.text,
        ...(result.structured ? { reading: result.structured } : {}),
      });
    } finally {
      // Let the browser receive (or explicitly abandon) its HTTP response
      // before the pending MCP request may complete and tear down stdio.
      this.resolveWaiters(record, result);
    }
  }

  private sendJsonAndWaitForCompletion(
    res: Response,
    body: Record<string, unknown>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        res.off("finish", handleComplete);
        res.off("close", handleComplete);
        res.off("error", handleError);
      };
      const handleComplete = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const handleError = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      res.once("finish", handleComplete);
      res.once("close", handleComplete);
      res.once("error", handleError);
      try {
        res.json(body);
      } catch (error) {
        handleError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private sweep(): void {
    const now = this.now();
    for (const [tokenHash, record] of this.records.entries()) {
      if (
        !record.confirmed &&
        record.confirmationsInFlight === 0 &&
        now >= record.expiresAt
      ) {
        this.expireRecord(record);
      }
      if (now < record.retainUntil) continue;
      this.clearExpiration(record);
      this.rejectWaiters(
        record,
        this.waitError(
          "EXPIRED",
          record.drawId,
          `Visual draw "${record.drawId}" expired before browser confirmation.`,
        ),
      );
      this.records.delete(tokenHash);
      this.openedDraws.delete(record.drawId);
    }
  }
}

export function createLocalBrowserHandoff(
  tarotServer: TarotServer,
  env: NodeJS.ProcessEnv = process.env,
): LocalBrowserHandoff | undefined {
  const mode = parseBrowserFallbackMode(env.TAROT_BROWSER_FALLBACK);
  if (mode === "off") return undefined;
  return new LocalBrowserHandoff(tarotServer, {
    mode,
    port: parseFallbackPort(env.TAROT_BROWSER_FALLBACK_PORT),
    env,
  });
}
