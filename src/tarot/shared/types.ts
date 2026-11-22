/**
 * Core types for the Tarot MCP Server
 */

export interface TarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  number?: number;
  keywords: {
    upright: string[];
    reversed: string[];
  };
  meanings: {
    upright: {
      general: string;
      love: string;
      career: string;
      health: string;
      spirituality: string;
    };
    reversed: {
      general: string;
      love: string;
      career: string;
      health: string;
      spirituality: string;
    };
  };
  symbolism: string[];
  element?: "fire" | "water" | "air" | "earth";
  astrology?: string;
  numerology?: string;
  description: string;
  /** Optional Chinese localization; missing fields fall back to English. */
  zh?: CardLocalization;
}

export type PositionRole =
  | "message"
  | "foundation"
  | "present"
  | "challenge"
  | "resource"
  | "action"
  | "outcome"
  | "advice"
  | "hidden"
  | "self"
  | "other"
  | "external"
  | "hopes_fears"
  | "synthesis"
  | "general";

export type ReadingDomain =
  | "general"
  | "love"
  | "career"
  | "health"
  | "spirituality";

export interface ReadingSignal {
  kind:
    | "major_density"
    | "orientation_balance"
    | "element_balance"
    | "suit_focus"
    | "pip_numerology"
    | "court_presence"
    | "archetype_pair";
  positions: number[];
  fact: string;
  baseline?: string;
  note: string;
}

export interface ReadingCardEvidence {
  positionIndex: number;
  positionId: string;
  positionRole: PositionRole;
  cardId: string;
  orientation: CardOrientation;
  hasCanon: boolean;
  traditionMotifs: string[];
  editionMotifs: string[];
  reversalLenses?: Partial<
    Record<"blocked" | "excess" | "internalized" | "release", string>
  >;
}

export interface ReadingEvidence {
  knowledgeVersion: string;
  deckVersion: string;
  questionDomain: ReadingDomain;
  cards: ReadingCardEvidence[];
  signals: ReadingSignal[];
}

export interface DrawnCard {
  card: TarotCard;
  orientation: "upright" | "reversed";
  position?: string;
  positionMeaning?: string;
  positionId?: string;
  positionRole?: PositionRole;
}

export interface TarotSpread {
  name: string;
  description: string;
  positions: {
    id?: string;
    name: string;
    meaning: string;
    role?: PositionRole;
  }[];
  cardCount: number;
}

export interface TarotReading {
  id: string;
  spreadType: string;
  question: string;
  cards: DrawnCard[];
  interpretation: string;
  timestamp: Date;
  sessionId?: string;
  language?: Language;
  deckVersion?: string;
  knowledgeVersion?: string;
  evidence?: ReadingEvidence;
}

/**
 * What a session stores per reading: an immutable receipt carrying stable card
 * IDs, position roles, and deck/knowledge versions so follow-up questions can
 * inspect this exact hand without redrawing.
 */
export interface TarotReadingSummary {
  id: string;
  spreadType: string;
  question: string;
  timestamp: Date;
  language?: Language;
  deckVersion?: string;
  knowledgeVersion?: string;
  cards: Array<{
    cardId?: string;
    name: string;
    orientation: CardOrientation;
    position?: string;
    positionId?: string;
    positionRole?: PositionRole;
  }>;
  evidence?: ReadingEvidence;
}

export interface TarotSession {
  id: string;
  readings: TarotReadingSummary[];
  /**
   * Monotonic count of readings ever performed in this session. Unlike
   * readings.length it never decreases when old readings are evicted, so
   * "reading #N" numbering stays stable.
   */
  readingCount: number;
  createdAt: Date;
  lastActivity: Date;
}

export type CardOrientation = "upright" | "reversed";

/** The per-context meanings of a card in one orientation. */
export type CardMeanings = TarotCard["meanings"]["upright"];

/** Output languages. English is canonical; zh falls back field-by-field. */
export const LANGUAGES = ["en", "zh"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Optional Chinese localization block carried by a card. */
export interface CardLocalization {
  name?: string;
  keywords?: {
    upright: string[];
    reversed: string[];
  };
  meanings?: {
    upright: CardMeanings;
    reversed: CardMeanings;
  };
  symbolism?: string[];
  description?: string;
}

/**
 * Canonical list of built-in spread types. Single source of truth shared by
 * the validator (validateSpreadType) and the MCP tool schema enum.
 * Must stay in sync with the keys of TAROT_SPREADS (enforced by tests).
 */
export const SPREAD_TYPES = [
  "single_card",
  "three_card",
  "celtic_cross",
  "horseshoe",
  "relationship_cross",
  "career_path",
  "decision_making",
  "spiritual_guidance",
  "year_ahead",
  "chakra_alignment",
  "shadow_work",
  "venus_love",
  "tree_of_life",
  "astrological_houses",
  "mandala",
  "pentagram",
  "mirror_of_truth",
  "daily_guidance",
  "yes_no",
  "weekly_forecast",
  "new_moon_intentions",
  "full_moon_release",
  "elemental_balance",
  "past_life_karma",
  "compatibility",
] as const;

export type SpreadType = (typeof SPREAD_TYPES)[number];
export type CardCategory = "all" | "major_arcana" | "minor_arcana" | "wands" | "cups" | "swords" | "pentacles";
