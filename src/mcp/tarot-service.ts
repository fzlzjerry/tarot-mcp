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
  validateOptionalString,
  validateRange,
  validateSearchParams,
  validateSpreadType,
  validateString,
} from "../tarot/shared/validation.js";
import { TarotDomainError } from "../tarot/shared/errors.js";

/**
 * Uniform result of a tool execution. `structured` is reserved for MCP
 * structuredContent payloads. Error text keeps its historical "Error: ..."
 * form so transport output stays byte-compatible.
 */
export type ToolResult =
  | { ok: true; text: string; structured?: object }
  | { ok: false; error: string };

export function toolOk(text: string, structured?: object): ToolResult {
  return structured === undefined ? { ok: true, text } : { ok: true, text, structured };
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
    this.sessionManager = new TarotSessionManager();
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
        () => toolOk(this.readingManager.listAvailableSpreads()),
      ],
      [TOOL_NAMES.performReading, (args) => this.handlePerformReading(args)],
      [TOOL_NAMES.searchCards, (args) => this.handleSearchCards(args)],
      [TOOL_NAMES.findSimilarCards, (args) => this.handleFindSimilarCards(args)],
      [TOOL_NAMES.getDatabaseAnalytics, (args) => this.handleGetAnalytics(args)],
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
  public getAvailableSpreads() {
    return Object.entries(TAROT_SPREADS).map(([type, spread]) => ({
      type,
      ...spread,
    }));
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

    try {
      return handler(args);
    } catch (error) {
      if (error instanceof TarotDomainError) {
        return toolError(`Error: ${error.message}`);
      }
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

    return toolOk(
      this.cardManager.listAllCards(
        typeof category === "string" ? category : category.data!,
      ),
    );
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

    const sessionId = validateOptionalString(args.sessionId);
    if (!sessionId.success) {
      return this.formatValidationError("sessionId", sessionId.errors);
    }

    return toolOk(
      this.readingManager.performReading(
        spreadType.data!,
        sanitizeString(question.data!),
        sessionId.data,
      ),
    );
  }

  /**
   * Handle card search requests
   */
  private handleSearchCards(args: Record<string, unknown>): ToolResult {
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
      return toolOk("No cards found matching your search criteria.");
    }

    let response = `Found ${results.length} cards matching your search`;
    if (results.length > limit) {
      response += ` (showing top ${limit})`;
    }
    response += ":\n\n";

    for (const result of limitedResults) {
      response += `**${result.card.name}** (Relevance: ${result.relevanceScore})\n`;
      response += `- Suit: ${result.card.suit || "N/A"} | Element: ${result.card.element || "N/A"}\n`;
      response += `- Matched fields: ${result.matchedFields.join(", ")}\n`;
      response += `- Keywords: ${result.card.keywords.upright.slice(0, 3).join(", ")}\n\n`;
    }

    return toolOk(response);
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
      return toolOk(`No similar cards found for "${cardName.data}".`);
    }

    let response = `Cards similar to **${targetCard.name}**:\n\n`;

    for (const card of similarCards) {
      response += `**${card.name}**\n`;
      response += `- Suit: ${card.suit || "N/A"} | Element: ${card.element || "N/A"}\n`;
      response += `- Keywords: ${card.keywords.upright.slice(0, 3).join(", ")}\n`;
      response += `- General meaning: ${card.meanings.upright.general.substring(0, 100)}...\n\n`;
    }

    return toolOk(response);
  }

  /**
   * Handle database analytics requests
   */
  private handleGetAnalytics(args: Record<string, unknown>): ToolResult {
    const includeRecommendations = args.includeRecommendations !== false;
    const analytics = this.cardAnalytics.generateReport();

    let response = "# 🔮 Tarot Database Analytics Report\n\n";

    // Overview
    response += "## 📊 Database Overview\n";
    response += `- **Total Cards**: ${analytics.overview.totalCards}\n`;
    response += `- **Completion Rate**: ${analytics.overview.completionRate.toFixed(1)}%\n`;
    response += `- **Major Arcana**: ${analytics.overview.arcanaDistribution.major || 0} cards\n`;
    response += `- **Minor Arcana**: ${analytics.overview.arcanaDistribution.minor || 0} cards\n\n`;

    // Suits distribution
    response += "### Suits Distribution\n";
    for (const [suit, count] of Object.entries(
      analytics.overview.suitDistribution,
    )) {
      response += `- **${suit.charAt(0).toUpperCase() + suit.slice(1)}**: ${count} cards\n`;
    }
    response += "\n";

    // Elements distribution
    response += "### Elements Distribution\n";
    for (const [element, count] of Object.entries(
      analytics.overview.elementDistribution,
    )) {
      response += `- **${element.charAt(0).toUpperCase() + element.slice(1)}**: ${count} cards\n`;
    }
    response += "\n";

    // Data Quality
    response += "## 🔍 Data Quality\n";
    response += `- **Complete Cards**: ${analytics.dataQuality.completeCards}/${analytics.overview.totalCards}\n`;
    response += `- **Average Keywords per Card**: ${analytics.dataQuality.averageKeywordsPerCard.toFixed(1)}\n`;
    response += `- **Average Symbols per Card**: ${analytics.dataQuality.averageSymbolsPerCard.toFixed(1)}\n`;

    if (analytics.dataQuality.incompleteCards.length > 0) {
      response += `- **Incomplete Cards**: ${analytics.dataQuality.incompleteCards.join(", ")}\n`;
    }
    response += "\n";

    // Content Analysis
    response += "## 📈 Content Analysis\n";
    response += "### Most Common Keywords\n";
    for (const keyword of analytics.contentAnalysis.mostCommonKeywords.slice(
      0,
      10,
    )) {
      response += `- **${keyword.keyword}**: ${keyword.count} times (${keyword.percentage.toFixed(1)}%)\n`;
    }
    response += "\n";

    // Recommendations
    if (includeRecommendations && analytics.recommendations.length > 0) {
      response += "## 💡 Recommendations\n";
      for (const recommendation of analytics.recommendations) {
        response += `- ${recommendation}\n`;
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
      return toolOk("No cards found matching your criteria.");
    }

    let response =
      requestedCount === 1
        ? "🎴 Random Card:\n\n"
        : `🎴 ${randomCards.length} Random Cards:\n\n`;

    for (const card of randomCards) {
      response += `**${card.name}**\n`;
      response += `- Suit: ${card.suit || "N/A"} | Element: ${card.element || "N/A"}\n`;
      response += `- Keywords: ${card.keywords.upright.join(", ")}\n`;
      response += `- General meaning: ${card.meanings.upright.general}\n\n`;
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

    const validatedSessionId = validateOptionalString(sessionId);
    if (!validatedSessionId.success) {
      return this.formatValidationError("sessionId", validatedSessionId.errors);
    }

    try {
      return toolOk(
        this.readingManager.performCustomReading(
          sanitizeString(customSpread.data!.name),
          sanitizeString(customSpread.data!.description),
          customSpread.data!.positions.map((position) => ({
            name: sanitizeString(position.name),
            meaning: sanitizeString(position.meaning),
          })),
          sanitizeString(readingQuestion.data!),
          validatedSessionId.data,
        ),
      );
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

    // Use the daily_guidance spread for consistency. Daily cards are one-shot
    // (the tool has no sessionId parameter), so skip session tracking.
    return toolOk(
      this.readingManager.performReading(
        "daily_guidance",
        typeof question === "string" ? question : sanitizeString(question.data!),
        undefined,
        { trackSession: false },
      ),
    );
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

    let response = `# 🔮 Spread Recommendations for Your Question\n\n`;
    response += `**Your Question:** "${questionText}"\n`;
    response += `**Category:** ${categoryValue} | **Timeframe:** ${timeframeValue}\n\n`;

    recommendations.forEach((rec, index) => {
      const confidence = Math.round(rec.confidence * 100);
      response += `## ${index + 1}. ${rec.spread.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} (${confidence}% match)\n`;
      response += `${rec.reason}\n\n`;
    });

    response += `\n**To perform a reading with your chosen spread, use:**\n`;
    response += `\`perform_reading\` with spreadType: "${recommendations[0].spread}"\n`;

    return toolOk(response);
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
      return toolError("Error: customDate must be a valid date in YYYY-MM-DD format.");
    }

    // Calculate moon phase using proper lunar utilities
    const date = customDate || new Date();
    const moonInfo = calculateMoonPhase(date);

    // Get recommended spread based on moon phase
    const spreadType = moonInfo.recommendedSpreads[0] || "three_card";

    // Get moon phase recommendations
    const moonGuidance = getMoonPhaseRecommendations(date);

    // Perform the reading. Moon-phase readings are one-shot (the tool has no
    // sessionId parameter), so skip session tracking.
    const reading = this.readingManager.performReading(
      spreadType,
      sanitizeString(question.data!),
      undefined,
      { trackSession: false },
    );

    return toolOk(
      `${moonGuidance}\n\n---\n\n# 🔮 Your Moon Phase Reading\n\n${reading}`,
    );
  }

  /**
   * Handle card meanings comparison requests
   */
  private handleGetCardMeaningsComparison(args: Record<string, unknown>): ToolResult {
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

    const contextText =
      typeof context === "string" ? context : sanitizeString(context.data!);

    let response = `# 🔮 Card Meanings Comparison\n\n`;
    response += `**Context:** ${contextText}\n\n`;

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
    response += `## Individual Card Meanings\n\n`;
    cards.forEach((entry, index) => {
      const card = entry.card!;
      const keywords = card.keywords[entry.orientation];
      const meanings = card.meanings[entry.orientation];

      response += `### ${index + 1}. ${card.name} (${entry.orientation})\n`;
      response += `**Keywords:** ${keywords.join(", ")}\n`;
      response += `**General:** ${meanings.general}\n`;
      response += `\n`;
    });

    // Provide combined interpretation
    response += `## Combined Message\n\n`;
    response += `When these ${cards.length} cards appear together in the context of "${contextText}", they suggest:\n\n`;

    // Simple combination logic (in a real implementation, this would be more sophisticated)
    if (cards.length === 2) {
      response += `The interplay between ${cards[0].card!.name} and ${cards[1].card!.name} indicates a dynamic where the energies of both cards are working together. `;
    } else if (cards.length === 3) {
      response += `This three-card combination shows a progression or trinity of energies: ${cards[0].card!.name} represents the foundation, ${cards[1].card!.name} the current influence, and ${cards[2].card!.name} the outcome or resolution. `;
    } else {
      response += `This multi-card combination creates a complex tapestry of meanings, with each card contributing its unique energy to the overall message. `;
    }

    response += `Consider how the themes and energies of these cards complement or challenge each other in your specific situation.\n\n`;
    response += `**Suggestion:** Meditate on how these cards relate to your question and trust your intuition about their combined message.`;

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

    const id = sanitizeString(sessionId.data!);
    const session = this.sessionManager.getSession(id);
    if (!session) {
      return toolError(
        `Error: Session "${id.slice(0, 64)}" not found. Sessions expire 24 hours after their last activity.`,
      );
    }

    const readings = this.sessionManager.getSessionReadings(id);
    const totalCount = this.sessionManager.getSessionReadingCount(id);

    let response = `# 🔮 Session History\n\n`;
    response += `**Session ID:** ${session.id}\n`;
    response += `**Created:** ${session.createdAt.toISOString()}\n`;
    response += `**Readings performed:** ${totalCount}`;
    if (totalCount > readings.length) {
      response += ` (oldest ${totalCount - readings.length} no longer stored)`;
    }
    response += `\n\n`;

    if (readings.length === 0) {
      response += "No readings have been performed in this session yet.\n";
      return toolOk(response);
    }

    readings.forEach((reading, index) => {
      const number = totalCount - readings.length + index + 1;
      response += `## ${number}. ${reading.spreadType} — ${reading.timestamp.toISOString()}\n`;
      response += `**Question:** ${reading.question}\n`;
      response += `**Reading ID:** ${reading.id}\n`;
      const cards = reading.cards
        .map(
          (card) =>
            `${card.name} (${card.orientation})${card.position ? ` — ${card.position}` : ""}`,
        )
        .join("; ");
      response += `**Cards:** ${cards}\n\n`;
    });

    return toolOk(response);
  }

  private validateRandomCardParams(args: Record<string, unknown>) {
    const allowedKeys = new Set(["count", "suit", "arcana", "element"]);
    const unsupportedKeys = Object.keys(args).filter((key) => !allowedKeys.has(key));

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

    const parsedCards: Array<{ name: string; orientation: "upright" | "reversed" }> = [];
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
