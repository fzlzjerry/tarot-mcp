import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { TarotCardSearch } from "../tarot/cards/card-search.js";
import { TarotCardAnalytics } from "../tarot/cards/card-analytics.js";
import {
  calculateMoonPhase,
  getMoonPhaseRecommendations,
} from "../tarot/readings/lunar-utils.js";
import { TAROT_SPREADS } from "../tarot/readings/spreads.js";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_TIMEFRAMES,
  RecommendationCategory,
  RecommendationTimeframe,
  recommendSpreads,
} from "../tarot/readings/spread-recommender.js";
import { TOOL_NAMES } from "./public-api.js";
import { getToolDefinitions, Tool } from "./tool-definitions.js";
import {
  sanitizeString,
  validateCardCategory,
  validateCardName,
  validateCardOrientation,
  validateCustomSpreadParams,
  validateEnum,
  validateOptionalSessionId,
  validateRange,
  validateSearchParams,
  validateSpreadType,
  validateString,
} from "../tarot/shared/validation.js";
import { TarotDomainError } from "../tarot/shared/errors.js";
import { logger } from "../tarot/shared/logger.js";
import { LANGUAGES, Language } from "../tarot/shared/types.js";
import {
  localizedCardName,
  localizedKeywords,
  localizedMeanings,
  pick,
} from "../tarot/shared/i18n.js";
import { localizedSpread } from "../tarot/readings/spread-localizations.js";
import { ValidationResult } from "../tarot/shared/validation.js";

/**
 * Uniform result of a tool execution. `structured` is reserved for MCP
 * structuredContent payloads. Error text keeps its historical "Error: ..."
 * form so transport output stays byte-compatible.
 */
export type ToolResult =
  | { ok: true; text: string; structured?: object }
  | { ok: false; error: string };

export function toolOk(text: string, structured?: object): ToolResult {
  return structured === undefined
    ? { ok: true, text }
    : { ok: true, text, structured };
}

export function toolError(error: string): ToolResult {
  return { ok: false, error };
}

/**
 * Main class for the Tarot MCP Server functionality.
 * Use the static `create()` method to instantiate.
 */
export class TarotServer {
  private cardManager: TarotCardManager;
  private readingManager: TarotReadingManager;
  private sessionManager: TarotSessionManager;
  private cardSearch: TarotCardSearch;
  private cardAnalytics: TarotCardAnalytics;
  private readonly toolHandlers: ReadonlyMap<
    string,
    (args: Record<string, unknown>) => ToolResult
  >;

  /**
   * The constructor is private. Use the static async `create()` method.
   */
  private constructor(cardManager: TarotCardManager) {
    this.cardManager = cardManager;
    // SESSION_STORE_PATH makes reading sessions survive restarts/redeploys.
    this.sessionManager = new TarotSessionManager(
      process.env.SESSION_STORE_PATH,
    );
    this.readingManager = new TarotReadingManager(
      this.cardManager,
      this.sessionManager,
    );
    this.cardSearch = new TarotCardSearch(this.cardManager.getAllCards());
    this.cardAnalytics = new TarotCardAnalytics(this.cardManager.getAllCards());
    const handlers: Array<
      [string, (args: Record<string, unknown>) => ToolResult]
    > = [
      [TOOL_NAMES.getCardInfo, (args) => this.handleGetCardInfo(args)],
      [TOOL_NAMES.listAllCards, (args) => this.handleListAllCards(args)],
      [
        TOOL_NAMES.listAvailableSpreads,
        (args) => this.handleListAvailableSpreads(args),
      ],
      [TOOL_NAMES.performReading, (args) => this.handlePerformReading(args)],
      [TOOL_NAMES.searchCards, (args) => this.handleSearchCards(args)],
      [
        TOOL_NAMES.findSimilarCards,
        (args) => this.handleFindSimilarCards(args),
      ],
      [
        TOOL_NAMES.getDatabaseAnalytics,
        (args) => this.handleGetAnalytics(args),
      ],
      [TOOL_NAMES.getRandomCards, (args) => this.handleGetRandomCards(args)],
      [TOOL_NAMES.getDailyCard, (args) => this.handleGetDailyCard(args)],
      [TOOL_NAMES.recommendSpread, (args) => this.handleRecommendSpread(args)],
      [
        TOOL_NAMES.getMoonPhaseReading,
        (args) => this.handleGetMoonPhaseReading(args),
      ],
      [
        TOOL_NAMES.getCardMeaningsComparison,
        (args) => this.handleGetCardMeaningsComparison(args),
      ],
      [
        TOOL_NAMES.createCustomSpread,
        (args) => this.handleCreateCustomSpread(args),
      ],
      [
        TOOL_NAMES.getSessionHistory,
        (args) => this.handleGetSessionHistory(args),
      ],
    ];
    this.toolHandlers = new Map(handlers);
  }

  /**
   * Asynchronously creates and initializes a TarotServer instance.
   */
  public static async create(): Promise<TarotServer> {
    const cardManager = await TarotCardManager.create();
    return new TarotServer(cardManager);
  }

  /**
   * Returns structured spread definitions for HTTP clients and tests.
   */
  public getAvailableSpreads(language: Language = "en") {
    return Object.entries(TAROT_SPREADS).map(([type, spread]) => ({
      type,
      ...localizedSpread(spread, type, language),
    }));
  }

  /**
   * Full card data (for MCP resources).
   */
  public getAllCards() {
    return this.cardManager.getAllCards();
  }

  /**
   * Find a card by id or name (for MCP resources).
   */
  public findCard(identifier: string) {
    return this.cardManager.findCard(identifier);
  }

  /**
   * Number of live reading sessions (for health reporting).
   */
  public getSessionCount(): number {
    return this.sessionManager.getSessionCount();
  }

  /**
   * Returns all available tools for the Tarot MCP Server
   */
  public getAvailableTools(): Tool[] {
    return getToolDefinitions();
  }

  /**
   * Executes a specific tool with the provided arguments. Typed domain
   * errors become failed results; unexpected errors propagate so the
   * transport can report them as execution failures.
   */
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
      const result = handler(args);
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
        return toolError(`Error: ${error.message}`);
      }
      logger.error("tool_failed", {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      });
      throw error;
    }
  }

  /**
   * Handle card info requests
   */
  private handleGetCardInfo(args: Record<string, unknown>): ToolResult {
    const cardName = validateCardName(args.cardName);
    if (!cardName.success) {
      return this.formatValidationError("cardName", cardName.errors);
    }

    const orientation =
      args.orientation === undefined
        ? "upright"
        : validateCardOrientation(args.orientation);
    if (typeof orientation !== "string" && !orientation.success) {
      return this.formatValidationError("orientation", orientation.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }

    const name = sanitizeString(cardName.data!);
    if (!this.cardManager.findCard(name)) {
      return toolError(
        `Error: Card "${name}" not found. Use the list_all_cards tool to see available cards.`,
      );
    }

    return toolOk(
      this.cardManager.getCardInfo(
        name,
        typeof orientation === "string" ? orientation : orientation.data!,
        language.data!,
      ),
    );
  }

  /**
   * Handle card listing requests
   */
  private handleListAllCards(args: Record<string, unknown>): ToolResult {
    const category =
      args.category === undefined ? "all" : validateCardCategory(args.category);
    if (typeof category !== "string" && !category.success) {
      return this.formatValidationError("category", category.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }

    return toolOk(
      this.cardManager.listAllCards(
        typeof category === "string" ? category : category.data!,
        language.data!,
      ),
    );
  }

  /**
   * Handle spread catalog requests
   */
  private handleListAvailableSpreads(
    args: Record<string, unknown>,
  ): ToolResult {
    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    return toolOk(this.readingManager.listAvailableSpreads(language.data!));
  }

  /**
   * Handle reading requests
   */
  private handlePerformReading(args: Record<string, unknown>): ToolResult {
    const spreadType = validateSpreadType(args.spreadType);
    if (!spreadType.success) {
      return this.formatValidationError("spreadType", spreadType.errors);
    }

    const question = validateString(args.question);
    if (!question.success) {
      return this.formatValidationError("question", question.errors);
    }

    const sessionId = validateOptionalSessionId(args.sessionId);
    if (!sessionId.success) {
      return this.formatValidationError("sessionId", sessionId.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }

    const performed = this.readingManager.performReadingWithDetails(
      spreadType.data!,
      sanitizeString(question.data!),
      sessionId.data,
      { language: language.data },
    );
    return toolOk(performed.text, performed.reading);
  }

  /**
   * Handle card search requests
   */
  private handleSearchCards(args: Record<string, unknown>): ToolResult {
    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    const validated = validateSearchParams(args);
    if (!validated.success) {
      return this.formatValidationError("search", validated.errors);
    }

    const searchOptions = {
      ...validated.data,
      orientation: validated.data?.orientation || "upright",
    };

    const results = this.cardSearch.search(searchOptions);
    const limit = validated.data?.limit || 10;
    const limitedResults = results.slice(0, limit);

    if (limitedResults.length === 0) {
      return toolOk(
        pick(
          lang,
          "No cards found matching your search criteria.",
          "没有找到符合搜索条件的塔罗牌。",
        ),
      );
    }

    let response = pick(
      lang,
      `Found ${results.length} cards matching your search`,
      `找到 ${results.length} 张符合搜索条件的塔罗牌`,
    );
    if (results.length > limit) {
      response += pick(
        lang,
        ` (showing top ${limit})`,
        `（显示前 ${limit} 张）`,
      );
    }
    response += pick(lang, ":\n\n", "：\n\n");

    for (const result of limitedResults) {
      const displayName = localizedCardName(result.card, lang);
      const keywords = localizedKeywords(result.card, "upright", lang);
      response += pick(
        lang,
        `**${displayName}** (Relevance: ${result.relevanceScore})\n`,
        `**${displayName}**（相关度：${result.relevanceScore}）\n`,
      );
      response += pick(
        lang,
        `- Suit: ${result.card.suit || "N/A"} | Element: ${result.card.element || "N/A"}\n`,
        `- 牌组：${this.localizeSuit(result.card.suit, lang)} | 元素：${this.localizeElement(result.card.element, lang)}\n`,
      );
      response += pick(
        lang,
        `- Matched fields: ${result.matchedFields.join(", ")}\n`,
        `- 命中字段：${result.matchedFields.join("、")}\n`,
      );
      response += pick(
        lang,
        `- Keywords: ${keywords.slice(0, 3).join(", ")}\n\n`,
        `- 关键词：${keywords.slice(0, 3).join("、")}\n\n`,
      );
    }

    return toolOk(response, {
      totalMatches: results.length,
      showing: limitedResults.length,
      results: limitedResults.map((result) => ({
        id: result.card.id,
        name: localizedCardName(result.card, lang),
        suit: result.card.suit,
        element: result.card.element,
        relevanceScore: result.relevanceScore,
        matchedFields: result.matchedFields,
      })),
    });
  }

  /**
   * Handle finding similar cards
   */
  private handleFindSimilarCards(args: Record<string, unknown>): ToolResult {
    const cardName = validateCardName(args.cardName);
    if (!cardName.success) {
      return this.formatValidationError("cardName", cardName.errors);
    }

    const limit =
      args.limit === undefined ? 5 : validateRange(1, 77)(args.limit);
    if (typeof limit !== "number" && !limit.success) {
      return this.formatValidationError("limit", limit.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    // First find the card ID
    const targetCard = this.cardManager.findCard(cardName.data!);

    if (!targetCard) {
      return toolError(
        `Error: Card "${cardName.data}" not found. Please check the card name and try again.`,
      );
    }

    const similarCards = this.cardSearch.findSimilarCards(
      targetCard.id,
      typeof limit === "number" ? limit : limit.data!,
    );

    if (similarCards.length === 0) {
      return toolOk(
        pick(
          lang,
          `No similar cards found for "${cardName.data}".`,
          `没有找到与「${cardName.data}」相似的塔罗牌。`,
        ),
      );
    }

    let response = pick(
      lang,
      `Cards similar to **${targetCard.name}**:\n\n`,
      `与 **${localizedCardName(targetCard, lang)}** 相似的塔罗牌：\n\n`,
    );

    for (const card of similarCards) {
      const keywords = localizedKeywords(card, "upright", lang);
      const meanings = localizedMeanings(card, "upright", lang);
      response += `**${localizedCardName(card, lang)}**\n`;
      response += pick(
        lang,
        `- Suit: ${card.suit || "N/A"} | Element: ${card.element || "N/A"}\n`,
        `- 牌组：${this.localizeSuit(card.suit, lang)} | 元素：${this.localizeElement(card.element, lang)}\n`,
      );
      response += pick(
        lang,
        `- Keywords: ${keywords.slice(0, 3).join(", ")}\n`,
        `- 关键词：${keywords.slice(0, 3).join("、")}\n`,
      );
      response += pick(
        lang,
        `- General meaning: ${meanings.general.substring(0, 100)}...\n\n`,
        `- 总体含义：${meanings.general.substring(0, 100)}……\n\n`,
      );
    }

    return toolOk(response);
  }

  /**
   * Handle database analytics requests
   */
  private handleGetAnalytics(args: Record<string, unknown>): ToolResult {
    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    const includeRecommendations = args.includeRecommendations !== false;
    const analytics = this.cardAnalytics.generateReport();

    let response = pick(
      lang,
      "# 🔮 Tarot Database Analytics Report\n\n",
      "# 🔮 塔罗牌数据库分析报告\n\n",
    );

    // Overview
    response += pick(lang, "## 📊 Database Overview\n", "## 📊 数据库概览\n");
    response += pick(
      lang,
      `- **Total Cards**: ${analytics.overview.totalCards}\n`,
      `- **牌总数**：${analytics.overview.totalCards}\n`,
    );
    response += pick(
      lang,
      `- **Completion Rate**: ${analytics.overview.completionRate.toFixed(1)}%\n`,
      `- **完整率**：${analytics.overview.completionRate.toFixed(1)}%\n`,
    );
    response += pick(
      lang,
      `- **Major Arcana**: ${analytics.overview.arcanaDistribution.major || 0} cards\n`,
      `- **大阿卡纳**：${analytics.overview.arcanaDistribution.major || 0} 张\n`,
    );
    response += pick(
      lang,
      `- **Minor Arcana**: ${analytics.overview.arcanaDistribution.minor || 0} cards\n\n`,
      `- **小阿卡纳**：${analytics.overview.arcanaDistribution.minor || 0} 张\n\n`,
    );

    // Suits distribution
    response += pick(lang, "### Suits Distribution\n", "### 牌组分布\n");
    for (const [suit, count] of Object.entries(
      analytics.overview.suitDistribution,
    )) {
      response += pick(
        lang,
        `- **${suit.charAt(0).toUpperCase() + suit.slice(1)}**: ${count} cards\n`,
        `- **${this.localizeSuit(suit, lang)}**：${count} 张\n`,
      );
    }
    response += "\n";

    // Elements distribution
    response += pick(lang, "### Elements Distribution\n", "### 元素分布\n");
    for (const [element, count] of Object.entries(
      analytics.overview.elementDistribution,
    )) {
      response += pick(
        lang,
        `- **${element.charAt(0).toUpperCase() + element.slice(1)}**: ${count} cards\n`,
        `- **${this.localizeElement(element, lang)}**：${count} 张\n`,
      );
    }
    response += "\n";

    // Data Quality
    response += pick(lang, "## 🔍 Data Quality\n", "## 🔍 数据质量\n");
    response += pick(
      lang,
      `- **Complete Cards**: ${analytics.dataQuality.completeCards}/${analytics.overview.totalCards}\n`,
      `- **完整牌数据**：${analytics.dataQuality.completeCards}/${analytics.overview.totalCards}\n`,
    );
    response += pick(
      lang,
      `- **Average Keywords per Card**: ${analytics.dataQuality.averageKeywordsPerCard.toFixed(1)}\n`,
      `- **每张牌平均关键词数**：${analytics.dataQuality.averageKeywordsPerCard.toFixed(1)}\n`,
    );
    response += pick(
      lang,
      `- **Average Symbols per Card**: ${analytics.dataQuality.averageSymbolsPerCard.toFixed(1)}\n`,
      `- **每张牌平均象征数**：${analytics.dataQuality.averageSymbolsPerCard.toFixed(1)}\n`,
    );

    if (analytics.dataQuality.incompleteCards.length > 0) {
      response += pick(
        lang,
        `- **Incomplete Cards**: ${analytics.dataQuality.incompleteCards.join(", ")}\n`,
        `- **数据不完整的牌**：${analytics.dataQuality.incompleteCards.join("、")}\n`,
      );
    }
    response += "\n";

    // Content Analysis
    response += pick(lang, "## 📈 Content Analysis\n", "## 📈 内容分析\n");
    response += pick(lang, "### Most Common Keywords\n", "### 最常见关键词\n");
    for (const keyword of analytics.contentAnalysis.mostCommonKeywords.slice(
      0,
      10,
    )) {
      response += pick(
        lang,
        `- **${keyword.keyword}**: ${keyword.count} times (${keyword.percentage.toFixed(1)}%)\n`,
        `- **${keyword.keyword}**：${keyword.count} 次（${keyword.percentage.toFixed(1)}%）\n`,
      );
    }
    response += "\n";

    // Recommendations
    if (includeRecommendations && analytics.recommendations.length > 0) {
      response += pick(lang, "## 💡 Recommendations\n", "## 💡 改进建议\n");
      for (const recommendation of analytics.recommendations) {
        response += `- ${this.localizeAnalyticsRecommendation(recommendation, lang)}\n`;
      }
      response += "\n";
    }

    return toolOk(response);
  }

  /**
   * Handle random card requests
   */
  private handleGetRandomCards(args: Record<string, unknown>): ToolResult {
    const randomParams = this.validateRandomCardParams(args);
    if (!randomParams.success) {
      return this.formatValidationError("filters", randomParams.errors);
    }

    const count =
      args.count === undefined ? 1 : validateRange(1, 78)(args.count);
    if (typeof count !== "number" && !count.success) {
      return this.formatValidationError("count", count.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    const filters = validateSearchParams(randomParams.data!);
    if (!filters.success) {
      return this.formatValidationError("filters", filters.errors);
    }

    const hasFilters = args.suit || args.arcana || args.element;
    const options = hasFilters
      ? {
          suit: filters.data?.suit,
          arcana: filters.data?.arcana,
          element: filters.data?.element,
        }
      : undefined;

    const requestedCount = typeof count === "number" ? count : count.data!;
    const randomCards = this.cardSearch.getRandomCards(requestedCount, options);

    if (randomCards.length === 0) {
      return toolOk(
        pick(
          lang,
          "No cards found matching your criteria.",
          "没有找到符合筛选条件的塔罗牌。",
        ),
      );
    }

    let response =
      requestedCount === 1
        ? pick(lang, "🎴 Random Card:\n\n", "🎴 随机塔罗牌：\n\n")
        : pick(
            lang,
            `🎴 ${randomCards.length} Random Cards:\n\n`,
            `🎴 ${randomCards.length} 张随机塔罗牌：\n\n`,
          );

    for (const card of randomCards) {
      const keywords = localizedKeywords(card, "upright", lang);
      const meanings = localizedMeanings(card, "upright", lang);
      response += `**${localizedCardName(card, lang)}**\n`;
      response += pick(
        lang,
        `- Suit: ${card.suit || "N/A"} | Element: ${card.element || "N/A"}\n`,
        `- 牌组：${this.localizeSuit(card.suit, lang)} | 元素：${this.localizeElement(card.element, lang)}\n`,
      );
      response += pick(
        lang,
        `- Keywords: ${keywords.join(", ")}\n`,
        `- 关键词：${keywords.join("、")}\n`,
      );
      response += pick(
        lang,
        `- General meaning: ${meanings.general}\n\n`,
        `- 总体含义：${meanings.general}\n\n`,
      );
    }

    return toolOk(response);
  }

  /**
   * Handle custom spread creation and reading
   */
  private handleCreateCustomSpread(args: Record<string, unknown>): ToolResult {
    const { spreadName, description, positions, question, sessionId } = args;

    const customSpread = validateCustomSpreadParams({
      name: spreadName,
      description,
      positions,
    });
    if (!customSpread.success) {
      return this.formatValidationError("customSpread", customSpread.errors);
    }

    const readingQuestion = validateString(question);
    if (!readingQuestion.success) {
      return this.formatValidationError("question", readingQuestion.errors);
    }

    const validatedSessionId = validateOptionalSessionId(sessionId);
    if (!validatedSessionId.success) {
      return this.formatValidationError("sessionId", validatedSessionId.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }

    try {
      const performed = this.readingManager.performCustomReadingWithDetails(
        sanitizeString(customSpread.data!.name),
        sanitizeString(customSpread.data!.description),
        customSpread.data!.positions.map((position) => ({
          name: sanitizeString(position.name),
          meaning: sanitizeString(position.meaning),
        })),
        sanitizeString(readingQuestion.data!),
        validatedSessionId.data,
        { language: language.data },
      );
      return toolOk(performed.text, performed.reading);
    } catch (error) {
      // Domain errors (unknown session, ...) keep their canonical message.
      if (error instanceof TarotDomainError) {
        throw error;
      }
      return toolError(
        `Error creating custom spread: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle daily card requests
   */
  private handleGetDailyCard(args: Record<string, unknown>): ToolResult {
    const question =
      args.question === undefined
        ? "What do I need to know for today?"
        : validateString(args.question);
    if (typeof question !== "string" && !question.success) {
      return this.formatValidationError("question", question.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }

    // Use the daily_guidance spread for consistency. Daily cards are one-shot
    // (the tool has no sessionId parameter), so skip session tracking.
    const performed = this.readingManager.performReadingWithDetails(
      "daily_guidance",
      typeof question === "string" ? question : sanitizeString(question.data!),
      undefined,
      { trackSession: false, language: language.data },
    );
    return toolOk(performed.text, performed.reading);
  }

  /**
   * Handle spread recommendation requests
   */
  private handleRecommendSpread(args: Record<string, unknown>): ToolResult {
    const question = validateString(args.question);
    if (!question.success) {
      return this.formatValidationError("question", question.errors);
    }

    const timeframe =
      args.timeframe === undefined
        ? "any"
        : validateEnum(RECOMMENDATION_TIMEFRAMES, "timeframe")(args.timeframe);
    if (typeof timeframe !== "string" && !timeframe.success) {
      return this.formatValidationError("timeframe", timeframe.errors);
    }

    const category =
      args.category === undefined
        ? "any"
        : validateEnum(RECOMMENDATION_CATEGORIES, "category")(args.category);
    if (typeof category !== "string" && !category.success) {
      return this.formatValidationError("category", category.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    const questionText = sanitizeString(question.data!);
    const timeframeValue =
      typeof timeframe === "string" ? timeframe : timeframe.data!;
    const categoryValue =
      typeof category === "string" ? category : category.data!;

    const recommendations = recommendSpreads(
      questionText,
      timeframeValue as RecommendationTimeframe,
      categoryValue as RecommendationCategory,
    );

    let response = pick(
      lang,
      `# 🔮 Spread Recommendations for Your Question\n\n`,
      `# 🔮 为你的问题推荐牌阵\n\n`,
    );
    response += `${pick(lang, "**Your Question:**", "**你的问题：**")} "${questionText}"\n`;
    response += pick(
      lang,
      `**Category:** ${categoryValue} | **Timeframe:** ${timeframeValue}\n\n`,
      `**类别：** ${categoryValue} | **时间范围：** ${timeframeValue}\n\n`,
    );

    recommendations.forEach((rec, index) => {
      const confidence = Math.round(rec.confidence * 100);
      const localizedName =
        lang === "zh"
          ? localizedSpread(TAROT_SPREADS[rec.spread], rec.spread, lang).name
          : rec.spread
              .replace(/_/g, " ")
              .replace(/\b\w/g, (letter) => letter.toUpperCase());
      response += pick(
        lang,
        `## ${index + 1}. ${localizedName} (${confidence}% match)\n`,
        `## ${index + 1}. ${localizedName}（匹配度 ${confidence}%）\n`,
      );
      response += `${pick(lang, rec.reason, rec.reasonZh ?? rec.reason)}\n\n`;
    });

    response += pick(
      lang,
      `\n**To perform a reading with your chosen spread, use:**\n`,
      `\n**选定牌阵后，这样进行解读：**\n`,
    );
    response += pick(
      lang,
      `\`perform_reading\` with spreadType: "${recommendations[0].spread}"\n`,
      `使用 \`perform_reading\` 工具并传入 spreadType: "${recommendations[0].spread}"\n`,
    );

    return toolOk(response, {
      question: questionText,
      timeframe: timeframeValue,
      category: categoryValue,
      recommendations: recommendations.map((recommendation) => ({
        spread: recommendation.spread,
        reason: pick(
          lang,
          recommendation.reason,
          recommendation.reasonZh ?? recommendation.reason,
        ),
        confidence: recommendation.confidence,
      })),
    });
  }

  /**
   * Handle moon phase reading requests
   */
  private handleGetMoonPhaseReading(args: Record<string, unknown>): ToolResult {
    const question = validateString(args.question);
    if (!question.success) {
      return this.formatValidationError("question", question.errors);
    }

    const customDate =
      args.customDate === undefined
        ? undefined
        : this.parseIsoDate(args.customDate);
    if (customDate === null) {
      return toolError(
        "Error: customDate must be a valid date in YYYY-MM-DD format.",
      );
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }

    // Calculate moon phase using proper lunar utilities
    const date = customDate || new Date();
    const moonInfo = calculateMoonPhase(date);

    // Get recommended spread based on moon phase
    const spreadType = moonInfo.recommendedSpreads[0] || "three_card";

    // Get moon phase recommendations
    const moonGuidance = getMoonPhaseRecommendations(date, language.data);

    // Perform the reading. Moon-phase readings are one-shot (the tool has no
    // sessionId parameter), so skip session tracking.
    const reading = this.readingManager.performReading(
      spreadType,
      sanitizeString(question.data!),
      undefined,
      { trackSession: false, language: language.data },
    );

    const heading = pick(
      language.data!,
      "# 🔮 Your Moon Phase Reading",
      "# 🔮 你的月相解读",
    );
    return toolOk(`${moonGuidance}\n\n---\n\n${heading}\n\n${reading}`);
  }

  /**
   * Handle card meanings comparison requests
   */
  private handleGetCardMeaningsComparison(
    args: Record<string, unknown>,
  ): ToolResult {
    const context =
      args.context === undefined
        ? "general interpretation"
        : validateString(args.context);
    if (typeof context !== "string" && !context.success) {
      return this.formatValidationError("context", context.errors);
    }

    const parsedCards = this.parseComparisonCards(args);
    if (!parsedCards.success) {
      return this.formatValidationError("cards", parsedCards.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    const contextText =
      typeof context === "string" ? context : sanitizeString(context.data!);

    let response = pick(
      lang,
      `# 🔮 Card Meanings Comparison\n\n`,
      `# 🔮 牌义对比\n\n`,
    );
    response += `${pick(lang, "**Context:**", "**语境：**")} ${contextText}\n\n`;

    // Get individual card meanings
    const cards = parsedCards.data!.map((input) => {
      const card = this.cardManager.findCard(input.name);
      return {
        name: input.name,
        orientation: input.orientation,
        card,
        found: Boolean(card),
      };
    });

    // Check if all cards were found
    const notFound = cards.filter((c) => !c.found);
    if (notFound.length > 0) {
      return toolError(
        `Error: Could not find the following cards: ${notFound.map((c) => c.name).join(", ")}`,
      );
    }

    // Display individual meanings
    response += pick(
      lang,
      `## Individual Card Meanings\n\n`,
      `## 单张牌义\n\n`,
    );
    cards.forEach((entry, index) => {
      const card = entry.card!;
      const keywords = localizedKeywords(card, entry.orientation, lang);
      const meanings = localizedMeanings(card, entry.orientation, lang);
      const displayName = localizedCardName(card, lang);
      const orientationText =
        lang === "zh"
          ? entry.orientation === "upright"
            ? "正位"
            : "逆位"
          : entry.orientation;

      response += pick(
        lang,
        `### ${index + 1}. ${displayName} (${orientationText})\n`,
        `### ${index + 1}. ${displayName}（${orientationText}）\n`,
      );
      response += `${pick(lang, "**Keywords:**", "**关键词：**")} ${keywords.join(pick(lang, ", ", "、"))}\n`;
      response += `${pick(lang, "**General:**", "**总体：**")} ${meanings.general}\n`;
      response += `\n`;
    });

    const displayNames = cards.map((entry) =>
      localizedCardName(entry.card!, lang),
    );

    // Provide combined interpretation
    response += pick(lang, `## Combined Message\n\n`, `## 组合讯息\n\n`);
    response += pick(
      lang,
      `When these ${cards.length} cards appear together in the context of "${contextText}", they suggest:\n\n`,
      `当这 ${cards.length} 张牌在「${contextText}」的语境下同时出现时，它们提示：\n\n`,
    );

    // Simple combination logic (in a real implementation, this would be more sophisticated)
    if (cards.length === 2) {
      response += pick(
        lang,
        `The interplay between ${displayNames[0]} and ${displayNames[1]} indicates a dynamic where the energies of both cards are working together. `,
        `${displayNames[0]}与${displayNames[1]}之间的相互作用，表明两张牌的能量正在协同运作。`,
      );
    } else if (cards.length === 3) {
      response += pick(
        lang,
        `This three-card combination shows a progression or trinity of energies: ${displayNames[0]} represents the foundation, ${displayNames[1]} the current influence, and ${displayNames[2]} the outcome or resolution. `,
        `这三张牌的组合呈现出能量的递进或三位一体：${displayNames[0]}代表根基，${displayNames[1]}代表当前的影响，${displayNames[2]}代表结果或解决之道。`,
      );
    } else {
      response += pick(
        lang,
        `This multi-card combination creates a complex tapestry of meanings, with each card contributing its unique energy to the overall message. `,
        `这组多张牌的组合织就了一幅复杂的意义图景，每张牌都为整体讯息注入独特的能量。`,
      );
    }

    response += pick(
      lang,
      `Consider how the themes and energies of these cards complement or challenge each other in your specific situation.\n\n`,
      `想一想这些牌的主题与能量在你的具体处境中是互补还是相互挑战。\n\n`,
    );
    response += pick(
      lang,
      `**Suggestion:** Meditate on how these cards relate to your question and trust your intuition about their combined message.`,
      `**建议：** 静心体会这些牌与你问题的关联，并相信你对它们组合讯息的直觉。`,
    );

    return toolOk(response);
  }

  /**
   * Handle session history requests
   */
  private handleGetSessionHistory(args: Record<string, unknown>): ToolResult {
    const sessionId = validateString(args.sessionId);
    if (!sessionId.success) {
      return this.formatValidationError("sessionId", sessionId.errors);
    }

    const language = this.validateLanguage(args);
    if (!language.success) {
      return this.formatValidationError("language", language.errors);
    }
    const lang = language.data!;

    const id = sanitizeString(sessionId.data!);
    const session = this.sessionManager.getSession(id);
    if (!session) {
      return toolError(
        `Error: Session "${id.slice(0, 64)}" not found. It may have expired (24 hours idle), been evicted under load, or predate a server restart.`,
      );
    }

    const readings = this.sessionManager.getSessionReadings(id);
    const totalCount = this.sessionManager.getSessionReadingCount(id);

    let response = pick(lang, "# 🔮 Session History\n\n", "# 🔮 会话历史\n\n");
    response += pick(
      lang,
      `**Session ID:** ${session.id}\n`,
      `**会话 ID：** ${session.id}\n`,
    );
    response += pick(
      lang,
      `**Created:** ${session.createdAt.toISOString()}\n`,
      `**创建时间：** ${session.createdAt.toISOString()}\n`,
    );
    response += pick(
      lang,
      `**Readings performed:** ${totalCount}`,
      `**已进行解读：** ${totalCount}`,
    );
    if (totalCount > readings.length) {
      response += pick(
        lang,
        ` (oldest ${totalCount - readings.length} no longer stored)`,
        `（最早的 ${totalCount - readings.length} 次已不再保存）`,
      );
    }
    response += `\n\n`;

    if (readings.length === 0) {
      response += pick(
        lang,
        "No readings have been performed in this session yet.\n",
        "这个会话中尚未进行任何解读。\n",
      );
      return toolOk(response);
    }

    readings.forEach((reading, index) => {
      const number = totalCount - readings.length + index + 1;
      response += `## ${number}. ${reading.spreadType} — ${reading.timestamp.toISOString()}\n`;
      response += pick(
        lang,
        `**Question:** ${reading.question}\n`,
        `**问题：** ${reading.question}\n`,
      );
      response += pick(
        lang,
        `**Reading ID:** ${reading.id}\n`,
        `**解读 ID：** ${reading.id}\n`,
      );
      const cards = reading.cards
        .map((card) => {
          const fullCard = this.cardManager.findCard(card.name);
          const name = fullCard ? localizedCardName(fullCard, lang) : card.name;
          const orientation = this.localizeOrientation(card.orientation, lang);
          return pick(
            lang,
            `${name} (${orientation})${card.position ? ` — ${card.position}` : ""}`,
            `${name}（${orientation}）${card.position ? ` — ${card.position}` : ""}`,
          );
        })
        .join(pick(lang, "; ", "；"));
      response += pick(
        lang,
        `**Cards:** ${cards}\n\n`,
        `**抽到的牌：** ${cards}\n\n`,
      );
    });

    return toolOk(response, {
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      readingCount: totalCount,
      storedReadings: readings.map((reading) => ({
        readingId: reading.id,
        spreadType: reading.spreadType,
        question: reading.question,
        timestamp: reading.timestamp.toISOString(),
        cards: reading.cards.map((card) => {
          const fullCard = this.cardManager.findCard(card.name);
          return {
            ...card,
            name: fullCard ? localizedCardName(fullCard, lang) : card.name,
          };
        }),
      })),
    });
  }

  private validateRandomCardParams(args: Record<string, unknown>) {
    const allowedKeys = new Set([
      "count",
      "suit",
      "arcana",
      "element",
      "language",
    ]);
    const unsupportedKeys = Object.keys(args).filter(
      (key) => !allowedKeys.has(key),
    );

    if (unsupportedKeys.length > 0) {
      return {
        success: false,
        errors: unsupportedKeys.map(
          (key) => `Unsupported get_random_cards parameter: ${key}`,
        ),
      };
    }

    return {
      success: true,
      data: args,
      errors: [],
    };
  }

  private parseComparisonCards(args: Record<string, unknown>) {
    const rawCards = Array.isArray(args.cards)
      ? args.cards
      : Array.isArray(args.cardNames)
        ? args.cardNames.map((name) => ({ name, orientation: "upright" }))
        : null;

    if (!rawCards || rawCards.length < 2 || rawCards.length > 5) {
      return {
        success: false,
        errors: ["Please provide 2-5 cards for comparison."],
      };
    }

    const parsedCards: Array<{
      name: string;
      orientation: "upright" | "reversed";
    }> = [];
    const errors: string[] = [];

    rawCards.forEach((input, index) => {
      if (typeof input !== "object" || input === null) {
        errors.push(`cards[${index}]: Expected object`);
        return;
      }

      const rawName = (input as Record<string, unknown>).name;
      const name = validateCardName(rawName);
      if (!name.success) {
        errors.push(`cards[${index}].name: ${name.errors.join(", ")}`);
        return;
      }

      const rawOrientation = (input as Record<string, unknown>).orientation;
      const orientation =
        rawOrientation === undefined
          ? "upright"
          : validateCardOrientation(rawOrientation);
      if (typeof orientation !== "string" && !orientation.success) {
        errors.push(
          `cards[${index}].orientation: ${orientation.errors.join(", ")}`,
        );
        return;
      }

      parsedCards.push({
        name: sanitizeString(name.data!),
        orientation:
          typeof orientation === "string" ? orientation : orientation.data!,
      });
    });

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      data: parsedCards,
      errors: [],
    };
  }

  private formatValidationError(field: string, errors: string[]): ToolResult {
    return toolError(`Error: Invalid ${field}: ${errors.join("; ")}`);
  }

  /** Validate the optional language argument (defaults to English). */
  private validateLanguage(
    args: Record<string, unknown>,
  ): ValidationResult<Language> {
    if (args.language === undefined) {
      return { success: true, data: "en", errors: [] };
    }
    return validateEnum(LANGUAGES, "language")(args.language);
  }

  private localizeSuit(suit: string | undefined, language: Language): string {
    if (language === "en") {
      return suit ?? "N/A";
    }
    const labels: Record<string, string> = {
      wands: "权杖",
      cups: "圣杯",
      swords: "宝剑",
      pentacles: "星币",
    };
    return suit ? (labels[suit] ?? suit) : "无";
  }

  private localizeElement(
    element: string | undefined,
    language: Language,
  ): string {
    if (language === "en") {
      return element ?? "N/A";
    }
    const labels: Record<string, string> = {
      fire: "火",
      water: "水",
      air: "风",
      earth: "土",
    };
    return element ? (labels[element] ?? element) : "无";
  }

  private localizeOrientation(
    orientation: "upright" | "reversed",
    language: Language,
  ): string {
    if (language === "en") {
      return orientation;
    }
    return orientation === "upright" ? "正位" : "逆位";
  }

  private localizeAnalyticsRecommendation(
    recommendation: string,
    language: Language,
  ): string {
    if (language === "en") {
      return recommendation;
    }
    if (recommendation.startsWith("Complete data for ")) {
      const count = recommendation.match(/\d+/)?.[0] ?? "";
      return `补全 ${count} 张数据不完整的塔罗牌`;
    }
    if (
      recommendation.startsWith("Database is ") &&
      recommendation.includes("complete")
    ) {
      const percentage = recommendation.match(/\d+(?:\.\d+)?%/)?.[0] ?? "";
      return `数据库完整率为 ${percentage}，请补全剩余牌数据`;
    }
    const translations: Record<string, string> = {
      "Consider adding more keywords per card for better searchability":
        "为每张牌增加更多关键词，以提升可搜索性",
      "Add more symbolic interpretations to enhance card meanings":
        "增加更多象征解读，以丰富牌义",
      "Consider expanding card descriptions for more detailed imagery":
        "扩展牌面描述，以提供更具体的图像细节",
      "Database is in excellent condition - no improvements needed!":
        "数据库状态良好，目前无需改进！",
    };
    return translations[recommendation] ?? recommendation;
  }

  private parseIsoDate(value: unknown): Date | null {
    if (typeof value !== "string") {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }
}
