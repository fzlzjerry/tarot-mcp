import { getCanonMeaning } from "../../canon/index.js";
import {
  CardMeanings,
  CardOrientation,
  DrawnCard,
  Language,
  PositionRole,
} from "../../shared/types.js";
import { localizedElement, pick } from "../../shared/i18n.js";
import { classifyQuestionDomain, resolvePositionRole } from "./evidence.js";

const MAJOR_ARCANA_RATIO = 22 / 78;

/**
 * Themes evoked when a Minor Arcana pip rank (1-10) appears more than once in
 * a reading. Strictly scoped to Minor Arcana numbered pips so Major Arcana
 * (0-21) and Court cards (11-14) never collide with pip numerology.
 */
const REPEATED_PIP_THEMES: Record<number, string> = {
  1: "new beginnings and raw potential",
  2: "balance, choice, and partnership",
  3: "growth, synthesis, and collaboration",
  4: "stability, structure, and consolidation",
  5: "friction, change, and adaptation",
  6: "reciprocity, harmony, and adjustment",
  7: "assessment, perseverance, and inner testing",
  8: "momentum, mastery, and focused effort",
  9: "near-completion, resilience, and reflection",
  10: "culmination, saturation, and cycle transitions",
};

const REPEATED_PIP_THEMES_ZH: Record<number, string> = {
  1: "全新起点与原始潜能",
  2: "平衡、抉择与合作关系",
  3: "成长、整合与协作推进",
  4: "稳固、结构与根基夯实",
  5: "摩擦、变动与调适考验",
  6: "互惠、调和与重新校准",
  7: "审视、耐力与内在试炼",
  8: "推进、精进与专注发力",
  9: "临近收尾、韧性与沉淀",
  10: "阶段顶点、饱和与周期转换",
};

const REPEATED_COURT_THEMES: Record<number, string> = {
  11: "messages and fresh perspectives",
  12: "movement and decisive action",
  13: "emotional depth and mastery",
  14: "leadership and command",
};

const REPEATED_COURT_THEMES_ZH: Record<number, string> = {
  11: "新讯息与新鲜视角",
  12: "推进节奏与果断行动",
  13: "内在定力与成熟掌控",
  14: "领导担当与全局统筹",
};

export interface MeaningSelectionOptions {
  cardId?: string;
  orientation?: CardOrientation;
  positionRole?: PositionRole;
  language?: Language;
}

/**
 * Select the most relevant meaning from the user's question domain and
 * language-independent position role. Falls back to explicit domain keywords
 * in a position description only when the user's question itself is general,
 * using classifyQuestionDomain so neutral words like "energy" never leak.
 */
export function selectRelevantMeaning(
  meanings: CardMeanings,
  position: string,
  question: string,
  positionMeaning: string = "",
  options?: MeaningSelectionOptions,
): string {
  const questionDomain = classifyQuestionDomain(question);
  const domain =
    questionDomain !== "general"
      ? questionDomain
      : classifyQuestionDomain(`${position} ${positionMeaning}`);

  if (options?.cardId && options.orientation && options.language) {
    const canonText = getCanonMeaning(
      options.cardId,
      options.orientation,
      domain,
      options.positionRole,
      options.language,
    );
    if (canonText) return canonText;
  }

  return meanings[domain];
}

/**
 * Generate overall interpretation considering factual spread structure,
 * baseline-aware Major Arcana density, elemental/suit distribution, Minor pip
 * patterns, and Court card presence. Never treats upright as automatically
 * favorable or reversed as automatically unfavorable.
 */
export function generateOverallInterpretation(
  drawnCards: DrawnCard[],
  language: Language = "en",
): string {
  const majorArcanaCount = drawnCards.filter(
    (c) => c.card.arcana === "major",
  ).length;
  const uprightCount = drawnCards.filter(
    (c) => c.orientation === "upright",
  ).length;
  const reversedCount = drawnCards.length - uprightCount;
  const totalCards = drawnCards.length;

  let interpretation = pick(
    language,
    "\n**Overall Reading Insights:**\n",
    "\n**整体解读：**\n",
  );

  // Baseline-aware Major Arcana analysis (22/78 ≈ 28.2% deck baseline)
  if (totalCards > 0) {
    const expectedMajor = Number((totalCards * MAJOR_ARCANA_RATIO).toFixed(1));
    const majorRatio = majorArcanaCount / totalCards;
    if (majorArcanaCount === totalCards && totalCards >= 2) {
      interpretation += pick(
        language,
        `All ${totalCards} cards are Major Arcana (deck baseline ~${expectedMajor}), pointing to pivotal archetypal themes rather than routine day-to-day detail. `,
        `抽出的 ${totalCards} 张全部是大阿卡纳（按整副牌 28% 基准期望约 ${expectedMajor} 张），说明此事触及关键的人生阶段性课题，而非琐碎日常波动。`,
      );
    } else if (majorArcanaCount >= 2 && majorRatio >= 0.5) {
      interpretation += pick(
        language,
        `${majorArcanaCount} of ${totalCards} cards are Major Arcana (above the ~${expectedMajor} deck baseline), signaling weighty turning-point themes alongside practical choices. `,
        `${totalCards} 张牌中有 ${majorArcanaCount} 张大阿卡纳（高于约 ${expectedMajor} 张的基准期望），显示具体处境背后伴随较深层的转折课题。`,
      );
    } else if (majorArcanaCount === 0 && totalCards >= 3) {
      interpretation += pick(
        language,
        "All drawn cards are Minor Arcana, keeping the center of gravity on everyday choices, habits, and practical adjustments within your reach. ",
        "全部为小阿卡纳，说明重心落在日常选择、具体习惯与你当下即可着手调整的现实层面。",
      );
    }
  }

  // Factual orientation balance (orientation expresses mode, not valence)
  if (totalCards >= 2) {
    if (reversedCount === 0) {
      interpretation += pick(
        language,
        `All ${totalCards} cards are upright, indicating direct, outward expression of each card's own archetype—read the tone from the cards themselves and their positions rather than assuming smooth sailing. `,
        `${totalCards} 张牌全部正位，代表每张牌的本义都以直接外显的方式呈现——局势顺逆仍需依单牌原型与所在牌位判断，而不等同于一味利好。`,
      );
    } else if (uprightCount === 0) {
      interpretation += pick(
        language,
        `All ${totalCards} cards are reversed, drawing focus toward inward processing, friction, delay, or release of old pressure—each reversal invites nuanced inspection rather than an automatic warning. `,
        `${totalCards} 张牌全部逆位，将焦点引向内在消化、受阻延宕或旧压松动——每张逆位都应结合牌位细读其具体分支，而非一概视作不利。`,
      );
    } else {
      interpretation += pick(
        language,
        `The balance of ${uprightCount} upright and ${reversedCount} reversed cards contrasts direct outer dynamics with areas calling for inward reflection, boundary work, or recalibration. `,
        `${uprightCount} 张正位与 ${reversedCount} 张逆位并存，形成了外显推进与需要内省、疏通或校准面向之间的对照。`,
      );
    }
  }

  // Element balance analysis
  const elements = analyzeElements(drawnCards);
  const elementAnalysis = interpretElementalBalance(elements, language);
  interpretation += elementAnalysis;

  // Suit distribution analysis
  const suitAnalysis = analyzeSuits(drawnCards, language);
  interpretation += suitAnalysis;

  // Minor Arcana Pip numerical patterns (strictly 1-10)
  const numericalAnalysis = analyzeNumericalPatterns(drawnCards, language);
  interpretation += numericalAnalysis;

  // Court card analysis (strictly Minor Arcana 11-14)
  const courtCardAnalysis = analyzeCourtCards(drawnCards, language);
  interpretation += courtCardAnalysis;

  // Archetypal patterns in Major Arcana
  const archetypeAnalysis = analyzeMajorArcanaPatterns(drawnCards, language);
  interpretation += archetypeAnalysis;

  // Position-role synthesis note when multiple roles are present
  const roles = new Set(drawnCards.map((c) => resolvePositionRole(c)));
  if (roles.has("challenge") && roles.has("resource")) {
    interpretation += pick(
      language,
      "Read the resource position directly alongside the challenge position to see what leverage offsets the main friction. ",
      "建议把「资源/助力」位与「阻碍/挑战」位并置对照，直接看清手中哪项杠杆能化解主要阻力。",
    );
  }

  interpretation += pick(
    language,
    "\n\nGround these patterns in your concrete facts and test one practical next step rather than treating any card as a fixed prediction.",
    "\n\n请将这些脉络放回现实条件中核对，优先验证一个可落地的下一步，而不把牌面当作注定不变的预言。",
  );

  return interpretation;
}

function analyzeElements(drawnCards: DrawnCard[]): Record<string, number> {
  const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };

  drawnCards.forEach((drawnCard) => {
    if (drawnCard.card.element) {
      elementCounts[drawnCard.card.element]++;
    }
  });

  return elementCounts;
}

function interpretElementalBalance(
  elementCounts: Record<string, number>,
  language: Language,
): string {
  const total = Object.values(elementCounts).reduce((a, b) => a + b, 0);
  if (total < 2) return "";

  let interpretation = "";
  const dominantElement = Object.entries(elementCounts).sort(
    ([, a], [, b]) => b - a,
  )[0];

  if (dominantElement[1] > total / 2) {
    switch (dominantElement[0]) {
      case "fire":
        interpretation += pick(
          language,
          "Fire leads the elemental mix, centering momentum on initiative, drive, and decisive execution. ",
          "火元素占主导，整体重心偏向主动推进、创造意愿与果断执行。",
        );
        break;
      case "water":
        interpretation += pick(
          language,
          "Water leads the elemental mix, placing emotional resonance, trust, and relational nuance at the forefront. ",
          "水元素突出，情感流动、信任感与关系细腻度处于核心位置。",
        );
        break;
      case "air":
        interpretation += pick(
          language,
          "Air leads the elemental mix, making clear analysis, candid speech, and crisp boundaries decisive. ",
          "风元素充沛，理性拆解、坦诚沟通与明确边界将是破局关键。",
        );
        break;
      case "earth":
        interpretation += pick(
          language,
          "Earth leads the elemental mix, anchoring the reading in tangible craft, resources, and steady follow-through. ",
          "土元素强劲，重点落在务实落地、资源统筹与循序渐进的交付上。",
        );
        break;
    }
  }

  // Missing elements are meaningful mainly in larger spreads (4+ cards)
  if (total >= 4) {
    const missingElements = Object.entries(elementCounts)
      .filter(([, count]) => count === 0)
      .map(([element]) => element);

    if (missingElements.length > 0 && missingElements.length < 4) {
      interpretation += pick(
        language,
        `The absence of ${missingElements.join(" and ")} energy highlights qualities you may want to bring in deliberately for balance. `,
        `${missingElements.map((element) => localizedElement(element, "zh")).join("与")}元素暂未出现，提示你可能需要在行动中有意识地补足这部分视角。`,
      );
    }
  }

  return interpretation;
}

function analyzeSuits(drawnCards: DrawnCard[], language: Language): string {
  const suits = drawnCards
    .filter((c) => c.card.suit)
    .map((c) => c.card.suit!);

  const suitCounts = suits.reduce(
    (acc, suit) => {
      acc[suit] = (acc[suit] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const dominantSuit = Object.entries(suitCounts).sort(
    ([, a], [, b]) => b - a,
  )[0];

  if (!dominantSuit || dominantSuit[1] <= 1) return "";

  switch (dominantSuit[0]) {
    case "wands":
      return pick(
        language,
        "Multiple Wands concentrate the spread around ambition, creative energy, and workload pacing. ",
        "多张权杖牌把焦点收束在行动力、创造抱负与精力负荷的节奏上。",
      );
    case "cups":
      return pick(
        language,
        "Multiple Cups place relationships, emotional honesty, and belonging at the center of this question. ",
        "多张圣杯牌将人际连结、情绪坦诚与归属感推到了问题核心。",
      );
    case "swords":
      return pick(
        language,
        "Multiple Swords emphasize mental clarity, difficult conversations, and sorting fact from assumption. ",
        "多张宝剑牌强调思维清明、直面沟通，以及把事实从猜测中剥离出来。",
      );
    case "pentacles":
      return pick(
        language,
        "Multiple Pentacles ground the reading in practical craft, material resources, and concrete habits. ",
        "多张星币牌把焦点锚定在专业手艺、现实资源与具体可执行的习惯上。",
      );
    default:
      return "";
  }
}

/**
 * Analyze Minor Arcana pip numerology (1-10 ONLY).
 * Major Arcana (0-21) and Court cards (11-14) are intentionally excluded so
 * The World (21) never triggers "court cards" and Justice (11) never collides
 * with Page (11).
 */
function analyzeNumericalPatterns(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  const pipNumbers = drawnCards
    .filter(
      (c) =>
        c.card.arcana === "minor" &&
        c.card.number !== undefined &&
        c.card.number >= 1 &&
        c.card.number <= 10,
    )
    .map((c) => c.card.number!);

  if (pipNumbers.length < 2) return "";

  let interpretation = "";
  const avgNumber = pipNumbers.reduce((a, b) => a + b, 0) / pipNumbers.length;

  if (avgNumber <= 3) {
    interpretation += pick(
      language,
      "The low-numbered Minor Arcana pips indicate an early-stage dynamic still open to shaping. ",
      "偏小的小阿卡纳点数表明事情尚在早期展开阶段，仍有很大的塑形空间。",
    );
  } else if (avgNumber <= 6) {
    interpretation += pick(
      language,
      "Mid-range Minor Arcana pips reflect an active development and adjustment phase. ",
      "中段小阿卡纳点数说明事情正处在推进与磨合调整期。",
    );
  } else {
    interpretation += pick(
      language,
      "Higher Minor Arcana pips (7–10) point toward late-stage effort, culmination, or wrapping up a cycle. ",
      "偏高的小阿卡纳点数（7–10）指向冲刺收尾、阶段饱和或一轮周期的收束。",
    );
  }

  const numberCounts = pipNumbers.reduce(
    (acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  const repeatedNumbers = Object.entries(numberCounts)
    .filter(([, count]) => count > 1)
    .map(([num]) => parseInt(num, 10));

  const themeTable =
    language === "zh" ? REPEATED_PIP_THEMES_ZH : REPEATED_PIP_THEMES;
  const repeatedThemes = repeatedNumbers
    .map((num) => themeTable[num])
    .filter((theme): theme is string => theme !== undefined);

  if (repeatedThemes.length > 0) {
    interpretation += pick(
      language,
      `Repeated pip rank ${repeatedNumbers.join(" and ")} underscores themes of ${repeatedThemes.join(", ")}. `,
      `小阿卡纳点数 ${repeatedNumbers.join(" 和 ")} 重复出现，强化了${repeatedThemes.join("、")}这一阶段主题。`,
    );
  }

  return interpretation;
}

/**
 * Analyze Court cards (strictly Minor Arcana ranks 11–14: Page/Knight/Queen/King).
 * Repeated Minor court ranks (e.g. two Pages) are noted cleanly here without
 * ever colliding with Major Arcana numbers (Justice=11, Death=13, World=21).
 */
function analyzeCourtCards(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  const courtCards = drawnCards.filter(
    (c) =>
      c.card.arcana === "minor" &&
      c.card.number !== undefined &&
      c.card.number >= 11 &&
      c.card.number <= 14,
  );

  if (courtCards.length === 0) return "";

  let interpretation = "";
  if (courtCards.length === 1) {
    interpretation += pick(
      language,
      "A court card highlights a key person, interpersonal dynamic, or leadership stance you are invited to step into. ",
      "出现的宫廷牌提示某位关键人物、人际角色，或当下需要你展现的处事姿态。",
    );
  } else {
    interpretation += pick(
      language,
      `${courtCards.length} court cards indicate that multiple personalities, stakeholders, or competing roles are shaping this situation. `,
      `${courtCards.length} 张宫廷牌表明有多位相关方或不同处事角色正在共同影响这个局面。`,
    );

    const rankCounts = courtCards.reduce(
      (acc, c) => {
        const rank = c.card.number!;
        acc[rank] = (acc[rank] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );
    const repeatedRanks = Object.entries(rankCounts)
      .filter(([, count]) => count > 1)
      .map(([rank]) => parseInt(rank, 10));
    const courtThemes =
      language === "zh" ? REPEATED_COURT_THEMES_ZH : REPEATED_COURT_THEMES;
    const repeatedCourtThemes = repeatedRanks
      .map((rank) => courtThemes[rank])
      .filter((theme): theme is string => theme !== undefined);

    if (repeatedCourtThemes.length > 0) {
      interpretation += pick(
        language,
        `The repetition of ${repeatedRanks.join(" and ")} emphasizes the themes of ${repeatedCourtThemes.join(", ")}. `,
        `宫廷牌阶位 ${repeatedRanks.join(" 和 ")} 重复出现，突出了${repeatedCourtThemes.join("、")}的共通主题。`,
      );
    }
  }

  return interpretation;
}

/**
 * Analyze Major Arcana progression and classic archetypal pairings.
 */
function analyzeMajorArcanaPatterns(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  const majorCards = drawnCards.filter((c) => c.card.arcana === "major");
  if (majorCards.length === 0) return "";

  let interpretation = "";

  const majorNumbers = majorCards
    .map((c) => c.card.number)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);

  if (majorNumbers.length > 1) {
    const span = majorNumbers[majorNumbers.length - 1] - majorNumbers[0];
    if (span > 10) {
      interpretation += pick(
        language,
        "The wide Major Arcana span bridges early initiation and deep structural transformation across the spread. ",
        "大阿卡纳跨度较大，连接起初期启程与深层转化的两端课题。",
      );
    } else if (span < 5) {
      interpretation += pick(
        language,
        "Closely grouped Major Arcana numbers focus attention on one concentrated stage of personal transition. ",
        "大阿卡纳序号紧邻，说明你正集中穿越人生转折中的同一个核心阶段。",
      );
    }
  }

  const cardNames = majorCards.map((c) => c.card.name.toLowerCase());

  if (cardNames.includes("the fool") && cardNames.includes("the magician")) {
    interpretation += pick(
      language,
      "The Fool alongside The Magician pairs fresh curiosity with the practical tools to act on it. ",
      "愚者与魔术师同场出现，将敞开的好奇心与落地显化的行动力扣合在一起。",
    );
  }

  if (
    cardNames.includes("the high priestess") &&
    cardNames.includes("the hierophant")
  ) {
    interpretation += pick(
      language,
      "The High Priestess and The Hierophant balance quiet personal intuition against established structure and mentorship. ",
      "女祭司与教皇并现，映照出内在直觉与传统章法、师承体系之间的张力与平衡。",
    );
  }

  return interpretation;
}
