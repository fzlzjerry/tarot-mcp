import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { HTTP_ENDPOINTS, MCP_SERVER_INFO, TOOL_NAMES } from "./public-api.js";
import { createMcpProtocolServer } from "./protocol-server.js";
import { TarotServer, ToolResult } from "./tarot-service.js";
import { logger } from "../tarot/shared/logger.js";

interface McpTransportSession<TTransport> {
  server: Server;
  transport: TTransport;
  lastActivity: number;
  /** In-flight request/stream count; sessions with active work are not swept. */
  activeRequests: number;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function stripPort(host: string): string {
  // "[::1]:3000" -> "[::1]", "example.com:3000" -> "example.com"
  const match = /^(\[[^\]]+\]|[^:]+)/.exec(host);
  return match ? match[1] : host;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * HTTP Server for Tarot MCP with modern Streamable HTTP and legacy SSE support.
 */
export class TarotHttpServer {
  /** Streamable HTTP sessions idle longer than this are reaped. */
  private static readonly SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  private static readonly SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
  /** Cap on concurrent transport sessions per map (env-tunable). */
  private static readonly DEFAULT_MAX_TRANSPORT_SESSIONS = 100;

  private readonly app: express.Application;
  private readonly tarotServer: TarotServer;
  private readonly port: number;
  private readonly host: string;
  /** Extra allowed origins beyond localhost (ALLOWED_ORIGINS env, "*" = any). */
  private readonly allowedOrigins: string[];
  private readonly allowAllOrigins: boolean;
  /** When non-empty, the Host header must match one of these (ALLOWED_HOSTS env). */
  private readonly allowedHosts: string[];
  /** When set (MCP_AUTH_TOKEN env), all MCP and REST endpoints require it. */
  private readonly authToken?: string;
  private readonly maxTransportSessions: number;
  private httpServer?: HttpServer;
  private sessionSweepTimer?: NodeJS.Timeout;
  private readonly streamableSessions = new Map<
    string,
    McpTransportSession<StreamableHTTPServerTransport>
  >();
  private readonly sseSessions = new Map<
    string,
    McpTransportSession<SSEServerTransport>
  >();

  constructor(tarotServer: TarotServer, port: number = 3000, host: string = "0.0.0.0") {
    this.port = port;
    this.host = host;
    this.app = express();
    this.tarotServer = tarotServer;

    this.allowedOrigins = parseCsvEnv(process.env.ALLOWED_ORIGINS);
    this.allowAllOrigins = this.allowedOrigins.includes("*");
    this.allowedHosts = parseCsvEnv(process.env.ALLOWED_HOSTS).map(stripPort);
    this.authToken = process.env.MCP_AUTH_TOKEN || undefined;
    this.maxTransportSessions =
      Number(process.env.MCP_MAX_TRANSPORT_SESSIONS) ||
      TarotHttpServer.DEFAULT_MAX_TRANSPORT_SESSIONS;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Origins that browsers may use. Non-browser clients send no Origin header
   * and pass. Localhost origins are always allowed; others need to be listed
   * in ALLOWED_ORIGINS (or "*" to allow any). This is the MCP-recommended
   * DNS-rebinding mitigation.
   */
  private isOriginAllowed(origin: string): boolean {
    return (
      this.allowAllOrigins ||
      this.allowedOrigins.includes(origin) ||
      isLocalOrigin(origin)
    );
  }

  private isHostAllowed(hostHeader: string | undefined): boolean {
    if (this.allowedHosts.length === 0) {
      return true;
    }
    if (!hostHeader) {
      return false;
    }
    const hostname = stripPort(hostHeader);
    return LOCAL_HOSTNAMES.has(hostname) || this.allowedHosts.includes(hostname);
  }

  /**
   * Map body-parser failures to the JSON/JSON-RPC error contract instead of
   * Express's default HTML error page.
   */
  private setupErrorHandling(): void {
    this.app.use(
      (
        err: Error & { type?: string },
        req: Request,
        res: Response,
        next: express.NextFunction,
      ) => {
        if (res.headersSent) {
          next(err);
          return;
        }

        if (err.type === "entity.parse.failed") {
          const isMcpPath =
            req.path === HTTP_ENDPOINTS.streamableHttp ||
            req.path === HTTP_ENDPOINTS.legacyMessages;
          if (isMcpPath) {
            this.sendJsonRpcError(res, 400, -32700, "Parse error: invalid JSON");
          } else {
            res.status(400).json({ error: "Invalid JSON in request body" });
          }
          return;
        }

        if (err.type === "entity.too.large") {
          res.status(413).json({ error: "Request body too large" });
          return;
        }

        logger.error("unhandled_request_error", { error: err.message });
        res.status(500).json({ error: "Internal server error" });
      },
    );
  }

  /**
   * Reap transport sessions whose clients vanished without cleanly closing;
   * otherwise the session maps grow without bound. Applies to Streamable
   * HTTP (no DELETE received) and legacy SSE (no 'close' event fired).
   */
  private sweepIdleSessions(): void {
    const cutoff = Date.now() - TarotHttpServer.SESSION_IDLE_TIMEOUT_MS;
    const maps = [this.streamableSessions, this.sseSessions] as const;
    for (const sessions of maps) {
      for (const [sessionId, session] of sessions.entries()) {
        if (session.activeRequests === 0 && session.lastActivity < cutoff) {
          sessions.delete(sessionId);
          void session.server.close().catch((error) => {
            logger.error("session_close_failed", { error: String(error) });
          });
        }
      }
    }
  }

  /**
   * Setup Express middleware.
   */
  private setupMiddleware(): void {
    // Request logging with a correlation id on every response.
    this.app.use((req: Request, res: Response, next: express.NextFunction) => {
      const requestId = randomUUID();
      const start = Date.now();
      res.setHeader("X-Request-Id", requestId);
      res.on("finish", () => {
        logger.info("http_request", {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
        });
      });
      next();
    });

    this.app.use(
      cors({
        origin: (origin, callback) => {
          callback(null, !origin || this.isOriginAllowed(origin));
        },
        exposedHeaders: [
          "Mcp-Session-Id",
          "Mcp-Protocol-Version",
          "mcp-session-id",
          "mcp-protocol-version",
        ],
      }),
    );

    // Origin/Host validation on everything except the health endpoint, so
    // container healthchecks keep working regardless of configuration.
    this.app.use((req: Request, res: Response, next: express.NextFunction) => {
      if (req.path === HTTP_ENDPOINTS.health) {
        next();
        return;
      }
      const origin = req.headers.origin;
      if (origin && !this.isOriginAllowed(origin)) {
        res.status(403).json({ error: "Forbidden: origin not allowed" });
        return;
      }
      if (!this.isHostAllowed(req.headers.host)) {
        res.status(403).json({ error: "Forbidden: host not allowed" });
        return;
      }
      next();
    });

    const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 120;
    const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
    this.app.use(
      ["/api", HTTP_ENDPOINTS.streamableHttp, HTTP_ENDPOINTS.legacySse, HTTP_ENDPOINTS.legacyMessages],
      rateLimit({
        windowMs: rateLimitWindowMs,
        limit: rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );

    // Bearer auth on all MCP and REST endpoints when MCP_AUTH_TOKEN is set.
    // /health stays open for container healthchecks.
    this.app.use((req: Request, res: Response, next: express.NextFunction) => {
      if (!this.authToken || req.path === HTTP_ENDPOINTS.health) {
        next();
        return;
      }
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
      if (!token || !timingSafeStringEqual(token, this.authToken)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });

    this.app.use(express.json({ limit: "4mb" }));
  }

  /**
   * Setup HTTP routes.
   */
  private setupRoutes(): void {
    this.app.get(HTTP_ENDPOINTS.health, (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        endpoints: HTTP_ENDPOINTS,
      });
    });

    this.app.get(HTTP_ENDPOINTS.api.info, (req, res) => {
      res.json({
        name: MCP_SERVER_INFO.name,
        version: MCP_SERVER_INFO.version,
        capabilities: ["tools"],
        tools: this.tarotServer.getAvailableTools(),
        endpoints: HTTP_ENDPOINTS,
      });
    });

    this.app.get(HTTP_ENDPOINTS.api.spreads, (req, res) => {
      res.json({
        spreads: this.tarotServer.getAvailableSpreads(),
      });
    });

    this.app.get(HTTP_ENDPOINTS.api.cards, async (req, res) => {
      try {
        const result = await this.tarotServer.executeTool(
          TOOL_NAMES.listAllCards,
          {
            category: this.getQueryParam(req, "category"),
          },
        );
        this.sendToolResult(res, result);
      } catch (error) {
        this.sendHttpError(res, error);
      }
    });

    this.app.get(`${HTTP_ENDPOINTS.api.cards}/:cardName`, async (req, res) => {
      try {
        const result = await this.tarotServer.executeTool(
          TOOL_NAMES.getCardInfo,
          {
            cardName: req.params.cardName,
            orientation: this.getQueryParam(req, "orientation"),
          },
        );
        this.sendToolResult(res, result);
      } catch (error) {
        this.sendHttpError(res, error);
      }
    });

    this.app.post(HTTP_ENDPOINTS.streamableHttp, (req, res) => {
      void this.handleStreamablePost(req, res);
    });
    this.app.get(HTTP_ENDPOINTS.streamableHttp, (req, res) => {
      void this.handleStreamableSessionRequest(req, res);
    });
    this.app.delete(HTTP_ENDPOINTS.streamableHttp, (req, res) => {
      void this.handleStreamableSessionRequest(req, res);
    });

    this.app.get(HTTP_ENDPOINTS.legacySse, (req, res) => {
      void this.handleLegacySse(req, res);
    });
    this.app.post(HTTP_ENDPOINTS.legacyMessages, (req, res) => {
      void this.handleLegacySseMessage(req, res);
    });

    this.app.post(HTTP_ENDPOINTS.api.reading, async (req, res) => {
      try {
        const { spreadType, question, sessionId } = req.body;
        const result = await this.tarotServer.executeTool(
          TOOL_NAMES.performReading,
          {
            spreadType,
            question,
            sessionId,
          },
        );
        this.sendToolResult(res, result, "reading");
      } catch (error) {
        this.sendHttpError(res, error);
      }
    });

    this.app.post(HTTP_ENDPOINTS.api.customSpread, async (req, res) => {
      try {
        const { spreadName, description, positions, question, sessionId } =
          req.body;
        const result = await this.tarotServer.executeTool(
          TOOL_NAMES.createCustomSpread,
          {
            spreadName,
            description,
            positions,
            question,
            sessionId,
          },
        );
        this.sendToolResult(res, result, "reading");
      } catch (error) {
        this.sendHttpError(res, error);
      }
    });
  }

  /**
   * Send a tool result, mapping failed executions to HTTP 400. When the
   * tool produced a structured payload it is included under structuredKey.
   */
  private sendToolResult(
    res: Response,
    result: ToolResult,
    structuredKey = "structured",
  ): void {
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      result: result.text,
      ...(result.structured !== undefined
        ? { [structuredKey]: result.structured }
        : {}),
    });
  }

  private async handleStreamablePost(
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionId = this.getHeader(req, "mcp-session-id");

    try {
      const existingSession = sessionId
        ? this.streamableSessions.get(sessionId)
        : undefined;

      if (existingSession) {
        await this.handleSessionRequest(existingSession, req, res);
        return;
      }

      if (sessionId) {
        // Unknown/expired session: the MCP Streamable HTTP spec requires 404
        // so clients know to re-initialize.
        this.sendJsonRpcError(res, 404, -32001, "Session not found");
        return;
      }

      if (!isInitializeRequest(req.body)) {
        this.sendJsonRpcError(
          res,
          400,
          -32000,
          "Bad Request: No valid session ID provided",
        );
        return;
      }

      if (this.streamableSessions.size >= this.maxTransportSessions) {
        this.sendJsonRpcError(
          res,
          429,
          -32000,
          "Too many concurrent sessions; try again later",
        );
        return;
      }

      const server = createMcpProtocolServer(this.tarotServer);
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (initializedSessionId) => {
          this.streamableSessions.set(initializedSessionId, {
            server,
            transport,
            lastActivity: Date.now(),
            activeRequests: 0,
          });
        },
        onsessionclosed: (closedSessionId) => {
          const session = this.streamableSessions.get(closedSessionId);
          this.streamableSessions.delete(closedSessionId);
          void session?.server.close().catch((error) => {
            logger.error("session_close_failed", { error: String(error) });
          });
        },
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("mcp_request_error", { error: String(error) });
      this.sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }

  private async handleStreamableSessionRequest(
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionId = this.getHeader(req, "mcp-session-id");

    if (!sessionId) {
      res.status(400).send("Missing MCP session ID");
      return;
    }

    const session = this.streamableSessions.get(sessionId);
    if (!session) {
      // 404 per the MCP Streamable HTTP spec so clients re-initialize.
      res.status(404).send("Session not found");
      return;
    }

    try {
      await this.handleSessionRequest(session, req, res);
    } catch (error) {
      logger.error("mcp_session_request_error", { error: String(error) });
      this.sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }

  /**
   * Run a transport request while holding the session's in-flight counter so
   * the idle sweep never severs a session with an open request or SSE stream.
   * For SSE responses handleRequest resolves when the stream is set up, so we
   * also wait for the response to close before releasing the counter.
   */
  private async handleSessionRequest(
    session: McpTransportSession<StreamableHTTPServerTransport>,
    req: Request,
    res: Response,
  ): Promise<void> {
    session.lastActivity = Date.now();
    session.activeRequests++;
    try {
      const parsedBody = req.method === "POST" ? req.body : undefined;
      await session.transport.handleRequest(req, res, parsedBody);
      if (!res.writableEnded) {
        await new Promise<void>((resolve) => res.once("close", resolve));
      }
    } finally {
      session.activeRequests--;
      session.lastActivity = Date.now();
    }
  }

  private async handleLegacySse(req: Request, res: Response): Promise<void> {
    if (this.sseSessions.size >= this.maxTransportSessions) {
      res.status(429).json({ error: "Too many concurrent sessions; try again later" });
      return;
    }

    try {
      const server = createMcpProtocolServer(this.tarotServer);
      const transport = new SSEServerTransport(
        HTTP_ENDPOINTS.legacyMessages,
        res,
      );
      const sessionId = transport.sessionId;

      this.sseSessions.set(sessionId, {
        server,
        transport,
        lastActivity: Date.now(),
        activeRequests: 0,
      });
      res.on("close", () => {
        this.sseSessions.delete(sessionId);
        void server.close().catch((error) => {
          logger.error("session_close_failed", { transport: "sse", error: String(error) });
        });
      });

      await server.connect(transport);
    } catch (error) {
      logger.error("sse_connection_error", { error: String(error) });
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to establish SSE connection" });
      } else {
        res.end();
      }
    }
  }

  private async handleLegacySseMessage(
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionId = String(req.query.sessionId || "");
    const session = this.sseSessions.get(sessionId);

    if (!session) {
      res.status(400).send("No SSE transport found for sessionId");
      return;
    }

    session.lastActivity = Date.now();
    try {
      await session.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error("sse_message_error", { error: String(error) });
      if (!res.headersSent) {
        res.status(500).send("Failed to handle SSE message");
      }
    }
  }

  private getHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return typeof value === "string" ? value : undefined;
  }

  private getQueryParam(req: Request, name: string): string | undefined {
    const value = req.query[name];
    return typeof value === "string" ? value : undefined;
  }

  private sendJsonRpcError(
    res: Response,
    status: number,
    code: number,
    message: string,
  ): void {
    if (res.headersSent) {
      return;
    }

    res.status(status).json({
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    });
  }

  private sendHttpError(res: Response, error: unknown): void {
    // Log the real error server-side; never leak internals to clients.
    logger.error("rest_endpoint_error", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "Internal server error" });
  }

  /**
   * Start the HTTP server.
   */
  public async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, this.host);
      this.httpServer = server;

      const onError = (error: Error) => {
        this.httpServer = undefined;
        reject(error);
      };

      server.once("error", onError);
      server.once("listening", () => {
        server.off("error", onError);
        this.sessionSweepTimer = setInterval(
          () => this.sweepIdleSessions(),
          TarotHttpServer.SESSION_SWEEP_INTERVAL_MS,
        );
        this.sessionSweepTimer.unref();
        logger.info("http_server_started", {
          url: `http://${this.host}:${this.port}`,
          mcpEndpoint: HTTP_ENDPOINTS.streamableHttp,
          sseEndpoint: HTTP_ENDPOINTS.legacySse,
          messagesEndpoint: HTTP_ENDPOINTS.legacyMessages,
          health: HTTP_ENDPOINTS.health,
          apiInfo: HTTP_ENDPOINTS.api.info,
          auth: this.authToken ? "bearer" : "none",
        });
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server and close active MCP sessions.
   */
  public async stop(): Promise<void> {
    if (this.sessionSweepTimer) {
      clearInterval(this.sessionSweepTimer);
      this.sessionSweepTimer = undefined;
    }

    for (const session of [
      ...this.streamableSessions.values(),
      ...this.sseSessions.values(),
    ]) {
      await session.server.close();
    }
    this.streamableSessions.clear();
    this.sseSessions.clear();

    const server = this.httpServer;
    if (!server) {
      return;
    }

    this.httpServer = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
