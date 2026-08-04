import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  TarotCard,
  CardOrientation,
  CardCategory,
  Language,
} from "../shared/types.js";
import { fisherYatesShuffle } from "../shared/utils.js";
import { logger } from "../shared/logger.js";
import {
  localizedCardName,
  localizedDescription,
  localizedKeywords,
  localizedMeanings,
  localizedSymbolism,
  pick,
} from "../shared/i18n.js";
import { parseCardData } from "./card-schema.js";

const CARD_DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "card-data.json",
);

/**
 * Manages tarot card data and operations.
 * Use the static `create()` method to instantiate.
 */
export class TarotCardManager {
  private static instance: TarotCardManager | null = null;
  private static initPromise: Promise<TarotCardManager> | null = null;
  private readonly cards: Map<string, TarotCard>;
  private readonly cardsByName: Map<string, TarotCard>;
  private readonly cardsByLocalizedName: Map<string, TarotCard>;
  private readonly allCards: readonly TarotCard[];

  /**
   * The constructor is private. Use the static async `create()` method to get an instance.
   * @param cards - The array of tarot cards loaded from the data source.
   */
  private constructor(cards: TarotCard[]) {
    this.allCards = Object.freeze(cards);
    this.cards = new Map();
    this.cardsByName = new Map();
    this.cardsByLocalizedName = new Map();
    this.initializeCards();
  }

  /**
   * Asynchronously creates and initializes a TarotCardManager instance.
   * This is the correct way to instantiate the class. It follows the singleton pattern.
   */
  public static async create(): Promise<TarotCardManager> {
    if (TarotCardManager.instance) {
      return TarotCardManager.instance;
    }

    // Prevent multiple concurrent initializations
    if (TarotCardManager.initPromise) {
      return TarotCardManager.initPromise;
    }

    TarotCardManager.initPromise = (async () => {
      try {
        const data = await fs.readFile(CARD_DATA_PATH, "utf-8");
        const cards = parseCardData(JSON.parse(data));
        TarotCardManager.instance = new TarotCardManager(cards);
        return TarotCardManager.instance;
      } catch (error) {
        TarotCardManager.initPromise = null; // Reset on error
        logger.error("card_data_load_failed", { error: String(error) });
        throw new Error(
          "Could not initialize TarotCardManager. Card data is missing or corrupt.",
          { cause: error },
        );
      }
    })();

    return TarotCardManager.initPromise;
  }

  /**
   * Populates the internal maps for quick card lookups.
   */
  private initializeCards(): void {
    this.allCards.forEach((card) => {
      // Lowercase keys keep lookups symmetric with findCard's normalization
      this.cards.set(card.id.toLowerCase(), card);
      this.cardsByName.set(card.name.toLowerCase(), card);
      if (card.zh?.name) {
        this.cardsByLocalizedName.set(card.zh.name.toLowerCase(), card);
        this.cardsByLocalizedName.set(
          `${card.zh.name}（${card.name}）`.toLowerCase(),
          card,
        );
      }
    });
  }

  /**
   * Get detailed information about a specific card.
   */
  public getCardInfo(
    cardName: string,
    orientation: CardOrientation = "upright",
    language: Language = "en",
  ): string {
    const card = this.findCard(cardName);
    if (!card) {
      return `Error: Card "${cardName}" not found. Use the list_all_cards tool to see available cards.`;
    }

    const meanings = localizedMeanings(card, orientation, language);
    const keywords = localizedKeywords(card, orientation, language);

    const orientationTitle =
      language === "zh"
        ? orientation === "upright"
          ? "正位"
          : "逆位"
        : orientation.charAt(0).toUpperCase() + orientation.slice(1);

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
      const suitZh: Record<string, string> = {
        wands: "权杖",
        cups: "圣杯",
        swords: "宝剑",
        pentacles: "星币",
      };
      result += pick(
        language,
        ` - ${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}`,
        ` - ${suitZh[card.suit]}`,
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
      const elementZh: Record<string, string> = {
        fire: "火",
        water: "水",
        air: "风",
        earth: "土",
      };
      result += pick(
        language,
        `**Element:** ${card.element.charAt(0).toUpperCase() + card.element.slice(1)}\n`,
        `**元素：** ${elementZh[card.element]}\n`,
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

  /**
   * List all available cards, optionally filtered by category.
   */
  public listAllCards(
    category: CardCategory = "all",
    language: Language = "en",
  ): string {
    let filteredCards: readonly TarotCard[] = [];

    switch (category) {
      case "major_arcana":
        filteredCards = this.allCards.filter((card) => card.arcana === "major");
        break;
      case "minor_arcana":
        filteredCards = this.allCards.filter((card) => card.arcana === "minor");
        break;
      case "wands":
        filteredCards = this.allCards.filter((card) => card.suit === "wands");
        break;
      case "cups":
        filteredCards = this.allCards.filter((card) => card.suit === "cups");
        break;
      case "swords":
        filteredCards = this.allCards.filter((card) => card.suit === "swords");
        break;
      case "pentacles":
        filteredCards = this.allCards.filter(
          (card) => card.suit === "pentacles",
        );
        break;
      default:
        filteredCards = this.allCards;
    }

    let result = pick(language, "# Tarot Cards", "# 塔罗牌");
    if (category !== "all") {
      const categoryZh: Record<CardCategory, string> = {
        all: "全部",
        major_arcana: "大阿卡纳",
        minor_arcana: "小阿卡纳",
        wands: "权杖",
        cups: "圣杯",
        swords: "宝剑",
        pentacles: "星币",
      };
      result += pick(
        language,
        ` - ${category.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}`,
        ` - ${categoryZh[category]}`,
      );
    }
    result += `\n\n`;

    if (category === "all" || category === "major_arcana") {
      const majorCards = filteredCards.filter(
        (card) => card.arcana === "major",
      );
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
          : [category as string];

      suits.forEach((suit) => {
        const suitCards = filteredCards.filter((card) => card.suit === suit);
        if (suitCards.length > 0) {
          const suitZh: Record<string, string> = {
            wands: "权杖",
            cups: "圣杯",
            swords: "宝剑",
            pentacles: "星币",
          };
          result += pick(
            language,
            `## ${suit.charAt(0).toUpperCase() + suit.slice(1)} (${suitCards.length} cards)\n\n`,
            `## ${suitZh[suit]}（${suitCards.length} 张）\n\n`,
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

  /**
   * Find a card by name or ID (case-insensitive).
   */
  public findCard(identifier: string): TarotCard | undefined {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    // Try exact ID match first, then exact name match
    const card =
      this.cards.get(normalizedIdentifier) ??
      this.cardsByName.get(normalizedIdentifier) ??
      this.cardsByLocalizedName.get(normalizedIdentifier);
    if (card) return card;

    // Try partial name match as a fallback
    for (const c of this.allCards) {
      if (
        c.name.toLowerCase().includes(normalizedIdentifier) ||
        c.zh?.name?.toLowerCase().includes(normalizedIdentifier)
      ) {
        return c;
      }
    }

    return undefined;
  }

  /**
   * Get multiple random cards (without replacement).
   */
  public getRandomCards(count: number): TarotCard[] {
    if (count > this.allCards.length) {
      throw new Error(
        `Cannot draw ${count} cards from a deck of ${this.allCards.length} cards`,
      );
    }
    return fisherYatesShuffle(this.allCards).slice(0, count);
  }

  /**
   * Get all cards in the deck.
   */
  public getAllCards(): readonly TarotCard[] {
    return this.allCards;
  }
}
