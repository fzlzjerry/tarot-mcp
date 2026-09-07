import { McpHttpTransports } from "./http/transports.js";
import { sendJsonRpcError } from "./http/responses.js";
import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HTTP_ENDPOINTS } from "./public-api.js";
import {
  mountVisualWebAssets,
  timingSafeStringEqual,
} from "./static-assets.js";
import { TarotServer } from "./tarot-service.js";
import { logger } from "../tarot/shared/logger.js";
import { createApiRouter } from "./http/api-router.js";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DRAW_HEADERS = {
  "Cache-Control": "public, max-age=300",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
} as const;

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

/**
 * HTTP Server for Tarot MCP with modern Streamable HTTP and legacy SSE support.
 */
export class TarotHttpServer {
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
  private readonly transports: McpHttpTransports;
  private httpServer?: HttpServer;

  constructor(
    tarotServer: TarotServer,
    port: number = 3000,
    host: string = "0.0.0.0",
  ) {
    this.port = port;
    this.host = host;
    this.app = express();
    this.tarotServer = tarotServer;

    this.allowedOrigins = parseCsvEnv(process.env.ALLOWED_ORIGINS);
    this.allowAllOrigins = this.allowedOrigins.includes("*");
    this.allowedHosts = parseCsvEnv(process.env.ALLOWED_HOSTS).map(stripPort);
    this.authToken = process.env.MCP_AUTH_TOKEN || undefined;
    this.transports = new McpHttpTransports(tarotServer);

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

  /**
   * The bundled Web app calls the API on the same origin. Permit that exact
   * Origin/Host pair without requiring operators to duplicate their public
   * URL in ALLOWED_ORIGINS; cross-origin callers still use the allow-list.
   */
  private isSameOrigin(
    origin: string,
    hostHeader: string | undefined,
  ): boolean {
    if (!hostHeader) return false;
    try {
      return new URL(origin).host.toLowerCase() === hostHeader.toLowerCase();
    } catch {
      return false;
    }
  }

  private isRequestOriginAllowed(req: Request): boolean {
    const origin = req.headers.origin;
    return (
      !origin ||
      this.isOriginAllowed(origin) ||
      this.isSameOrigin(origin, req.headers.host)
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
    return (
      LOCAL_HOSTNAMES.has(hostname) || this.allowedHosts.includes(hostname)
    );
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
            sendJsonRpcError(res, 400, -32700, "Parse error: invalid JSON");
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
   * Serve only built, self-contained product assets before Bearer auth. The
   * interactive page itself is public; every API request it makes remains
   * behind the normal authentication middleware.
   */
  private setupPublicStaticAssets(): void {
    mountVisualWebAssets(this.app, MODULE_DIRECTORY, {
      htmlCacheControl: "public, max-age=300",
      missingBuildMessage:
        "Visual reading Web build is not available. Run npm run build:ui.",
      setDocumentHeaders: (res) => {
        for (const [name, value] of Object.entries(PUBLIC_DRAW_HEADERS)) {
          res.setHeader(name, value);
        }
      },
    });
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
      if (!this.isRequestOriginAllowed(req)) {
        res.status(403).json({ error: "Forbidden: origin not allowed" });
        return;
      }
      if (!this.isHostAllowed(req.headers.host)) {
        res.status(403).json({ error: "Forbidden: host not allowed" });
        return;
      }
      next();
    });

    this.setupPublicStaticAssets();

    const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 120;
    const rateLimitWindowMs =
      Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
    this.app.use(
      [
        "/api",
        HTTP_ENDPOINTS.streamableHttp,
        HTTP_ENDPOINTS.legacySse,
        HTTP_ENDPOINTS.legacyMessages,
      ],
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
        uptimeSeconds: Math.round(process.uptime()),
        readingSessions: this.tarotServer.getSessionCount(),
        transports: this.transports.counts,
        endpoints: HTTP_ENDPOINTS,
      });
    });

    this.transports.mount(this.app);
    this.app.use(createApiRouter(this.tarotServer));
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
        this.transports.start();
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
    await this.transports.stop();

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
