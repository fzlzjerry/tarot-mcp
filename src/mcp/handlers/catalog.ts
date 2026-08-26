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
  const card = ctx.cardManager.findCard(name);
  if (!card) {
    return toolError(
      `Error: Card "${name}" not found. Use the list_all_cards tool to see available cards.`,
    );
  }

  return toolOk(
    formatCardInfo(
      card,
      typeof orientation === "string" ? orientation : orientation.data!,
      language.data!,
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
