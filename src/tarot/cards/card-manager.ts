import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { TarotCard, CardOrientation, CardCategory } from "../shared/types.js";
import { getSecureRandomInt } from "../shared/utils.js";
import { parseCardData } from "./card-schema.js";

// Helper to get __dirname in ES modules - with fallback for testing
let CARD_DATA_PATH: string;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  CARD_DATA_PATH = path.join(__dirname, "card-data.json");
} catch (error) {
  // Fallback for test environment
  CARD_DATA_PATH = path.join(
    process.cwd(),
    "src",
    "tarot",
    "cards",
    "card-data.json",
  );
}

/**
 * Manages tarot card data and operations.
 * Use the static `create()` method to instantiate.
 */
export class TarotCardManager {
  private static instance: TarotCardManager | null = null;
  private static initPromise: Promise<TarotCardManager> | null = null;
  private readonly cards: Map<string, TarotCard>;
  private readonly cardsByName: Map<string, TarotCard>;
  private readonly allCards: readonly TarotCard[];

  /**
   * The constructor is private. Use the static async `create()` method to get an instance.
   * @param cards - The array of tarot cards loaded from the data source.
   */
  private constructor(cards: TarotCard[]) {
    this.allCards = Object.freeze(cards);
    this.cards = new Map();
    this.cardsByName = new Map();
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
        console.error("Failed to load or parse tarot card data:", error);
        throw new Error(
          "Could not initialize TarotCardManager. Card data is missing or corrupt.",
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
    });
  }

  /**
   * Get detailed information about a specific card.
   */
  public getCardInfo(
    cardName: string,
    orientation: CardOrientation = "upright",
  ): string {
    const card = this.findCard(cardName);
    if (!card) {
      return `Error: Card "${cardName}" not found. Use the list_all_cards tool to see available cards.`;
    }

    const meanings =
      orientation === "upright"
        ? card.meanings.upright
        : card.meanings.reversed;
    const keywords =
      orientation === "upright"
        ? card.keywords.upright
        : card.keywords.reversed;

    let result = `# ${card.name} (${orientation.charAt(0).toUpperCase() + orientation.slice(1)})\n\n`;

    result += `**Arcana:** ${card.arcana === "major" ? "Major Arcana" : "Minor Arcana"}`;
    if (card.suit) {
      result += ` - ${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}`;
    }
    if (card.number !== undefined) {
      result += ` (${card.number})`;
    }
    result += "\n\n";

    result += `**Keywords:** ${keywords.join(", ")}\n\n`;

    result += `**Description:** ${card.description}\n\n`;

    result += `## Meanings (${orientation.charAt(0).toUpperCase() + orientation.slice(1)})\n\n`;
    result += `**General:** ${meanings.general}\n\n`;
    result += `**Love & Relationships:** ${meanings.love}\n\n`;
    result += `**Career & Finance:** ${meanings.career}\n\n`;
    result += `**Health:** ${meanings.health}\n\n`;
    result += `**Spirituality:** ${meanings.spirituality}\n\n`;

    result += `## Symbolism\n\n`;
    result += card.symbolism.map((symbol) => `• ${symbol}`).join("\n") + "\n\n";

    if (card.element) {
      result += `**Element:** ${card.element.charAt(0).toUpperCase() + card.element.slice(1)}\n`;
    }
    if (card.astrology) {
      result += `**Astrology:** ${card.astrology}\n`;
    }
    if (card.numerology) {
      result += `**Numerology:** ${card.numerology}\n`;
    }

    return result;
  }

  /**
   * List all available cards, optionally filtered by category.
   */
  public listAllCards(category: CardCategory = "all"): string {
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

    let result = `# Tarot Cards`;
    if (category !== "all") {
      result += ` - ${category.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}`;
    }
    result += `\n\n`;

    if (category === "all" || category === "major_arcana") {
      const majorCards = filteredCards.filter(
        (card) => card.arcana === "major",
      );
      if (majorCards.length > 0) {
        result += `## Major Arcana (${majorCards.length} cards)\n\n`;
        majorCards
          .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
          .forEach((card) => {
            result += `• **${card.name}** (${card.number}) - ${card.keywords.upright.slice(0, 3).join(", ")}\n`;
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
          result += `## ${suit.charAt(0).toUpperCase() + suit.slice(1)} (${suitCards.length} cards)\n\n`;
          suitCards
            .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
            .forEach((card) => {
              result += `• **${card.name}** - ${card.keywords.upright.slice(0, 3).join(", ")}\n`;
            });
          result += "\n";
        }
      });
    }

    result += `\n**Total cards:** ${filteredCards.length}\n`;
    result += `\nUse the \`get_card_info\` tool with any card name to get detailed information.`;

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
      this.cardsByName.get(normalizedIdentifier);
    if (card) return card;

    // Try partial name match as a fallback
    for (const c of this.allCards) {
      if (c.name.toLowerCase().includes(normalizedIdentifier)) {
        return c;
      }
    }

    return undefined;
  }

  /**
   * Fisher-Yates shuffle algorithm for true randomness.
   */
  private fisherYatesShuffle<T>(array: readonly T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = getSecureRandomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get a random card from the deck.
   */
  public getRandomCard(): TarotCard {
    const randomIndex = getSecureRandomInt(this.allCards.length);
    return this.allCards[randomIndex];
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
    if (count === this.allCards.length) {
      return this.fisherYatesShuffle(this.allCards);
    }
    const shuffled = this.fisherYatesShuffle(this.allCards);
    return shuffled.slice(0, count);
  }

  /**
   * Get all cards in the deck.
   */
  public getAllCards(): readonly TarotCard[] {
    return this.allCards;
  }
}
