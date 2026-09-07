import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { logger } from "../../tarot/shared/logger.js";
import { HTTP_ENDPOINTS, MCP_SERVER_INFO, TOOL_NAMES } from "../public-api.js";
import type { TarotServer, ToolResult } from "../tarot-service.js";

function query(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}

function sendToolResult(
  res: Response,
  result: ToolResult,
  key: string,
  status: number,
): void {
  if (!result.ok) {
    res.status(result.httpStatus ?? 400).json({
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
    });
    return;
  }
  res.status(status).json({
    result: result.text,
    ...(result.structured !== undefined ? { [key]: result.structured } : {}),
  });
}

/** REST adapters share validation and error handling; domain work stays in the service. */
export function createApiRouter(tarotServer: TarotServer): Router {
  const router = Router();

  const toolRoute =
    (
      name: string | ((req: Request) => string),
      args: (req: Request) => Record<string, unknown>,
      key = "structured",
      status = 200,
    ): RequestHandler =>
    async (req, res) => {
      try {
        const result = await tarotServer.executeTool(
          typeof name === "string" ? name : name(req),
          args(req),
        );
        sendToolResult(res, result, key, status);
      } catch (error) {
        logger.error("rest_endpoint_error", {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Internal server error" });
      }
    };

  router.get(HTTP_ENDPOINTS.api.info, (_req, res) => {
    res.json({
      name: MCP_SERVER_INFO.name,
      version: MCP_SERVER_INFO.version,
      capabilities: ["tools", "resources", "prompts"],
      tools: tarotServer.getAvailableTools(),
      endpoints: HTTP_ENDPOINTS,
    });
  });

  router.get(HTTP_ENDPOINTS.api.spreads, (req, res) => {
    const language = query(req, "language") ?? "en";
    if (language !== "en" && language !== "zh") {
      res
        .status(400)
        .json({ error: 'Invalid language; expected "en" or "zh"' });
      return;
    }
    res.json({ spreads: tarotServer.getAvailableSpreads(language) });
  });

  router.get(
    HTTP_ENDPOINTS.api.cards,
    toolRoute(TOOL_NAMES.listAllCards, (req) => ({
      category: query(req, "category"),
      language: query(req, "language"),
    })),
  );
  router.get(
    `${HTTP_ENDPOINTS.api.cards}/:cardName`,
    toolRoute(TOOL_NAMES.getCardInfo, (req) => ({
      cardName: req.params.cardName,
      orientation: query(req, "orientation"),
      language: query(req, "language"),
    })),
  );

  // Validate before destructuring bodies, including the older ergonomic routes.
  const jsonObject: RequestHandler = (req, res, next) => {
    if (
      typeof req.body !== "object" ||
      req.body === null ||
      Array.isArray(req.body)
    ) {
      res.status(400).json({ error: "Tool arguments must be a JSON object" });
      return;
    }
    next();
  };

  router.post(
    HTTP_ENDPOINTS.api.reading,
    jsonObject,
    toolRoute(
      TOOL_NAMES.performReading,
      (req) => {
        const { spreadType, question, sessionId, language } = req.body;
        return { spreadType, question, sessionId, language };
      },
      "reading",
    ),
  );
  router.post(
    HTTP_ENDPOINTS.api.customSpread,
    jsonObject,
    toolRoute(
      TOOL_NAMES.createCustomSpread,
      (req) => {
        const {
          spreadName,
          description,
          positions,
          question,
          sessionId,
          language,
        } = req.body;
        return {
          spreadName,
          description,
          positions,
          question,
          sessionId,
          language,
        };
      },
      "reading",
    ),
  );
  router.post(
    HTTP_ENDPOINTS.api.visualReadings,
    jsonObject,
    toolRoute(TOOL_NAMES.beginVisualReading, (req) => req.body, "draw", 201),
  );
  router.post(
    `${HTTP_ENDPOINTS.api.visualReadings}/:drawId/confirm`,
    jsonObject,
    toolRoute(
      TOOL_NAMES.confirmVisualReading,
      (req) => ({ ...req.body, drawId: req.params.drawId }),
      "reading",
    ),
  );

  router.post(
    `${HTTP_ENDPOINTS.api.tools}/:toolName`,
    (req, res, next) => {
      if (
        !tarotServer
          .getAvailableTools()
          .some((tool) => tool.name === req.params.toolName)
      ) {
        res.status(404).json({ error: `Unknown tool: ${req.params.toolName}` });
        return;
      }
      next();
    },
    jsonObject,
    toolRoute(
      (req) => req.params.toolName,
      (req) => req.body,
    ),
  );

  return router;
}
