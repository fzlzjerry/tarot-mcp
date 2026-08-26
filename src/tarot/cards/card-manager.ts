import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { TarotCard } from "../shared/types.js";
import { fisherYatesShuffle } from "../shared/utils.js";
import { logger } from "../shared/logger.js";
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
