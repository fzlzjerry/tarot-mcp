import { CardMeanings, DrawnCard, Language } from "../../shared/types.js";
import { pick } from "../../shared/i18n.js";

/**
 * Themes evoked when a card number appears more than once in a reading.
 * Covers 1-10 (pips) and 11-14 (Page/Knight/Queen/King court cards).
 */
const REPEATED_NUMBER_THEMES: Record<number, string> = {
  1: "new beginnings and potential",
  2: "balance and partnerships",
  3: "creativity and growth",
  4: "stability and foundation",
  5: "change and challenge",
  6: "harmony and responsibility",
  7: "spiritual development and introspection",
  8: "material mastery and achievement",
  9: "completion and wisdom",
  10: "fulfillment and new cycles",
  11: "messages and fresh perspectives",
  12: "action and determined pursuit",
  13: "nurturing mastery and intuition",
  14: "authority and leadership",
};

const REPEATED_NUMBER_THEMES_ZH: Record<number, string> = {
  1: "新的开始与潜能",
  2: "平衡与伙伴关系",
  3: "创造力与成长",
  4: "稳定与根基",
  5: "变化与挑战",
  6: "和谐与责任",
  7: "灵性发展与内省",
  8: "物质掌控与成就",
  9: "完成与智慧",
  10: "圆满与新循环",
  11: "讯息与新视角",
  12: "行动与坚定追求",
  13: "滋养的成熟与直觉",
  14: "权威与领导力",
};

const ELEMENT_NAMES_ZH: Record<string, string> = {
  fire: "火",
  water: "水",
  air: "风",
  earth: "土",
};

/**
 * Select the most relevant meaning based on position and question
 */
export function selectRelevantMeaning(
  meanings: CardMeanings,
  position: string,
  question: string,
  positionMeaning: string = ""
): string {
  const contextLower = `${question} ${position} ${positionMeaning}`.toLowerCase();

  // Determine the most relevant aspect based on question content
  if (matchesContext(contextLower, [
    "love",
    "relationship",
    "romance",
    "partner",
    "marriage",
    "affection",
    "爱情",
    "感情",
    "恋爱",
    "关系",
    "伴侣",
    "婚姻",
  ])) {
    return meanings.love;
  } else if (matchesContext(contextLower, [
    "career",
    "job",
    "work",
    "business",
    "money",
    "finance",
    "study",
    "事业",
    "工作",
    "职业",
    "财务",
    "金钱",
    "学习",
  ])) {
    return meanings.career;
  } else if (matchesContext(contextLower, [
    "health",
    "wellness",
    "body",
    "energy",
    "rest",
    "健康",
    "身体",
    "精力",
    "休息",
  ])) {
    return meanings.health;
  } else if (matchesContext(contextLower, [
    "spiritual",
    "purpose",
    "meaning",
    "soul",
    "growth",
    "灵性",
    "精神",
    "意义",
    "使命",
    "成长",
  ])) {
    return meanings.spirituality;
  }

  return meanings.general;
}

function matchesContext(context: string, terms: string[]): boolean {
  return terms.some((term) => context.includes(term));
}

/**
 * Generate overall interpretation considering card interactions
 */
export function generateOverallInterpretation(
  drawnCards: DrawnCard[],
  language: Language = "en",
): string {
  let overall = pick(language, "**Overall Interpretation:**\n\n", "**整体解读：**\n\n");

  // Analyze the energy of the reading
  const uprightCount = drawnCards.filter(c => c.orientation === "upright").length;
  const majorArcanaCount = drawnCards.filter(c => c.card.arcana === "major").length;
  const totalCards = drawnCards.length;

  // Major Arcana influence analysis
  if (majorArcanaCount > totalCards / 2) {
    overall += pick(
      language,
      "This reading is heavily influenced by Major Arcana cards, indicating that significant spiritual forces, life lessons, and karmic influences are at work. The universe is guiding you through important transformations. ",
      "这次解读深受大阿卡纳牌的影响，表明重要的灵性力量、人生课题与业力正在起作用。宇宙正引导你经历重要的转化。",
    );
  } else if (majorArcanaCount === 0) {
    overall += pick(
      language,
      "This reading contains only Minor Arcana cards, suggesting that the situation is primarily within your control and relates to everyday matters and practical concerns. ",
      "这次解读全部由小阿卡纳牌组成，说明局面主要在你的掌控之中，与日常事务和现实考量相关。",
    );
  } else {
    overall += pick(
      language,
      "The balance of Major and Minor Arcana cards suggests a blend of spiritual guidance and practical action is needed. ",
      "大小阿卡纳的均衡出现，说明你需要将灵性指引与实际行动结合起来。",
    );
  }

  // Orientation analysis
  const uprightPercentage = (uprightCount / totalCards) * 100;
  if (uprightPercentage >= 80) {
    overall += pick(
      language,
      "The predominance of upright cards indicates positive energy, clear direction, and favorable circumstances. You're aligned with the natural flow of events. ",
      "正位牌占绝大多数，显示出积极的能量、清晰的方向和有利的形势。你正顺应着事件的自然流动。",
    );
  } else if (uprightPercentage >= 60) {
    overall += pick(
      language,
      "Most cards are upright, suggesting generally positive energy with some areas requiring attention or inner work. ",
      "大部分牌为正位，总体能量积极，但仍有一些方面需要关注或做内在功课。",
    );
  } else if (uprightPercentage >= 40) {
    overall += pick(
      language,
      "The balance of upright and reversed cards indicates a mixed situation with both opportunities and challenges present. ",
      "正逆位牌数量相当，局面喜忧参半，机会与挑战并存。",
    );
  } else if (uprightPercentage >= 20) {
    overall += pick(
      language,
      "The majority of reversed cards suggests internal blocks, delays, or the need for significant introspection and inner work. ",
      "逆位牌居多，提示存在内在阻碍、延迟，或需要深入的自省与内在功课。",
    );
  } else {
    overall += pick(
      language,
      "The predominance of reversed cards indicates a time of deep inner transformation, spiritual crisis, or significant obstacles that require patience and self-reflection. ",
      "逆位牌占绝大多数，预示着一段深层内在转化、灵性危机或重大阻碍的时期，需要耐心与自我反思。",
    );
  }

  // Add specific guidance based on card combinations and spread type
  overall += generateAdvancedCombinationInterpretation(drawnCards, language);

  return overall;
}

/**
 * Generate advanced interpretation for card combinations
 */
function generateAdvancedCombinationInterpretation(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  let interpretation = "";

  // Elemental analysis
  const elementCounts = analyzeElements(drawnCards);
  interpretation += interpretElementalBalance(elementCounts, language);

  // Suit analysis for Minor Arcana
  const suitAnalysis = analyzeSuits(drawnCards, language);
  interpretation += suitAnalysis;

  // Numerical patterns
  const numericalAnalysis = analyzeNumericalPatterns(drawnCards, language);
  interpretation += numericalAnalysis;

  // Court card analysis
  const courtCardAnalysis = analyzeCourtCards(drawnCards, language);
  interpretation += courtCardAnalysis;

  // Archetypal patterns in Major Arcana
  const archetypeAnalysis = analyzeMajorArcanaPatterns(drawnCards, language);
  interpretation += archetypeAnalysis;

  interpretation += pick(
    language,
    "\n\nTrust your intuition as you reflect on these insights and how they apply to your specific situation.",
    "\n\n在回味这些洞见、思考它们如何对应你的具体处境时，请相信自己的直觉。",
  );

  return interpretation;
}

/**
 * Analyze elemental balance in the reading
 */
function analyzeElements(drawnCards: DrawnCard[]): Record<string, number> {
  const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };

  drawnCards.forEach(drawnCard => {
    if (drawnCard.card.element) {
      elementCounts[drawnCard.card.element]++;
    }
  });

  return elementCounts;
}

/**
 * Interpret elemental balance
 */
function interpretElementalBalance(
  elementCounts: Record<string, number>,
  language: Language,
): string {
  const total = Object.values(elementCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return "";

  let interpretation = "";
  const dominantElement = Object.entries(elementCounts)
    .sort(([,a], [,b]) => b - a)[0];

  if (dominantElement[1] > total / 2) {
    switch (dominantElement[0]) {
      case "fire":
        interpretation += pick(
          language,
          "The dominance of Fire energy suggests this is a time for action, creativity, and passionate pursuit of your goals. ",
          "火元素能量占主导，说明此刻适合行动、发挥创造力并满怀热情地追求目标。",
        );
        break;
      case "water":
        interpretation += pick(
          language,
          "The prevalence of Water energy indicates this situation is deeply emotional and intuitive, requiring you to trust your feelings. ",
          "水元素能量突出，表明这个局面情感深沉且依赖直觉，需要你信任自己的感受。",
        );
        break;
      case "air":
        interpretation += pick(
          language,
          "The abundance of Air energy suggests this is primarily a mental matter requiring clear thinking, communication, and intellectual approach. ",
          "风元素能量充沛，说明这主要是一件需要清晰思考、沟通与理性处理的事情。",
        );
        break;
      case "earth":
        interpretation += pick(
          language,
          "The strong Earth energy indicates this situation requires practical action, patience, and attention to material concerns. ",
          "土元素能量强劲，表明这个局面需要务实的行动、耐心以及对物质层面的关注。",
        );
        break;
    }
  }

  // Check for missing elements
  const missingElements = Object.entries(elementCounts)
    .filter(([, count]) => count === 0)
    .map(([element]) => element);

  if (missingElements.length > 0) {
    interpretation += pick(
      language,
      `The absence of ${missingElements.join(" and ")} energy suggests you may need to cultivate these qualities to achieve balance. `,
      `${missingElements.map((element) => ELEMENT_NAMES_ZH[element] ?? element).join("与")}元素能量的缺席，提示你可能需要培养这些特质来达到平衡。`,
    );
  }

  return interpretation;
}

/**
 * Analyze suit patterns
 */
function analyzeSuits(drawnCards: DrawnCard[], language: Language): string {
  const suits = drawnCards
    .filter(c => c.card.suit)
    .map(c => c.card.suit!);

  const suitCounts = suits.reduce((acc, suit) => {
    acc[suit] = (acc[suit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dominantSuit = Object.entries(suitCounts)
    .sort(([,a], [,b]) => b - a)[0];

  if (!dominantSuit || dominantSuit[1] <= 1) return "";

  let interpretation = "";
  switch (dominantSuit[0]) {
    case "wands":
      interpretation += pick(
        language,
        "The multiple Wands indicate this situation involves creative projects, career ambitions, and the need for decisive action. ",
        "多张权杖牌表明这个局面涉及创造性项目、事业抱负，并需要果断的行动。",
      );
      break;
    case "cups":
      interpretation += pick(
        language,
        "The presence of multiple Cups shows this is fundamentally about emotions, relationships, and spiritual matters. ",
        "多张圣杯牌显示，这件事本质上关乎情感、关系与心灵层面。",
      );
      break;
    case "swords":
      interpretation += pick(
        language,
        "The dominance of Swords reveals this situation involves mental challenges, conflicts, and the need for clear communication. ",
        "宝剑牌占主导，揭示这个局面涉及思维上的挑战、冲突，以及清晰沟通的必要。",
      );
      break;
    case "pentacles":
      interpretation += pick(
        language,
        "Multiple Pentacles emphasize material concerns, financial matters, and the need for practical, grounded action. ",
        "多张星币牌强调物质层面的考量、财务事项，以及脚踏实地行动的必要。",
      );
      break;
  }

  return interpretation;
}

/**
 * Analyze numerical patterns in the reading
 */
function analyzeNumericalPatterns(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  const numbers = drawnCards
    .filter(c => c.card.number !== undefined)
    .map(c => c.card.number!);

  if (numbers.length < 2) return "";

  let interpretation = "";
  const avgNumber = numbers.reduce((a, b) => a + b, 0) / numbers.length;

  // Analyze the journey stage
  if (avgNumber <= 3) {
    interpretation += pick(
      language,
      "The low-numbered cards indicate this situation is in its beginning stages, full of potential and new energy. ",
      "偏小的数字表明事情尚处于起步阶段，充满潜能与新能量。",
    );
  } else if (avgNumber <= 6) {
    interpretation += pick(
      language,
      "The mid-range numbers suggest this situation is in its development phase, requiring steady progress and patience. ",
      "中段的数字说明事情正处于发展期，需要稳步推进与耐心。",
    );
  } else if (avgNumber <= 9) {
    interpretation += pick(
      language,
      "The higher numbers indicate this situation is approaching completion or mastery, requiring final efforts. ",
      "偏大的数字表明事情已接近完成或成熟，需要最后的冲刺。",
    );
  } else {
    interpretation += pick(
      language,
      "The presence of high numbers and court cards suggests mastery, completion, or the involvement of significant people. ",
      "高位数字与宫廷牌的出现，预示着成熟、圆满，或有重要人物参与其中。",
    );
  }

  // Look for repeated numbers
  const numberCounts = numbers.reduce((acc, num) => {
    acc[num] = (acc[num] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const repeatedNumbers = Object.entries(numberCounts)
    .filter(([, count]) => count > 1)
    .map(([num]) => parseInt(num));

  // Only numbers with a known theme contribute; guard so an unthemed
  // repeat can never trigger the sentence (and corrupt surrounding text).
  const themeTable =
    language === "zh" ? REPEATED_NUMBER_THEMES_ZH : REPEATED_NUMBER_THEMES;
  const repeatedThemes = repeatedNumbers
    .map((num) => themeTable[num])
    .filter((theme): theme is string => theme !== undefined);

  if (repeatedThemes.length > 0) {
    interpretation += pick(
      language,
      `The repetition of ${repeatedNumbers.join(" and ")} emphasizes the themes of ${repeatedThemes.join(", ")}. `,
      `数字 ${repeatedNumbers.join(" 和 ")} 的重复出现，强调了${repeatedThemes.join("、")}这些主题。`,
    );
  }

  return interpretation;
}

/**
 * Analyze court cards in the reading
 */
function analyzeCourtCards(drawnCards: DrawnCard[], language: Language): string {
  const courtCards = drawnCards.filter(c =>
    c.card.name.includes("Page") ||
    c.card.name.includes("Knight") ||
    c.card.name.includes("Queen") ||
    c.card.name.includes("King")
  );

  if (courtCards.length === 0) return "";

  let interpretation = "";
  if (courtCards.length === 1) {
    interpretation += pick(
      language,
      "The presence of a court card suggests that a specific person or personality aspect is significant to this situation. ",
      "一张宫廷牌的出现，提示某个特定的人或人格面向对这个局面有重要影响。",
    );
  } else {
    interpretation += pick(
      language,
      `The ${courtCards.length} court cards indicate that multiple people or personality aspects are influencing this situation. `,
      `${courtCards.length} 张宫廷牌表明有多个人或多种人格面向正在影响这个局面。`,
    );
  }

  return interpretation;
}

/**
 * Analyze Major Arcana patterns and archetypal themes
 */
function analyzeMajorArcanaPatterns(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  const majorCards = drawnCards.filter(c => c.card.arcana === "major");
  if (majorCards.length === 0) return "";

  let interpretation = "";

  // Analyze the Fool's Journey progression
  const majorNumbers = majorCards
    .map(c => c.card.number)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);

  if (majorNumbers.length > 1) {
    const span = majorNumbers[majorNumbers.length - 1] - majorNumbers[0];
    if (span > 10) {
      interpretation += pick(
        language,
        "The wide span of Major Arcana cards suggests you're experiencing a significant life transformation that touches many aspects of your spiritual journey. ",
        "大阿卡纳牌的跨度很大，说明你正经历一场触及灵性旅程诸多层面的重大人生转化。",
      );
    } else if (span < 5) {
      interpretation += pick(
        language,
        "The close grouping of Major Arcana cards indicates you're working through a specific phase of spiritual development. ",
        "大阿卡纳牌集中在相近的阶段，表明你正在深入修习灵性发展的某个特定课题。",
      );
    }
  }

  // Look for specific archetypal themes
  const cardNames = majorCards.map(c => c.card.name.toLowerCase());

  if (cardNames.includes("the fool") && cardNames.includes("the magician")) {
    interpretation += pick(
      language,
      "The presence of both The Fool and The Magician suggests a powerful combination of new beginnings and the ability to manifest your desires. ",
      "愚者与魔术师同时出现，预示着新开始与心想事成的显化能力的强大组合。",
    );
  }

  if (cardNames.includes("the high priestess") && cardNames.includes("the hierophant")) {
    interpretation += pick(
      language,
      "The High Priestess and Hierophant together indicate a balance between inner wisdom and traditional teachings. ",
      "女祭司与教皇同时出现，象征内在智慧与传统教诲之间的平衡。",
    );
  }

  return interpretation;
}
