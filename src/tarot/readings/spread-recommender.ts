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
  /** Chinese reason; falls back to `reason` when absent. */
  reasonZh?: string;
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
        reasonZh: "最适合爱情与关系类问题",
        confidence: 0.9,
      },
      {
        spread: "relationship_cross",
        reason: "Comprehensive relationship analysis",
        reasonZh: "全面的关系分析",
        confidence: 0.8,
      },
      {
        spread: "compatibility",
        reason: "Great for understanding relationship dynamics",
        reasonZh: "适合理解关系中的互动",
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
        reasonZh: "专为事业指引设计",
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
        reasonZh: "聚焦灵性发展",
        confidence: 0.9,
      },
      {
        spread: "tree_of_life",
        reason: "Deep spiritual insights",
        reasonZh: "深层的灵性洞见",
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
        reasonZh: "为重要抉择而设计",
        confidence: 0.9,
      },
      {
        spread: "yes_no",
        reason: "Simple yes/no guidance",
        reasonZh: "简明的是/否指引",
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
        reasonZh: "最适合即时指引",
        confidence: 0.8,
      },
      {
        spread: "single_card",
        reason: "Quick insight for immediate questions",
        reasonZh: "为紧迫问题提供快速洞见",
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
        reasonZh: "适合一周规划",
        confidence: 0.8,
      },
      {
        spread: "three_card",
        reason: "Good for short-term situations",
        reasonZh: "适合短期形势",
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
        reasonZh: "全面的年度指引",
        confidence: 0.9,
      },
      {
        spread: "celtic_cross",
        reason: "In-depth long-term analysis",
        reasonZh: "深入的长期分析",
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
        reasonZh: "探索业力模式",
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
        reasonZh: "最适合月相工作",
        confidence: 0.8,
      },
      {
        spread: "full_moon_release",
        reason: "Great for release work",
        reasonZh: "适合释放与放下",
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
        reasonZh: "检视元素的和谐",
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
        reasonZh: "探索隐藏的面向",
        confidence: 0.9,
      },
    ],
  },
];

const DEFAULT_RECOMMENDATIONS: SpreadRecommendation[] = [
  {
    spread: "three_card",
    reason: "Versatile spread for most questions",
    reasonZh: "适用于大多数问题的万用牌阵",
    confidence: 0.6,
  },
  {
    spread: "celtic_cross",
    reason: "Comprehensive analysis for complex situations",
    reasonZh: "复杂局面的全面分析",
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
