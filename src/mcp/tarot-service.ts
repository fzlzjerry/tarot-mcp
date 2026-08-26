import { TarotCardAnalytics } from "../tarot/cards/card-analytics.js";
import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotCardSearch } from "../tarot/cards/card-search.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { localizedSpread } from "../tarot/readings/spread-localizations.js";
import { TAROT_SPREADS } from "../tarot/readings/spreads.js";
import {
  VisualDrawError,
  VisualDrawManager,
} from "../tarot/readings/visual-draw-manager.js";
import { TarotDomainError } from "../tarot/shared/errors.js";
import { logger } from "../tarot/shared/logger.js";
import type { Language } from "../tarot/shared/types.js";
import { createToolHandlers } from "./handlers/index.js";
import { getToolDefinitions, type Tool } from "./tool-definitions.js";
import { toolError, type ToolResult } from "./tool-result.js";

export { toolError, toolOk, type ToolResult } from "./tool-result.js";

/**
 * Composition root for Tarot MCP tools. Transport lives in
 * TarotHttpServer / createMcpProtocolServer / LocalBrowserHandoff.
 */
export class TarotServer {
  private cardManager: TarotCardManager;
  private sessionManager: TarotSessionManager;
  private readonly toolHandlers: ReadonlyMap<
    string,
    (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>
  >;

  private constructor(cardManager: TarotCardManager) {
    this.cardManager = cardManager;
    this.sessionManager = new TarotSessionManager(
      process.env.SESSION_STORE_PATH,
    );
    const readingManager = new TarotReadingManager(
      this.cardManager,
      this.sessionManager,
    );
    this.toolHandlers = createToolHandlers({
      cardManager: this.cardManager,
      readingManager,
      sessionManager: this.sessionManager,
      visualDrawManager: new VisualDrawManager(this.cardManager, readingManager),
      cardSearch: new TarotCardSearch(this.cardManager.getAllCards()),
      cardAnalytics: new TarotCardAnalytics(this.cardManager.getAllCards()),
    });
  }

  public static async create(): Promise<TarotServer> {
    const cardManager = await TarotCardManager.create();
    return new TarotServer(cardManager);
  }

  public getAvailableSpreads(language: Language = "en") {
    return Object.entries(TAROT_SPREADS).map(([type, spread]) => ({
      type,
      ...localizedSpread(spread, type, language),
    }));
  }

  public getAllCards() {
    return this.cardManager.getAllCards();
  }

  public findCard(identifier: string) {
    return this.cardManager.findCard(identifier);
  }

  public getSessionCount(): number {
    return this.sessionManager.getSessionCount();
  }

  public getAvailableTools(): Tool[] {
    return getToolDefinitions();
  }

  public async executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const handler = this.toolHandlers.get(toolName);
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const start = Date.now();
    try {
      const result = await handler(args);
      logger.info("tool_executed", {
        tool: toolName,
        ok: result.ok,
        durationMs: Date.now() - start,
      });
      return result;
    } catch (error) {
      if (error instanceof TarotDomainError) {
        logger.info("tool_executed", {
          tool: toolName,
          ok: false,
          domainError: error.name,
          durationMs: Date.now() - start,
        });
        return error instanceof VisualDrawError
          ? toolError(`Error: ${error.message}`, error.code, error.httpStatus)
          : toolError(`Error: ${error.message}`);
      }
      logger.error("tool_failed", {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      });
      throw error;
    }
  }
}
