import { SpreadType } from "../shared/types.js";

export const RECOMMENDATION_TIMEFRAMES = [
  "immediate",
  "short_term",
  "long_term",
  "any",
] as const;
export type RecommendationTimeframe = (typeof RECOMMENDATION_TIMEFRAMES)[number];

export const RECOMMENDATION_CATEGORIES = [
  "love",
  "career",
  "spiritual",
  "general",
  "decision",
  "any",
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export interface SpreadRecommendation {
  spread: SpreadType;
  reason: string;
  confidence: number;
}

interface RecommendationRule {
  /** Fires when the explicit category matches ... */
  category?: RecommendationCategory;
  /** ... or the explicit timeframe matches ... */
  timeframe?: RecommendationTimeframe;
  /** ... or any keyword appears in the lowercased question. */
  keywords?: string[];
  recommendations: SpreadRecommendation[];
}

/**
 * Keyword/category heuristics mapping questions to spreads. Rule order
 * matters: confidence ties keep earlier rules first (stable sort).
 */
const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    category: "love",
    keywords: ["love", "relationship", "partner"],
    recommendations: [
      {
        spread: "venus_love",
        reason: "Perfect for love and relationship questions",
        confidence: 0.9,
      },
      {
        spread: "relationship_cross",
        reason: "Comprehensive relationship analysis",
        confidence: 0.8,
      },
      {
        spread: "compatibility",
        reason: "Great for understanding relationship dynamics",
        confidence: 0.7,
      },
    ],
  },
  {
    category: "career",
    keywords: ["job", "career", "work"],
    recommendations: [
      {
        spread: "career_path",
        reason: "Specialized for career guidance",
        confidence: 0.9,
      },
    ],
  },
  {
    category: "spiritual",
    keywords: ["spiritual", "soul", "purpose"],
    recommendations: [
      {
        spread: "spiritual_guidance",
        reason: "Focused on spiritual development",
        confidence: 0.9,
      },
      {
        spread: "tree_of_life",
        reason: "Deep spiritual insights",
        confidence: 0.8,
      },
    ],
  },
  {
    category: "decision",
    keywords: ["should i", "decision", "choose"],
    recommendations: [
      {
        spread: "decision_making",
        reason: "Designed for important decisions",
        confidence: 0.9,
      },
      {
        spread: "yes_no",
        reason: "Simple yes/no guidance",
        confidence: 0.7,
      },
    ],
  },
  {
    timeframe: "immediate",
    keywords: ["today", "now"],
    recommendations: [
      {
        spread: "daily_guidance",
        reason: "Perfect for immediate guidance",
        confidence: 0.8,
      },
      {
        spread: "single_card",
        reason: "Quick insight for immediate questions",
        confidence: 0.7,
      },
    ],
  },
  {
    timeframe: "short_term",
    keywords: ["week", "month"],
    recommendations: [
      {
        spread: "weekly_forecast",
        reason: "Great for weekly planning",
        confidence: 0.8,
      },
      {
        spread: "three_card",
        reason: "Good for short-term situations",
        confidence: 0.7,
      },
    ],
  },
  {
    timeframe: "long_term",
    keywords: ["year", "future"],
    recommendations: [
      {
        spread: "year_ahead",
        reason: "Comprehensive yearly guidance",
        confidence: 0.9,
      },
      {
        spread: "celtic_cross",
        reason: "In-depth long-term analysis",
        confidence: 0.8,
      },
    ],
  },
  {
    keywords: ["past life", "karma"],
    recommendations: [
      {
        spread: "past_life_karma",
        reason: "Explores karmic patterns",
        confidence: 0.9,
      },
    ],
  },
  {
    keywords: ["moon", "lunar", "cycle"],
    recommendations: [
      {
        spread: "new_moon_intentions",
        reason: "Perfect for lunar work",
        confidence: 0.8,
      },
      {
        spread: "full_moon_release",
        reason: "Great for release work",
        confidence: 0.8,
      },
    ],
  },
  {
    keywords: ["balance", "element"],
    recommendations: [
      {
        spread: "elemental_balance",
        reason: "Examines elemental harmony",
        confidence: 0.8,
      },
    ],
  },
  {
    keywords: ["shadow", "hidden", "unconscious"],
    recommendations: [
      {
        spread: "shadow_work",
        reason: "Explores hidden aspects",
        confidence: 0.9,
      },
    ],
  },
];

const DEFAULT_RECOMMENDATIONS: SpreadRecommendation[] = [
  {
    spread: "three_card",
    reason: "Versatile spread for most questions",
    confidence: 0.6,
  },
  {
    spread: "celtic_cross",
    reason: "Comprehensive analysis for complex situations",
    confidence: 0.5,
  },
];

const MAX_RECOMMENDATIONS = 3;

/**
 * Recommend spreads for a question. Returns the top matches (up to 3),
 * deduplicated and ordered by confidence.
 */
export function recommendSpreads(
  question: string,
  timeframe: RecommendationTimeframe = "any",
  category: RecommendationCategory = "any",
): SpreadRecommendation[] {
  const questionLower = question.toLowerCase();

  const matched = RECOMMENDATION_RULES.filter(
    (rule) =>
      (rule.category !== undefined && rule.category === category) ||
      (rule.timeframe !== undefined && rule.timeframe === timeframe) ||
      (rule.keywords ?? []).some((keyword) => questionLower.includes(keyword)),
  ).flatMap((rule) => rule.recommendations);

  const candidates = matched.length > 0 ? matched : DEFAULT_RECOMMENDATIONS;

  return candidates
    .filter(
      (rec, index, self) =>
        self.findIndex((r) => r.spread === rec.spread) === index,
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_RECOMMENDATIONS);
}
