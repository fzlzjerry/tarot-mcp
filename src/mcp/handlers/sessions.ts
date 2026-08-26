import {
  calculateMoonPhase,
  getMoonPhaseRecommendations,
} from "../../tarot/readings/lunar-utils.js";
import { localizedSpread } from "../../tarot/readings/spread-localizations.js";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_TIMEFRAMES,
  type RecommendationCategory,
  type RecommendationTimeframe,
  recommendSpreads,
} from "../../tarot/readings/spread-recommender.js";
import { TAROT_SPREADS } from "../../tarot/readings/spreads.js";
import { TarotDomainError } from "../../tarot/shared/errors.js";
import {
  localizedCardName,
  localizedOrientation,
  pick,
} from "../../tarot/shared/i18n.js";
import {
  sanitizeString,
  validateCustomSpreadParams,
  validateEnum,
  validateOptionalSessionId,
  validateSpreadType,
  validateString,
} from "../../tarot/shared/validation.js";
import { toolError, toolOk } from "../tool-result.js";
import {
  formatValidationError,
  parseIsoDate,
  validateLanguage,
  type ToolHandler,
} from "./shared.js";

export const handlePerformReading: ToolHandler = (ctx, args) => {
  const spreadType = validateSpreadType(args.spreadType);
  if (!spreadType.success) {
    return formatValidationError("spreadType", spreadType.errors);
  }

  const question = validateString(args.question);
  if (!question.success) {
    return formatValidationError("question", question.errors);
  }

  const sessionId = validateOptionalSessionId(args.sessionId);
  if (!sessionId.success) {
    return formatValidationError("sessionId", sessionId.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }

  const performed = ctx.readingManager.performReadingWithDetails(
    spreadType.data!,
    sanitizeString(question.data!),
    sessionId.data,
    { language: language.data },
  );
  return toolOk(performed.text, performed.reading);
};

export const handleCreateCustomSpread: ToolHandler = (ctx, args) => {
  const { spreadName, description, positions, question, sessionId } = args;

  const customSpread = validateCustomSpreadParams({
    name: spreadName,
    description,
    positions,
  });
  if (!customSpread.success) {
    return formatValidationError("customSpread", customSpread.errors);
  }

  const readingQuestion = validateString(question);
  if (!readingQuestion.success) {
    return formatValidationError("question", readingQuestion.errors);
  }

  const validatedSessionId = validateOptionalSessionId(sessionId);
  if (!validatedSessionId.success) {
    return formatValidationError("sessionId", validatedSessionId.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }

  try {
    const performed = ctx.readingManager.performCustomReadingWithDetails(
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
    if (error instanceof TarotDomainError) {
      throw error;
    }
    return toolError(
      `Error creating custom spread: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const handleGetDailyCard: ToolHandler = (ctx, args) => {
  const question =
    args.question === undefined
      ? "What do I need to know for today?"
      : validateString(args.question);
  if (typeof question !== "string" && !question.success) {
    return formatValidationError("question", question.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }

  const performed = ctx.readingManager.performReadingWithDetails(
    "daily_guidance",
    typeof question === "string" ? question : sanitizeString(question.data!),
    undefined,
    { trackSession: false, language: language.data },
  );
  return toolOk(performed.text, performed.reading);
};

export const handleRecommendSpread: ToolHandler = (_ctx, args) => {
  const question = validateString(args.question);
  if (!question.success) {
    return formatValidationError("question", question.errors);
  }

  const timeframe =
    args.timeframe === undefined
      ? "any"
      : validateEnum(RECOMMENDATION_TIMEFRAMES, "timeframe")(args.timeframe);
  if (typeof timeframe !== "string" && !timeframe.success) {
    return formatValidationError("timeframe", timeframe.errors);
  }

  const category =
    args.category === undefined
      ? "any"
      : validateEnum(RECOMMENDATION_CATEGORIES, "category")(args.category);
  if (typeof category !== "string" && !category.success) {
    return formatValidationError("category", category.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
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
};

export const handleGetMoonPhaseReading: ToolHandler = (ctx, args) => {
  const question = validateString(args.question);
  if (!question.success) {
    return formatValidationError("question", question.errors);
  }

  const customDate =
    args.customDate === undefined ? undefined : parseIsoDate(args.customDate);
  if (customDate === null) {
    return toolError(
      "Error: customDate must be a valid date in YYYY-MM-DD format.",
    );
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }

  const date = customDate || new Date();
  const moonInfo = calculateMoonPhase(date);
  const spreadType = moonInfo.recommendedSpreads[0] || "three_card";
  const moonGuidance = getMoonPhaseRecommendations(date, language.data);

  const performed = ctx.readingManager.performReadingWithDetails(
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
  return toolOk(
    `${moonGuidance}\n\n---\n\n${heading}\n\n${performed.text}`,
    performed.reading,
  );
};

export const handleGetSessionHistory: ToolHandler = (ctx, args) => {
  const sessionId = validateString(args.sessionId);
  if (!sessionId.success) {
    return formatValidationError("sessionId", sessionId.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  const lang = language.data!;

  const id = sanitizeString(sessionId.data!);
  const session = ctx.sessionManager.getSession(id);
  if (!session) {
    return toolError(
      `Error: Session "${id.slice(0, 64)}" not found. It may have expired (24 hours idle), been evicted under load, or predate a server restart.`,
    );
  }

  const readings = ctx.sessionManager.getSessionReadings(id);
  const totalCount = ctx.sessionManager.getSessionReadingCount(id);

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
        const fullCard = ctx.cardManager.findCard(card.name);
        const name = fullCard ? localizedCardName(fullCard, lang) : card.name;
        const orientation = localizedOrientation(card.orientation, lang);
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
        const fullCard = ctx.cardManager.findCard(card.name);
        return {
          ...card,
          name: fullCard ? localizedCardName(fullCard, lang) : card.name,
        };
      }),
    })),
  });
};
