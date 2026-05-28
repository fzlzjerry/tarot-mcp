import cors from "cors";
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { HTTP_ENDPOINTS, MCP_SERVER_INFO, TOOL_NAMES } from "./public-api.js";
import { createMcpProtocolServer } from "./protocol-server.js";
import { TarotServer } from "./tarot-service.js";

interface McpTransportSession<TTransport> {
  server: Server;
  transport: TTransport;
}

/**
 * HTTP Server for Tarot MCP with modern Streamable HTTP and legacy SSE support.
 */
export class TarotHttpServer {
  private readonly app: express.Application;
  private readonly tarotServer: TarotServer;
  private readonly port: number;
  private httpServer?: HttpServer;
  private readonly streamableSessions = new Map<
    string,
    McpTransportSession<StreamableHTTPServerTransport>
  >();
  private readonly sseSessions = new Map<
    string,
    McpTransportSession<SSEServerTransport>
  >();

  constructor(tarotServer: TarotServer, port: number = 3000) {
    this.port = port;
    this.app = express();
    this.tarotServer = tarotServer;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware.
   */
  private setupMiddleware(): void {
    this.app.use(
      cors({
        exposedHeaders: [
          "Mcp-Session-Id",
          "Mcp-Protocol-Version",
          "mcp-session-id",
          "mcp-protocol-version",
        ],
      }),
    );
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
        res.json({ result });
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
        res.json({ result });
      } catch (error) {
        this.sendHttpError(res, error);
      }
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
        await existingSession.transport.handleRequest(req, res, req.body);
        return;
      }

      if (sessionId || !isInitializeRequest(req.body)) {
        this.sendJsonRpcError(
          res,
          400,
          -32000,
          "Bad Request: No valid session ID provided",
        );
        return;
      }

      const server = createMcpProtocolServer(this.tarotServer);
      let transport!: StreamableHTTPServerTransport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (initializedSessionId) => {
          this.streamableSessions.set(initializedSessionId, {
            server,
            transport,
          });
        },
        onsessionclosed: (closedSessionId) => {
          const session = this.streamableSessions.get(closedSessionId);
          this.streamableSessions.delete(closedSessionId);
          void session?.server.close().catch((error) => {
            console.error("Error closing MCP session server:", error);
          });
        },
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling Streamable HTTP MCP request:", error);
      this.sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }

  private async handleStreamableSessionRequest(
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionId = this.getHeader(req, "mcp-session-id");
    const session = sessionId
      ? this.streamableSessions.get(sessionId)
      : undefined;

    if (!session) {
      res.status(400).send("Invalid or missing MCP session ID");
      return;
    }

    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling Streamable HTTP session request:", error);
      this.sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }

  private async handleLegacySse(req: Request, res: Response): Promise<void> {
    try {
      const server = createMcpProtocolServer(this.tarotServer);
      const transport = new SSEServerTransport(
        HTTP_ENDPOINTS.legacyMessages,
        res,
      );
      const sessionId = transport.sessionId;

      this.sseSessions.set(sessionId, { server, transport });
      res.on("close", () => {
        this.sseSessions.delete(sessionId);
        void server.close().catch((error) => {
          console.error("Error closing SSE MCP session server:", error);
        });
      });

      await server.connect(transport);
    } catch (error) {
      console.error("SSE connection error:", error);
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

    try {
      await session.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error("Error handling SSE message:", error);
      if (!res.headersSent) {
        res.status(500).send("Failed to handle SSE message");
      }
    }
  }

  private getHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name];
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
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Start the HTTP server.
   */
  public async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, "0.0.0.0");
      this.httpServer = server;

      const onError = (error: Error) => {
        this.httpServer = undefined;
        reject(error);
      };

      server.once("error", onError);
      server.once("listening", () => {
        server.off("error", onError);
        console.log(`Tarot MCP Server running on http://0.0.0.0:${this.port}`);
        console.log(
          `Streamable HTTP MCP endpoint: ${HTTP_ENDPOINTS.streamableHttp}`,
        );
        console.log(`Legacy SSE endpoint: ${HTTP_ENDPOINTS.legacySse}`);
        console.log(
          `Legacy SSE message endpoint: ${HTTP_ENDPOINTS.legacyMessages}`,
        );
        console.log(`Health check: ${HTTP_ENDPOINTS.health}`);
        console.log(`API info: ${HTTP_ENDPOINTS.api.info}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server and close active MCP sessions.
   */
  public async stop(): Promise<void> {
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
