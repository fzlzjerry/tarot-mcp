import { TarotCard } from "../shared/types.js";
import { getSecureRandomInt } from "../shared/utils.js";

export interface SearchOptions {
  keyword?: string;
  suit?: string;
  arcana?: 'major' | 'minor';
  element?: 'fire' | 'water' | 'air' | 'earth';
  number?: number;
  orientation?: 'upright' | 'reversed';
}

export interface SearchResult {
  card: TarotCard;
  relevanceScore: number;
  matchedFields: string[];
}

/**
 * Advanced search functionality for the tarot card database
 */
export class TarotCardSearch {
  private cards: readonly TarotCard[];

  constructor(cards: readonly TarotCard[]) {
    this.cards = cards;
  }

  /**
   * Search cards by various criteria
   */
  search(options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];

    for (const card of this.cards) {
      const result = this.evaluateCard(card, options);
      if (result.relevanceScore > 0) {
        results.push(result);
      }
    }

    // Sort by relevance score (highest first)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get cards with similar meanings
   */
  findSimilarCards(cardId: string, limit: number = 5): TarotCard[] {
    const targetCard = this.cards.find(card => card.id === cardId);
    if (!targetCard) return [];

    const similarities: { card: TarotCard; score: number }[] = [];

    for (const card of this.cards) {
      if (card.id === cardId) continue;

      const score = this.calculateSimilarity(targetCard, card);
      similarities.push({ card, score });
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.card);
  }

  /**
   * Get random cards with optional filters
   */
  getRandomCards(count: number = 1, options?: Partial<SearchOptions>): TarotCard[] {
    const filteredCards = this.filterCardsForRandomDraw(options);
    if (filteredCards.length > 0 && count > filteredCards.length) {
      throw new Error(
        `Cannot draw ${count} cards from ${filteredCards.length} matching cards`
      );
    }

    // Use Fisher-Yates shuffle with secure random for true randomness
    const shuffled = this.fisherYatesShuffle(filteredCards);
    return shuffled.slice(0, count);
  }

  private filterCardsForRandomDraw(options?: Partial<SearchOptions>): readonly TarotCard[] {
    if (!options) {
      return this.cards;
    }

    return this.cards.filter(card => {
      if (options.suit && card.suit !== options.suit) return false;
      if (options.arcana && card.arcana !== options.arcana) return false;
      if (options.element && card.element !== options.element) return false;
      if (options.number !== undefined && card.number !== options.number) return false;

      if (options.keyword) {
        const keywordScore = this.evaluateCard(card, {
          keyword: options.keyword,
          orientation: options.orientation || 'upright'
        });
        return keywordScore.relevanceScore > 0;
      }

      return true;
    });
  }

  private evaluateCard(card: TarotCard, options: SearchOptions): SearchResult {
    let score = 0;
    const matchedFields: string[] = [];

    // Structured criteria are hard filters: a card that fails any specified
    // one is excluded regardless of keyword relevance.
    if (options.suit && card.suit !== options.suit) {
      return { card, relevanceScore: 0, matchedFields };
    }
    if (options.arcana && card.arcana !== options.arcana) {
      return { card, relevanceScore: 0, matchedFields };
    }
    if (options.element && card.element !== options.element) {
      return { card, relevanceScore: 0, matchedFields };
    }
    if (options.number !== undefined && card.number !== options.number) {
      return { card, relevanceScore: 0, matchedFields };
    }

    if (options.suit) {
      score += 10;
      matchedFields.push('suit');
    }

    if (options.arcana) {
      score += 8;
      matchedFields.push('arcana');
    }

    if (options.element) {
      score += 8;
      matchedFields.push('element');
    }

    if (options.number !== undefined) {
      score += 10;
      matchedFields.push('number');
    }

    // Keyword search in various fields. A specified keyword is also a hard
    // filter: if it matches no field, the card is excluded.
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      const scoreBeforeKeyword = score;

      // Search in card name
      if (card.name.toLowerCase().includes(keyword)) {
        score += 15;
        matchedFields.push('name');
      }

      // Search in keywords
      const orientation = options.orientation || 'upright';
      const keywords = card.keywords[orientation];
      if (keywords.some(kw => kw.toLowerCase().includes(keyword))) {
        score += 12;
        matchedFields.push('keywords');
      }

      // Search in meanings
      const meanings = card.meanings[orientation];
      for (const [field, meaning] of Object.entries(meanings)) {
        if (meaning.toLowerCase().includes(keyword)) {
          score += 8;
          matchedFields.push(`meaning_${field}`);
        }
      }

      // Search in symbolism
      if (card.symbolism.some(symbol => symbol.toLowerCase().includes(keyword))) {
        score += 6;
        matchedFields.push('symbolism');
      }

      // Search in description
      if (card.description.toLowerCase().includes(keyword)) {
        score += 4;
        matchedFields.push('description');
      }

      if (score === scoreBeforeKeyword) {
        return { card, relevanceScore: 0, matchedFields: [] };
      }
    }

    return {
      card,
      relevanceScore: score,
      matchedFields
    };
  }

  private calculateSimilarity(card1: TarotCard, card2: TarotCard): number {
    let score = 0;

    // Same suit/arcana (suitless Major Arcana pairs must not count as same suit)
    if (card1.suit && card1.suit === card2.suit) score += 3;
    if (card1.arcana === card2.arcana) score += 2;
    if (card1.element && card1.element === card2.element) score += 3;

    // Similar numbers
    if (card1.number !== undefined && card2.number !== undefined) {
      const numDiff = Math.abs(card1.number - card2.number);
      if (numDiff <= 1) score += 2;
      else if (numDiff <= 2) score += 1;
    }

    // Keyword overlap: each shared keyword counts once, regardless of how
    // many times it appears on either card.
    const keywords1 = new Set(
      [...card1.keywords.upright, ...card1.keywords.reversed].map((kw) =>
        kw.toLowerCase(),
      ),
    );
    const keywords2 = new Set(
      [...card2.keywords.upright, ...card2.keywords.reversed].map((kw) =>
        kw.toLowerCase(),
      ),
    );

    for (const keyword of keywords1) {
      if (keywords2.has(keyword)) {
        score += 2;
      }
    }

    return score;
  }

  /**
   * Fisher-Yates shuffle algorithm using cryptographically secure random
   */
  private fisherYatesShuffle<T>(array: readonly T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = getSecureRandomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
