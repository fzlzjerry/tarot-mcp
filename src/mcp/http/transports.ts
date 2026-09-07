import type { Application, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../../tarot/shared/logger.js";
import { HTTP_ENDPOINTS } from "../public-api.js";
import { createMcpProtocolServer } from "../protocol-server.js";
import type { TarotServer } from "../tarot-service.js";
import { sendJsonRpcError } from "./responses.js";

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

interface McpTransportSession<TTransport> {
  server: Server;
  transport: TTransport;
  lastActivity: number;
  /** In-flight request/stream count; sessions with active work are not swept. */
  activeRequests: number;
  /** Long-lived SSE response stream, when the transport holds one open. */
  stream?: Response;
}

/** Owns MCP connections and their lifetime, independently of REST and static assets. */
export class McpHttpTransports {
  private sessionSweepTimer?: NodeJS.Timeout;
  private readonly streamableSessions = new Map<
    string,
    McpTransportSession<StreamableHTTPServerTransport>
  >();
  private readonly sseSessions = new Map<
    string,
    McpTransportSession<SSEServerTransport>
  >();
  private readonly maxTransportSessions =
    Number(process.env.MCP_MAX_TRANSPORT_SESSIONS) || 100;

  constructor(private readonly tarotServer: TarotServer) {}

  get counts(): { streamableHttp: number; sse: number } {
    return {
      streamableHttp: this.streamableSessions.size,
      sse: this.sseSessions.size,
    };
  }

  mount(app: Application): void {
    app.post(HTTP_ENDPOINTS.streamableHttp, (req, res) => {
      void this.handleStreamablePost(req, res);
    });
    app.get(HTTP_ENDPOINTS.streamableHttp, (req, res) => {
      void this.handleStreamableSessionRequest(req, res);
    });
    app.delete(HTTP_ENDPOINTS.streamableHttp, (req, res) => {
      void this.handleStreamableSessionRequest(req, res);
    });

    app.get(HTTP_ENDPOINTS.legacySse, (req, res) => {
      void this.handleLegacySse(req, res);
    });
    app.post(HTTP_ENDPOINTS.legacyMessages, (req, res) => {
      void this.handleLegacySseMessage(req, res);
    });
  }

  start(): void {
    if (this.sessionSweepTimer) return;
    this.sessionSweepTimer = setInterval(
      () => this.sweepIdleSessions(),
      SESSION_SWEEP_INTERVAL_MS,
    );
    this.sessionSweepTimer.unref();
  }

  async stop(): Promise<void> {
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
  }

  /**
   * Reap transport sessions whose clients vanished without cleanly closing;
   * otherwise the session maps grow without bound. Applies to Streamable
   * HTTP (no DELETE received) and legacy SSE (no 'close' event fired).
   *
   * A session holding a live SSE stream is NOT idle even when it carries no
   * POST traffic: it gets a keepalive comment and a fresh timestamp instead
   * of being reaped, so only genuinely dead (zombie) connections are closed.
   */
  private sweepIdleSessions(): void {
    const cutoff = Date.now() - SESSION_IDLE_TIMEOUT_MS;
    const maps = [this.streamableSessions, this.sseSessions] as const;
    for (const sessions of maps) {
      for (const [sessionId, session] of sessions.entries()) {
        if (session.activeRequests > 0 || session.lastActivity >= cutoff) {
          continue;
        }
        if (
          session.stream &&
          !session.stream.writableEnded &&
          !session.stream.destroyed
        ) {
          try {
            session.stream.write(": keepalive\n\n");
            session.lastActivity = Date.now();
            continue;
          } catch {
            // Write failed — the socket is dead; fall through and reap.
          }
        }
        sessions.delete(sessionId);
        void session.server.close().catch((error) => {
          logger.error("session_close_failed", { error: String(error) });
        });
      }
    }
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
        sendJsonRpcError(res, 404, -32001, "Session not found");
        return;
      }

      if (!isInitializeRequest(req.body)) {
        sendJsonRpcError(
          res,
          400,
          -32000,
          "Bad Request: No valid session ID provided",
        );
        return;
      }

      if (this.streamableSessions.size >= this.maxTransportSessions) {
        sendJsonRpcError(
          res,
          429,
          -32000,
          "Too many concurrent sessions; try again later",
        );
        return;
      }

      const server = createMcpProtocolServer(this.tarotServer);
      const transport: StreamableHTTPServerTransport =
        new StreamableHTTPServerTransport({
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
      sendJsonRpcError(res, 500, -32603, "Internal server error");
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
      sendJsonRpcError(res, 500, -32603, "Internal server error");
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
      res
        .status(429)
        .json({ error: "Too many concurrent sessions; try again later" });
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
        stream: res,
      });
      res.on("close", () => {
        this.sseSessions.delete(sessionId);
        void server.close().catch((error) => {
          logger.error("session_close_failed", {
            transport: "sse",
            error: String(error),
          });
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
}
