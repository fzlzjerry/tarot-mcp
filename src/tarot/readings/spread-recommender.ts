import { SpreadType } from "../shared/types.js";

export const RECOMMENDATION_TIMEFRAMES = [
  "immediate",
  "short_term",
  "long_term",
  "any",
] as const;
export type RecommendationTimeframe =
  (typeof RECOMMENDATION_TIMEFRAMES)[number];

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
  category?: RecommendationCategory;
  timeframe?: RecommendationTimeframe;
  /** Explicit patterns matched with word boundaries for English and clean phrases for Chinese. */
  patterns?: RegExp[];
  /** Exclude this keyword rule if the question explicitly belongs to another domain. */
  excludePatterns?: RegExp[];
  recommendations: SpreadRecommendation[];
}

const WORKPLACE_GUARD =
  /(\b(career|job|work|workplace|colleague|colleagues|coworker|coworkers|boss|manager|promotion|company|team|office)\b|同事|上司|老板|职场|工作|事业|职业|求职|升职|公司|团队)/i;

const EXPLICIT_LOVE_GUARD =
  /(\b(love|romance|romantic|partner|marriage|dating|crush|breakup|boyfriend|girlfriend|spouse)\b|爱情|恋爱|感情|伴侣|对象|婚姻|分手|复合|暧昧)/i;

/**
 * Intent/category/timeframe rules mapping questions to spreads.
 * Uses word-boundary matching for English (preventing "know" -> "now") and
 * gives explicit category parameters precedence over incidental keyword collisions.
 */
const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    category: "love",
    patterns: [
      /\b(love|romance|romantic|partner|marriage|dating|crush|breakup|spouse)\b/i,
      /\brelationship\b/i,
      /(爱情|恋爱|感情|伴侣|对象|婚姻|分手|复合|暧昧)/,
      /关系/,
    ],
    excludePatterns: [WORKPLACE_GUARD],
    recommendations: [
      {
        spread: "venus_love",
        reason: "Focused 7-card spread for love and romantic dynamics",
        reasonZh: "7 张牌聚焦爱情与亲密关系的流动",
        confidence: 0.9,
      },
      {
        spread: "relationship_cross",
        reason: "7-card spread contrasting both perspectives, what unites, and what divides",
        reasonZh: "7 张牌对照双方立场、连结与分歧",
        confidence: 0.8,
      },
      {
        spread: "compatibility",
        reason: "8-card spread exploring communication, shared goals, and long-term fit",
        reasonZh: "8 张牌深入沟通方式、共同目标与长远契合度",
        confidence: 0.7,
      },
    ],
  },
  {
    category: "career",
    patterns: [
      /\b(job|career|work|workplace|colleague|colleagues|coworker|boss|manager|promotion|salary|business)\b/i,
      /(工作|事业|职业|求职|升职|职场|同事|老板|跳槽|面试)/,
    ],
    recommendations: [
      {
        spread: "career_path",
        reason: "6-card spread mapping skills, obstacles, hidden openings, and next step",
        reasonZh: "6 张牌拆解现状、优势、阻碍、潜藏机会与下一步",
        confidence: 0.9,
      },
    ],
  },
  {
    category: "spiritual",
    patterns: [
      /\b(spiritual|spirituality|soul|purpose|calling|awakening)\b/i,
      /(灵性|灵魂|使命|人生目的|内在成长)/,
    ],
    recommendations: [
      {
        spread: "spiritual_guidance",
        reason: "6-card spread focused on inner alignment and next lessons",
        reasonZh: "6 张牌聚焦灵性状态、阻滞与成长功课",
        confidence: 0.9,
      },
      {
        spread: "tree_of_life",
        reason: "10-card structural spread for deep personal and spiritual inquiry",
        reasonZh: "10 张牌生命之树结构，适合深层自我与灵性探索",
        confidence: 0.8,
      },
    ],
  },
  {
    category: "decision",
    patterns: [
      /\b(should i|decision|decide|choose|choice|option|between)\b/i,
      /(应该|决定|抉择|选择|选哪|要不要)/,
    ],
    recommendations: [
      {
        spread: "decision_making",
        reason: "5-card spread comparing Option A, Option B, hidden factors, and recommended path",
        reasonZh: "5 张牌对比方案 A/B、盲区因素与建议路径",
        confidence: 0.9,
      },
      {
        spread: "yes_no",
        reason: "Compact 3-card check weighing supporting and opposing forces",
        reasonZh: "紧凑 3 张牌，对照支持面与阻力面",
        confidence: 0.7,
      },
    ],
  },
  {
    timeframe: "immediate",
    patterns: [/\b(today|now|right now|tonight)\b/i, /(今天|今日|此刻|当下)/],
    recommendations: [
      {
        spread: "daily_guidance",
        reason: "Single focused card for immediate clarity without overcomplicating",
        reasonZh: "单牌直击核心，适合今日或眼前的即时指引",
        confidence: 0.8,
      },
      {
        spread: "single_card",
        reason: "Quick 1-card insight for a direct, narrow question",
        reasonZh: "1 张牌快速切入明确单一的问题",
        confidence: 0.7,
      },
    ],
  },
  {
    timeframe: "short_term",
    patterns: [
      /\b(this week|next week|weekly|this month|next month)\b/i,
      /(本周|这周|下周|一周|本月|这个月)/,
    ],
    recommendations: [
      {
        spread: "weekly_forecast",
        reason: "7-card cadence mapping day-by-day momentum across the week",
        reasonZh: "7 张牌梳理一周内的节奏与重心变化",
        confidence: 0.8,
      },
      {
        spread: "three_card",
        reason: "Balanced 3-card arc (situation, action, outcome) for near-term clarity",
        reasonZh: "3 张牌（现状/行动/走向），兼顾清晰度与轻量节奏",
        confidence: 0.7,
      },
    ],
  },
  {
    timeframe: "long_term",
    patterns: [
      /\b(this year|next year|year ahead|whole year|long[- ]term)\b/i,
      /(今年|明年|一整年|全年|年度|长期规划)/,
    ],
    recommendations: [
      {
        spread: "year_ahead",
        reason: "13-card annual map covering each month plus an overarching theme",
        reasonZh: "13 张牌覆盖全年十二个月与年度总主题",
        confidence: 0.9,
      },
      {
        spread: "celtic_cross",
        reason: "10-card comprehensive view for multi-layered long-term situations",
        reasonZh: "10 张牌凯尔特十字，适合多维度复杂长期议题",
        confidence: 0.8,
      },
    ],
  },
  {
    patterns: [/\b(past life|karma|karmic)\b/i, /(前世|业力|因果)/],
    recommendations: [
      {
        spread: "past_life_karma",
        reason: "6-card spread exploring recurring karmic patterns and lessons",
        reasonZh: "6 张牌探索反复出现的业力模式与功课",
        confidence: 0.9,
      },
    ],
  },
  {
    patterns: [/\b(moon|lunar)\b/i, /(月亮|月相|满月|新月)/],
    recommendations: [
      {
        spread: "new_moon_intentions",
        reason: "5-card lunar spread for setting grounded intentions",
        reasonZh: "5 张牌新月牌阵，适合设定新周期意图",
        confidence: 0.8,
      },
      {
        spread: "full_moon_release",
        reason: "5-card lunar spread for clarity and releasing what is complete",
        reasonZh: "5 张牌满月牌阵，适合沉淀收获与放下旧负担",
        confidence: 0.8,
      },
    ],
  },
  {
    patterns: [/\b(elemental|elements|balance)\b/i, /(元素平衡|四元素)/],
    recommendations: [
      {
        spread: "elemental_balance",
        reason: "5-card check across Fire, Water, Air, Earth, and integration",
        reasonZh: "5 张牌检视火水风土四元素与整合重心",
        confidence: 0.8,
      },
    ],
  },
  {
    patterns: [
      /\b(shadow|hidden|unconscious|subconscious)\b/i,
      /(阴影|隐藏|潜意识|无意识)/,
    ],
    recommendations: [
      {
        spread: "shadow_work",
        reason: "5-card spread examining blind spots and unacknowledged patterns",
        reasonZh: "5 张牌探索潜藏盲区与尚未直面的内在模式",
        confidence: 0.9,
      },
    ],
  },
];

const DEFAULT_RECOMMENDATIONS: SpreadRecommendation[] = [
  {
    spread: "three_card",
    reason: "Balanced 3-card spread (situation, action, outcome) suited to most questions",
    reasonZh: "3 张牌（现状/行动/走向），适用于大多数问题的清晰切入",
    confidence: 0.6,
  },
  {
    spread: "celtic_cross",
    reason: "Comprehensive 10-card view when a situation has many moving parts",
    reasonZh: "10 张牌全景牌阵，适合脉络复杂的议题",
    confidence: 0.5,
  },
];

const MAX_RECOMMENDATIONS = 3;

function ruleMatchesKeyword(rule: RecommendationRule, question: string): boolean {
  if (!rule.patterns || rule.patterns.length === 0) return false;
  if (
    rule.excludePatterns?.some((re) => re.test(question)) &&
    !(rule.category === "love" && EXPLICIT_LOVE_GUARD.test(question))
  ) {
    return false;
  }
  return rule.patterns.some((re) => re.test(question));
}

/**
 * Recommend spreads for a question. Explicit category and timeframe signals
 * take precedence over raw keyword heuristics so an explicit career query
 * containing "关系" is never hijacked by love spreads.
 */
export function recommendSpreads(
  question: string,
  timeframe: RecommendationTimeframe = "any",
  category: RecommendationCategory = "any",
): SpreadRecommendation[] {
  const hasExplicitCategory = category !== "any" && category !== "general";
  const hasExplicitTimeframe = timeframe !== "any";

  const matched: SpreadRecommendation[] = [];

  for (const rule of RECOMMENDATION_RULES) {
    const explicitCategoryHit =
      hasExplicitCategory && rule.category === category;
    const explicitTimeframeHit =
      hasExplicitTimeframe && rule.timeframe === timeframe;

    // When caller explicitly sets a category, don't let a conflicting category's
    // keyword heuristic hijack the top recommendation.
    const allowKeywordHit =
      !(hasExplicitCategory && rule.category !== undefined && rule.category !== category);
    const keywordHit = allowKeywordHit && ruleMatchesKeyword(rule, question);

    if (explicitCategoryHit || explicitTimeframeHit || keywordHit) {
      const boost = explicitCategoryHit ? 0.05 : 0;
      for (const rec of rule.recommendations) {
        matched.push({
          ...rec,
          confidence: Math.min(1, Number((rec.confidence + boost).toFixed(2))),
        });
      }
    }
  }

  const candidates = matched.length > 0 ? matched : DEFAULT_RECOMMENDATIONS;

  return candidates
    .filter(
      (rec, index, self) =>
        self.findIndex((r) => r.spread === rec.spread) === index,
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_RECOMMENDATIONS);
}
