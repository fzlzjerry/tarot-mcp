import {
  CardCategory,
  CardOrientation,
  Language,
  TarotCard,
} from "../shared/types.js";
import {
  localizedCardCategory,
  localizedCardName,
  localizedDescription,
  localizedElement,
  localizedKeywords,
  localizedMeanings,
  localizedOrientation,
  localizedSuit,
  localizedSymbolism,
  pick,
  titleCase,
} from "../shared/i18n.js";

export function cardsForCategory(
  cards: readonly TarotCard[],
  category: CardCategory,
): readonly TarotCard[] {
  switch (category) {
    case "major_arcana":
      return cards.filter((card) => card.arcana === "major");
    case "minor_arcana":
      return cards.filter((card) => card.arcana === "minor");
    case "wands":
    case "cups":
    case "swords":
    case "pentacles":
      return cards.filter((card) => card.suit === category);
    default:
      return cards;
  }
}

export function formatCardInfo(
  card: TarotCard,
  orientation: CardOrientation = "upright",
  language: Language = "en",
): string {
  const meanings = localizedMeanings(card, orientation, language);
  const keywords = localizedKeywords(card, orientation, language);
  const orientationTitle =
    language === "zh"
      ? localizedOrientation(orientation, language)
      : titleCase(orientation);

  let result = pick(
    language,
    `# ${localizedCardName(card, language)} (${orientationTitle})\n\n`,
    `# ${localizedCardName(card, language)}（${orientationTitle}）\n\n`,
  );

  result += pick(language, "**Arcana:** ", "**阿卡纳：** ");
  result += pick(
    language,
    card.arcana === "major" ? "Major Arcana" : "Minor Arcana",
    card.arcana === "major" ? "大阿卡纳" : "小阿卡纳",
  );
  if (card.suit) {
    result += pick(
      language,
      ` - ${titleCase(card.suit)}`,
      ` - ${localizedSuit(card.suit, language)}`,
    );
  }
  if (card.number !== undefined) {
    result += pick(language, ` (${card.number})`, `（${card.number}）`);
  }
  result += "\n\n";

  result += `${pick(language, "**Keywords:**", "**关键词：**")} ${keywords.join(pick(language, ", ", "、"))}\n\n`;
  result += `${pick(language, "**Description:**", "**牌面描述：**")} ${localizedDescription(card, language)}\n\n`;
  result += pick(
    language,
    `## Meanings (${orientationTitle})\n\n`,
    `## 含义（${orientationTitle}）\n\n`,
  );
  result += `${pick(language, "**General:**", "**总体：**")} ${meanings.general}\n\n`;
  result += `${pick(language, "**Love & Relationships:**", "**爱情与关系：**")} ${meanings.love}\n\n`;
  result += `${pick(language, "**Career & Finance:**", "**事业与财务：**")} ${meanings.career}\n\n`;
  result += `${pick(language, "**Health:**", "**健康：**")} ${meanings.health}\n\n`;
  result += `${pick(language, "**Spirituality:**", "**灵性：**")} ${meanings.spirituality}\n\n`;
  result += pick(language, `## Symbolism\n\n`, `## 象征意义\n\n`);
  result +=
    localizedSymbolism(card, language)
      .map((symbol) => `• ${symbol}`)
      .join("\n") + "\n\n";

  if (card.element) {
    result += pick(
      language,
      `**Element:** ${titleCase(card.element)}\n`,
      `**元素：** ${localizedElement(card.element, language)}\n`,
    );
  }
  if (card.astrology) {
    result += `${pick(language, "**Astrology:**", "**占星：**")} ${card.astrology}\n`;
  }
  if (card.numerology) {
    result += `${pick(language, "**Numerology:**", "**数字学：**")} ${card.numerology}\n`;
  }

  return result;
}

export function formatCardCatalog(
  cards: readonly TarotCard[],
  category: CardCategory = "all",
  language: Language = "en",
): string {
  const filteredCards = cardsForCategory(cards, category);

  let result = pick(language, "# Tarot Cards", "# 塔罗牌");
  if (category !== "all") {
    result += pick(
      language,
      ` - ${localizedCardCategory(category, "en")}`,
      ` - ${localizedCardCategory(category, language)}`,
    );
  }
  result += `\n\n`;

  if (category === "all" || category === "major_arcana") {
    const majorCards = filteredCards.filter((card) => card.arcana === "major");
    if (majorCards.length > 0) {
      result += pick(
        language,
        `## Major Arcana (${majorCards.length} cards)\n\n`,
        `## 大阿卡纳（${majorCards.length} 张）\n\n`,
      );
      majorCards
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
        .forEach((card) => {
          result += pick(
            language,
            `• **${card.name}** (${card.number}) - ${card.keywords.upright.slice(0, 3).join(", ")}\n`,
            `• **${localizedCardName(card, language)}**（${card.number}）- ${localizedKeywords(card, "upright", language).slice(0, 3).join("、")}\n`,
          );
        });
      result += "\n";
    }
  }

  if (
    category === "all" ||
    category === "minor_arcana" ||
    ["wands", "cups", "swords", "pentacles"].includes(category)
  ) {
    const suits =
      category === "all" || category === "minor_arcana"
        ? ["wands", "cups", "swords", "pentacles"]
        : [category];

    suits.forEach((suit) => {
      const suitCards = filteredCards.filter((card) => card.suit === suit);
      if (suitCards.length > 0) {
        result += pick(
          language,
          `## ${titleCase(suit)} (${suitCards.length} cards)\n\n`,
          `## ${localizedSuit(suit, language)}（${suitCards.length} 张）\n\n`,
        );
        suitCards
          .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
          .forEach((card) => {
            result += pick(
              language,
              `• **${card.name}** - ${card.keywords.upright.slice(0, 3).join(", ")}\n`,
              `• **${localizedCardName(card, language)}** - ${localizedKeywords(card, "upright", language).slice(0, 3).join("、")}\n`,
            );
          });
        result += "\n";
      }
    });
  }

  result += pick(
    language,
    `\n**Total cards:** ${filteredCards.length}\n`,
    `\n**牌总数：** ${filteredCards.length}\n`,
  );
  result += pick(
    language,
    `\nUse the \`get_card_info\` tool with any card name to get detailed information.`,
    `\n使用 \`get_card_info\` 工具并传入任意中文或英文牌名，即可查看详细信息。`,
  );

  return result;
}
