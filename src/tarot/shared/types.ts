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
}

export interface DrawnCard {
  card: TarotCard;
  orientation: "upright" | "reversed";
  position?: string;
  positionMeaning?: string;
}

export interface TarotSpread {
  name: string;
  description: string;
  positions: {
    name: string;
    meaning: string;
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
}

export interface TarotSession {
  id: string;
  readings: TarotReading[];
  createdAt: Date;
  lastActivity: Date;
}

export type CardOrientation = "upright" | "reversed";

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
