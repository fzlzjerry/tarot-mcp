import {
  CardMeanings,
  CardOrientation,
  Language,
  TarotCard,
} from "./types.js";

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
