import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { TarotCard } from "../shared/types.js";
import { fisherYatesShuffle } from "../shared/utils.js";
import { logger } from "../shared/logger.js";
import { getCanonCard } from "../canon/index.js";
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
        const cards = parseCardData(JSON.parse(data)).map(applyCanonOverlay);
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
   * Look up a card strictly by exact ID, exact English name, or exact localized
   * name (case-insensitive) without substring fallback. Used for resource URIs
   * like `tarot://cards/{id}` so incomplete IDs never resolve arbitrarily.
   */
  public findCardExact(identifier: string): TarotCard | undefined {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    if (!normalizedIdentifier) {
      return undefined;
    }
    return (
      this.cards.get(normalizedIdentifier) ??
      this.cardsByName.get(normalizedIdentifier) ??
      this.cardsByLocalizedName.get(normalizedIdentifier)
    );
  }

  /**
   * Resolve a card query with explicit disambiguation.
   * Returns `exact` when the identifier uniquely names one card (exact ID,
   * exact English/Chinese name, or a single unambiguous partial match), and
   * returns `candidates` when multiple cards match (e.g. "Queen" or "王后").
   */
  public findCardMatches(identifier: string): {
    exact?: TarotCard;
    candidates: TarotCard[];
  } {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    if (!normalizedIdentifier) {
      return { candidates: [] };
    }

    const direct = this.findCardExact(normalizedIdentifier);
    if (direct) {
      return { exact: direct, candidates: [direct] };
    }

    const partial = this.allCards.filter(
      (c) =>
        c.name.toLowerCase().includes(normalizedIdentifier) ||
        c.id.toLowerCase().includes(normalizedIdentifier) ||
        Boolean(c.zh?.name?.toLowerCase().includes(normalizedIdentifier)),
    );

    if (partial.length === 1) {
      return { exact: partial[0], candidates: partial };
    }
    return { candidates: partial };
  }

  /**
   * Find a card by name or ID (case-insensitive).
   * Returns exact matches or an unambiguous single partial match; falls back
   * to the first partial match for internal callers that expect legacy lookup.
   */
  public findCard(identifier: string): TarotCard | undefined {
    const { exact, candidates } = this.findCardMatches(identifier);
    return exact ?? candidates[0];
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

function applyCanonOverlay(card: TarotCard): TarotCard {
  const canon = getCanonCard(card.id);
  if (!canon) return card;

  const toDomainMeanings = (
    domains: typeof canon.meaningBranches.upright.domains,
    lang: "en" | "zh",
  ) => ({
    general: domains.general[lang],
    love: domains.love[lang],
    career: domains.career[lang],
    health: domains.health[lang],
    spirituality: domains.spirituality[lang],
  });

  return {
    ...card,
    meanings: {
      upright: toDomainMeanings(canon.meaningBranches.upright.domains, "en"),
      reversed: toDomainMeanings(canon.meaningBranches.reversed.domains, "en"),
    },
    ...(card.zh
      ? {
          zh: {
            ...card.zh,
            meanings: {
              upright: toDomainMeanings(canon.meaningBranches.upright.domains, "zh"),
              reversed: toDomainMeanings(canon.meaningBranches.reversed.domains, "zh"),
            },
          },
        }
      : {}),
  };
}

