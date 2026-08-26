import { TarotCardManager } from "../../tarot/cards/card-manager.js";
import { TarotCardAnalytics } from "../../tarot/cards/card-analytics.js";
import { TarotCardSearch } from "../../tarot/cards/card-search.js";
import { TarotReadingManager } from "../../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../../tarot/readings/session-manager.js";
import { VisualDrawManager } from "../../tarot/readings/visual-draw-manager.js";
import { LANGUAGES, Language } from "../../tarot/shared/types.js";
import { validateEnum } from "../../tarot/shared/validation.js";
import type { ValidationResult } from "../../tarot/shared/validation.js";
import { toolError, type ToolResult } from "../tool-result.js";

export interface TarotToolContext {
  cardManager: TarotCardManager;
  readingManager: TarotReadingManager;
  sessionManager: TarotSessionManager;
  visualDrawManager: VisualDrawManager;
  cardSearch: TarotCardSearch;
  cardAnalytics: TarotCardAnalytics;
}

export type ToolHandler = (
  ctx: TarotToolContext,
  args: Record<string, unknown>,
) => ToolResult | Promise<ToolResult>;

export function formatValidationError(
  field: string,
  errors: string[],
): ToolResult {
  return toolError(`Error: Invalid ${field}: ${errors.join("; ")}`);
}

export function validateLanguage(
  args: Record<string, unknown>,
): ValidationResult<Language> {
  if (args.language === undefined) {
    return { success: true, data: "en", errors: [] };
  }
  return validateEnum(LANGUAGES, "language")(args.language);
}

export function parseIsoDate(value: unknown): Date | null {
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

export function localizeAnalyticsRecommendation(
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
