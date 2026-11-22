import {
  formatCardCatalog,
  formatCardInfo,
} from "../../tarot/cards/card-formatter.js";
import {
  sanitizeString,
  validateCardCategory,
  validateCardName,
  validateCardOrientation,
} from "../../tarot/shared/validation.js";
import { toolError, toolOk } from "../tool-result.js";
import {
  formatValidationError,
  validateLanguage,
  type ToolHandler,
} from "./shared.js";

export const handleGetCardInfo: ToolHandler = (ctx, args) => {
  const cardName = validateCardName(args.cardName);
  if (!cardName.success) {
    return formatValidationError("cardName", cardName.errors);
  }

  const orientation =
    args.orientation === undefined
      ? "upright"
      : validateCardOrientation(args.orientation);
  if (typeof orientation !== "string" && !orientation.success) {
    return formatValidationError("orientation", orientation.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }

  const name = sanitizeString(cardName.data!);
  const lang = language.data!;
  const { exact, candidates } = ctx.cardManager.findCardMatches(name);
  if (!exact) {
    if (candidates.length > 1) {
      const shown = candidates.slice(0, 8);
      const list = shown
        .map((c) => {
          const zhName = c.zh?.name;
          return lang === "zh" && zhName
            ? `- ${zhName}（${c.name}，id: \`${c.id}\`）`
            : `- ${c.name} (id: \`${c.id}\`)`;
        })
        .join("\n");
      const more =
        candidates.length > shown.length
          ? lang === "zh"
            ? `\n（共匹配 ${candidates.length} 张牌，仅列出前 ${shown.length} 张）`
            : `\n(${candidates.length} total matches; showing first ${shown.length})`
          : "";
      const message =
        lang === "zh"
          ? `“${name}” 匹配到多张牌，请指定具体牌名或 ID：\n${list}${more}`
          : `"${name}" matches multiple cards. Please specify an exact card name or ID:\n${list}${more}`;
      return toolError(message, "AMBIGUOUS_CARD_NAME", 400);
    }
    return toolError(
      `Error: Card "${name}" not found. Use the list_all_cards tool to see available cards.`,
    );
  }

  return toolOk(
    formatCardInfo(
      exact,
      typeof orientation === "string" ? orientation : orientation.data!,
      lang,
    ),
  );
};

export const handleListAllCards: ToolHandler = (ctx, args) => {
  const category =
    args.category === undefined ? "all" : validateCardCategory(args.category);
  if (typeof category !== "string" && !category.success) {
    return formatValidationError("category", category.errors);
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }

  return toolOk(
    formatCardCatalog(
      ctx.cardManager.getAllCards(),
      typeof category === "string" ? category : category.data!,
      language.data!,
    ),
  );
};

export const handleListAvailableSpreads: ToolHandler = (ctx, args) => {
  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  return toolOk(ctx.readingManager.listAvailableSpreads(language.data!));
};
