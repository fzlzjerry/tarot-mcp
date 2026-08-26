import {
  calculateMoonPhase,
  getMoonPhaseRecommendations,
} from "../../tarot/readings/lunar-utils.js";
import { localizedSpread } from "../../tarot/readings/spread-localizations.js";
import {
  TAROT_SPREADS,
  customSpreadTypeId,
} from "../../tarot/readings/spreads.js";
import type { TarotSpread } from "../../tarot/shared/types.js";
import {
  sanitizeString,
  validateCustomSpreadParams,
  validateEnum,
  validateOptionalSessionId,
  validateSpreadType,
  validateString,
  type ValidationResult,
} from "../../tarot/shared/validation.js";
import { pick } from "../../tarot/shared/i18n.js";
import {
  VisualDrawError,
  type VisualReadingSpec,
} from "../../tarot/readings/visual-draw-manager.js";
import { toolError, toolOk } from "../tool-result.js";
import {
  formatValidationError,
  parseIsoDate,
  validateLanguage,
  type ToolHandler,
} from "./shared.js";

export const handleBeginVisualReading: ToolHandler = (ctx, args) => {
  const kind = validateEnum(
    ["spread", "daily", "moon", "custom"] as const,
    "visual reading kind",
  )(args.readingKind);
  if (!kind.success) {
    return formatValidationError("readingKind", kind.errors);
  }

  const commonKeys = [
    "readingKind",
    "language",
    "question",
    "idempotencyKey",
  ];
  const kindKeys = {
    spread: ["spreadType", "sessionId"],
    daily: [],
    moon: ["customDate"],
    custom: ["customSpread", "sessionId"],
  } as const;
  const allowedKeys = new Set([...commonKeys, ...kindKeys[kind.data!]]);
  const unsupported = Object.keys(args).filter((key) => !allowedKeys.has(key));
  if (unsupported.length > 0) {
    return toolError(
      `Error: Invalid ${kind.data} visual reading: Unsupported parameter(s): ${unsupported.join(", ")}`,
    );
  }

  const language = validateLanguage(args);
  if (!language.success) {
    return formatValidationError("language", language.errors);
  }
  const lang = language.data!;

  const defaultQuestion =
    kind.data === "daily"
      ? pick(lang, "What do I need to know for today?", "今天我需要知道什么？")
      : kind.data === "moon"
        ? pick(
            lang,
            "What guidance does the current moon phase offer?",
            "当前月相带来了什么指引？",
          )
        : undefined;
  const question =
    args.question === undefined && defaultQuestion !== undefined
      ? ({
          success: true,
          data: defaultQuestion,
          errors: [],
        } as ValidationResult<string>)
      : validateString(args.question);
  if (!question.success) {
    return formatValidationError("question", question.errors);
  }
  const questionText = sanitizeString(question.data!);

  let normalizedIdempotencyKey: string | undefined;
  if (args.idempotencyKey !== undefined) {
    const validated = validateString(args.idempotencyKey);
    if (!validated.success) {
      return formatValidationError("idempotencyKey", validated.errors);
    }
    if (validated.data!.length > 128) {
      return toolError(
        "Error: Invalid idempotencyKey: Maximum length is 128 characters",
      );
    }
    normalizedIdempotencyKey = validated.data;
  }

  let sessionId: string | undefined;
  if (kind.data === "spread" || kind.data === "custom") {
    const validatedSessionId = validateOptionalSessionId(args.sessionId);
    if (!validatedSessionId.success) {
      return formatValidationError("sessionId", validatedSessionId.errors);
    }
    sessionId = validatedSessionId.data;
    if (sessionId) {
      ctx.readingManager.assertContinuationSession(sessionId);
    }
  }

  let spec: VisualReadingSpec;
  let idempotencyFingerprint: string | undefined;
  if (kind.data === "spread") {
    const spreadType = validateSpreadType(args.spreadType);
    if (!spreadType.success) {
      return formatValidationError("spreadType", spreadType.errors);
    }
    const type = spreadType.data!;
    spec = {
      readingKind: "spread",
      question: questionText,
      language: lang,
      sessionId,
      trackSession: true,
      spreadType: type,
      spread: localizedSpread(TAROT_SPREADS[type], type, lang),
    };
  } else if (kind.data === "daily") {
    const spreadType = "daily_guidance";
    spec = {
      readingKind: "daily",
      question: questionText,
      language: lang,
      trackSession: false,
      spreadType,
      spread: localizedSpread(TAROT_SPREADS[spreadType], spreadType, lang),
    };
  } else if (kind.data === "moon") {
    const customDate =
      args.customDate === undefined
        ? undefined
        : parseIsoDate(args.customDate);
    if (customDate === null) {
      return toolError(
        "Error: customDate must be a valid date in YYYY-MM-DD format.",
      );
    }
    const date = customDate ?? new Date();
    const moonInfo = calculateMoonPhase(date);
    const spreadType = moonInfo.recommendedSpreads[0] || "three_card";
    const spread = TAROT_SPREADS[spreadType as keyof typeof TAROT_SPREADS];
    if (!spread) {
      return toolError(
        `Error: Moon phase selected an unavailable spread: ${spreadType}`,
      );
    }
    spec = {
      readingKind: "moon",
      question: questionText,
      language: lang,
      trackSession: false,
      spreadType,
      spread: localizedSpread(spread, spreadType, lang),
      moon: {
        date: date.toISOString().slice(0, 10),
        phase: moonInfo.phase,
        name: moonInfo.name,
        illumination: moonInfo.illumination,
        themes: moonInfo.tarotThemes,
      },
      moonGuidance: getMoonPhaseRecommendations(date, lang),
    };
    idempotencyFingerprint = JSON.stringify({
      readingKind: "moon",
      question: questionText,
      language: lang,
      customDate: typeof args.customDate === "string" ? args.customDate : null,
    });
  } else {
    if (
      typeof args.customSpread !== "object" ||
      args.customSpread === null ||
      Array.isArray(args.customSpread)
    ) {
      return toolError("Error: Invalid customSpread: Expected object");
    }
    const nested = args.customSpread as Record<string, unknown>;
    const unsupportedCustomKeys = Object.keys(nested).filter(
      (key) => !["name", "description", "positions"].includes(key),
    );
    if (unsupportedCustomKeys.length > 0) {
      return toolError(
        `Error: Invalid customSpread: Unsupported parameter(s): ${unsupportedCustomKeys.join(", ")}`,
      );
    }
    const rawPositions = nested.positions;
    const normalizedPositions = Array.isArray(rawPositions)
      ? rawPositions.map((rawPosition, index) => {
          if (typeof rawPosition !== "object" || rawPosition === null) {
            return rawPosition;
          }
          const position = rawPosition as Record<string, unknown>;
          const unsupportedPositionKeys = Object.keys(position).filter(
            (key) => key !== "name" && key !== "meaning",
          );
          if (unsupportedPositionKeys.length > 0) {
            throw new VisualDrawError(
              "INVALID_CUSTOM_SPREAD",
              400,
              `Custom spread position ${index + 1} has unsupported parameter(s): ${unsupportedPositionKeys.join(", ")}`,
            );
          }
          const name = position.name;
          const meaning =
            typeof position.meaning === "string" && position.meaning.trim()
              ? position.meaning
              : typeof name === "string" && name.trim()
                ? pick(
                    lang,
                    `What ${name.trim()} represents in this reading`,
                    `${name.trim()}在本次解读中所代表的意义`,
                  )
                : position.meaning;
          return { name, meaning };
        })
      : rawPositions;
    const customSpread = validateCustomSpreadParams({
      name: nested.name,
      description:
        nested.description ??
        pick(lang, "A custom visual tarot spread", "自定义可视化塔罗牌阵"),
      positions: normalizedPositions,
    });
    if (!customSpread.success) {
      return formatValidationError("customSpread", customSpread.errors);
    }
    const spreadName = sanitizeString(customSpread.data!.name);
    const positions = customSpread.data!.positions.map((position) => ({
      name: sanitizeString(position.name),
      meaning: sanitizeString(position.meaning),
    }));
    const spread: TarotSpread = {
      name: spreadName,
      description: sanitizeString(customSpread.data!.description),
      positions,
      cardCount: positions.length,
    };
    spec = {
      readingKind: "custom",
      question: questionText,
      language: lang,
      sessionId,
      trackSession: true,
      spreadType: customSpreadTypeId(spreadName),
      spread,
    };
  }

  const draw = ctx.visualDrawManager.begin(
    spec,
    normalizedIdempotencyKey,
    idempotencyFingerprint,
  );
  return toolOk(
    pick(
      lang,
      `The visual table is ready. Choose exactly ${draw.requiredCount} card backs and confirm your selection in the interactive view.`,
      `可视化牌桌已准备好。请在交互视图中选择恰好 ${draw.requiredCount} 张牌背并确认。`,
    ),
    draw,
  );
};

export const handleConfirmVisualReading: ToolHandler = async (ctx, args) => {
  const unsupported = Object.keys(args).filter(
    (key) => key !== "drawId" && key !== "selectedSlotIds",
  );
  if (unsupported.length > 0) {
    return toolError(
      `Error: Invalid visualConfirmation: Unsupported parameter(s): ${unsupported.join(", ")}`,
    );
  }
  const drawId = validateString(args.drawId);
  if (!drawId.success) {
    return formatValidationError("drawId", drawId.errors);
  }
  if (!Array.isArray(args.selectedSlotIds)) {
    return toolError("Error: Invalid selectedSlotIds: Expected array");
  }
  if (args.selectedSlotIds.length < 1 || args.selectedSlotIds.length > 15) {
    return toolError(
      "Error: Invalid selectedSlotIds: Expected between 1 and 15 slot IDs",
    );
  }
  const selectedSlotIds: string[] = [];
  for (let index = 0; index < args.selectedSlotIds.length; index++) {
    const slotId = validateString(args.selectedSlotIds[index]);
    if (!slotId.success) {
      return formatValidationError(`selectedSlotIds[${index}]`, slotId.errors);
    }
    selectedSlotIds.push(slotId.data!);
  }

  const confirmed = await ctx.visualDrawManager.confirm(
    drawId.data!,
    selectedSlotIds,
  );
  return toolOk(confirmed.text, confirmed.reading);
};
