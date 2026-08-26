import {
  localizedCardName,
  localizedElement,
  localizedKeywords,
  localizedMeanings,
  localizedOrientation,
  localizedSuit,
  pick,
} from "../../tarot/shared/i18n.js";
import {
  sanitizeString,
  validateCardName,
  validateCardOrientation,
  validateRange,
  validateSearchParams,
  validateString,
} from "../../tarot/shared/validation.js";
import { toolError, toolOk } from "../tool-result.js";
import {
  formatValidationError,
  localizeAnalyticsRecommendation,
  validateLanguage,
  type ToolHandler,
} from "./shared.js";

export const handleSearchCards: ToolHandler = (ctx, args) => {
  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  const lang = language.data!;

  const validated = validateSearchParams(args);
  if (!validated.success) {
    return formatValidationError("search", validated.errors);
  }

  const searchOptions = {
    ...validated.data,
    orientation: validated.data?.orientation || "upright",
  };

  const results = ctx.cardSearch.search(searchOptions);
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
    response += pick(lang, ` (showing top ${limit})`, `（显示前 ${limit} 张）`);
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
      `- 牌组：${localizedSuit(result.card.suit, lang)} | 元素：${localizedElement(result.card.element, lang)}\n`,
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
};

export const handleFindSimilarCards: ToolHandler = (ctx, args) => {
  const cardName = validateCardName(args.cardName);
  if (!cardName.success) {
    return formatValidationError("cardName", cardName.errors);
  }

  const limit = args.limit === undefined ? 5 : validateRange(1, 77)(args.limit);
  if (typeof limit !== "number" && !limit.success) {
    return formatValidationError("limit", limit.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  const lang = language.data!;

  const targetCard = ctx.cardManager.findCard(cardName.data!);
  if (!targetCard) {
    return toolError(
      `Error: Card "${cardName.data}" not found. Please check the card name and try again.`,
    );
  }

  const similarCards = ctx.cardSearch.findSimilarCards(
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
      `- 牌组：${localizedSuit(card.suit, lang)} | 元素：${localizedElement(card.element, lang)}\n`,
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
};

export const handleGetAnalytics: ToolHandler = (ctx, args) => {
  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  const lang = language.data!;

  const includeRecommendations = args.includeRecommendations !== false;
  const analytics = ctx.cardAnalytics.generateReport();

  let response = pick(
    lang,
    "# 🔮 Tarot Database Analytics Report\n\n",
    "# 🔮 塔罗牌数据库分析报告\n\n",
  );

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

  response += pick(lang, "### Suits Distribution\n", "### 牌组分布\n");
  for (const [suit, count] of Object.entries(
    analytics.overview.suitDistribution,
  )) {
    response += pick(
      lang,
      `- **${suit.charAt(0).toUpperCase() + suit.slice(1)}**: ${count} cards\n`,
      `- **${localizedSuit(suit, lang)}**：${count} 张\n`,
    );
  }
  response += "\n";

  response += pick(lang, "### Elements Distribution\n", "### 元素分布\n");
  for (const [element, count] of Object.entries(
    analytics.overview.elementDistribution,
  )) {
    response += pick(
      lang,
      `- **${element.charAt(0).toUpperCase() + element.slice(1)}**: ${count} cards\n`,
      `- **${localizedElement(element, lang)}**：${count} 张\n`,
    );
  }
  response += "\n";

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

  if (includeRecommendations && analytics.recommendations.length > 0) {
    response += pick(lang, "## 💡 Recommendations\n", "## 💡 改进建议\n");
    for (const recommendation of analytics.recommendations) {
      response += `- ${localizeAnalyticsRecommendation(recommendation, lang)}\n`;
    }
    response += "\n";
  }

  return toolOk(response);
};

function validateRandomCardParams(args: Record<string, unknown>) {
  const allowedKeys = new Set(["count", "suit", "arcana", "element", "language"]);
  const unsupportedKeys = Object.keys(args).filter(
    (key) => !allowedKeys.has(key),
  );

  if (unsupportedKeys.length > 0) {
    return {
      success: false as const,
      errors: unsupportedKeys.map(
        (key) => `Unsupported get_random_cards parameter: ${key}`,
      ),
    };
  }

  return {
    success: true as const,
    data: args,
    errors: [] as string[],
  };
}

export const handleGetRandomCards: ToolHandler = (ctx, args) => {
  const randomParams = validateRandomCardParams(args);
  if (!randomParams.success) {
    return formatValidationError("filters", randomParams.errors);
  }

  const count = args.count === undefined ? 1 : validateRange(1, 78)(args.count);
  if (typeof count !== "number" && !count.success) {
    return formatValidationError("count", count.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  const lang = language.data!;

  const filters = validateSearchParams(randomParams.data);
  if (!filters.success) {
    return formatValidationError("filters", filters.errors);
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
  const randomCards = ctx.cardSearch.getRandomCards(requestedCount, options);

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
      `- 牌组：${localizedSuit(card.suit, lang)} | 元素：${localizedElement(card.element, lang)}\n`,
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
};

function parseComparisonCards(args: Record<string, unknown>) {
  const rawCards = Array.isArray(args.cards)
    ? args.cards
    : Array.isArray(args.cardNames)
      ? args.cardNames.map((name) => ({ name, orientation: "upright" }))
      : null;

  if (!rawCards || rawCards.length < 2 || rawCards.length > 5) {
    return {
      success: false as const,
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
    return { success: false as const, errors };
  }

  return { success: true as const, data: parsedCards, errors: [] };
}

export const handleGetCardMeaningsComparison: ToolHandler = (ctx, args) => {
  const context =
    args.context === undefined
      ? "general interpretation"
      : validateString(args.context);
  if (typeof context !== "string" && !context.success) {
    return formatValidationError("context", context.errors);
  }

  const parsedCards = parseComparisonCards(args);
  if (!parsedCards.success) {
    return formatValidationError("cards", parsedCards.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
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

  const cards = parsedCards.data.map((input) => {
    const card = ctx.cardManager.findCard(input.name);
    return {
      name: input.name,
      orientation: input.orientation,
      card,
      found: Boolean(card),
    };
  });

  const notFound = cards.filter((entry) => !entry.found);
  if (notFound.length > 0) {
    return toolError(
      `Error: Could not find the following cards: ${notFound.map((entry) => entry.name).join(", ")}`,
    );
  }

  response += pick(lang, `## Individual Card Meanings\n\n`, `## 单张牌义\n\n`);
  cards.forEach((entry, index) => {
    const card = entry.card!;
    const keywords = localizedKeywords(card, entry.orientation, lang);
    const meanings = localizedMeanings(card, entry.orientation, lang);
    const displayName = localizedCardName(card, lang);
    const orientationText = localizedOrientation(entry.orientation, lang);

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

  response += pick(lang, `## Combined Message\n\n`, `## 组合讯息\n\n`);
  response += pick(
    lang,
    `When these ${cards.length} cards appear together in the context of "${contextText}", they suggest:\n\n`,
    `当这 ${cards.length} 张牌在「${contextText}」的语境下同时出现时，它们提示：\n\n`,
  );

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
};
