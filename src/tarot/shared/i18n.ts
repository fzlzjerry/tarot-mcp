import {
  CardCategory,
  CardMeanings,
  CardOrientation,
  Language,
  TarotCard,
} from "./types.js";

const SUIT_NAMES_ZH: Record<string, string> = {
  wands: "权杖",
  cups: "圣杯",
  swords: "宝剑",
  pentacles: "星币",
};

const ELEMENT_NAMES_ZH: Record<string, string> = {
  fire: "火",
  water: "水",
  air: "风",
  earth: "土",
};

const CARD_CATEGORY_NAMES_ZH: Record<CardCategory, string> = {
  all: "全部",
  major_arcana: "大阿卡纳",
  minor_arcana: "小阿卡纳",
  wands: "权杖",
  cups: "圣杯",
  swords: "宝剑",
  pentacles: "星币",
};

/**
 * Localization accessors. English is the canonical data; every zh field is
 * optional and falls back to English so translations can land in batches.
 */

/** Pick the zh variant when the language is zh and a translation exists. */
export function pick(language: Language, en: string, zh: string): string {
  return language === "zh" && zh ? zh : en;
}

/** Localized card name, e.g. "愚者（The Fool）" — the English name stays
 * visible so clients can keep using it as the tool-call identifier. */
export function localizedCardName(card: TarotCard, language: Language): string {
  if (language === "zh" && card.zh?.name) {
    return `${card.zh.name}（${card.name}）`;
  }
  return card.name;
}

export function localizedKeywords(
  card: TarotCard,
  orientation: CardOrientation,
  language: Language,
): string[] {
  if (language === "zh" && card.zh?.keywords) {
    return card.zh.keywords[orientation];
  }
  return card.keywords[orientation];
}

export function localizedMeanings(
  card: TarotCard,
  orientation: CardOrientation,
  language: Language,
): CardMeanings {
  if (language === "zh" && card.zh?.meanings) {
    return card.zh.meanings[orientation];
  }
  return card.meanings[orientation];
}

export function localizedSymbolism(
  card: TarotCard,
  language: Language,
): string[] {
  if (language === "zh" && card.zh?.symbolism) {
    return card.zh.symbolism;
  }
  return card.symbolism;
}

export function localizedDescription(
  card: TarotCard,
  language: Language,
): string {
  if (language === "zh" && card.zh?.description) {
    return card.zh.description;
  }
  return card.description;
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Display label for a suit. English stays the raw id or "N/A". */
export function localizedSuit(
  suit: string | undefined,
  language: Language,
): string {
  if (language === "en") {
    return suit ?? "N/A";
  }
  return suit ? (SUIT_NAMES_ZH[suit] ?? suit) : "无";
}

export function localizedElement(
  element: string | undefined,
  language: Language,
): string {
  if (language === "en") {
    return element ?? "N/A";
  }
  return element ? (ELEMENT_NAMES_ZH[element] ?? element) : "无";
}

export function localizedOrientation(
  orientation: CardOrientation,
  language: Language,
): string {
  if (language === "zh") {
    return orientation === "upright" ? "正位" : "逆位";
  }
  return orientation;
}

export function localizedCardCategory(
  category: CardCategory,
  language: Language,
): string {
  if (language === "zh") {
    return CARD_CATEGORY_NAMES_ZH[category];
  }
  return category.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
