import { CardMeanings, DrawnCard } from "../../shared/types.js";

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
export function generateOverallInterpretation(drawnCards: DrawnCard[]): string {
  let overall = "**Overall Interpretation:**\n\n";

  // Analyze the energy of the reading
  const uprightCount = drawnCards.filter(c => c.orientation === "upright").length;
  const majorArcanaCount = drawnCards.filter(c => c.card.arcana === "major").length;
  const totalCards = drawnCards.length;

  // Major Arcana influence analysis
  if (majorArcanaCount > totalCards / 2) {
    overall += "This reading is heavily influenced by Major Arcana cards, indicating that significant spiritual forces, life lessons, and karmic influences are at work. The universe is guiding you through important transformations. ";
  } else if (majorArcanaCount === 0) {
    overall += "This reading contains only Minor Arcana cards, suggesting that the situation is primarily within your control and relates to everyday matters and practical concerns. ";
  } else {
    overall += "The balance of Major and Minor Arcana cards suggests a blend of spiritual guidance and practical action is needed. ";
  }

  // Orientation analysis
  const uprightPercentage = (uprightCount / totalCards) * 100;
  if (uprightPercentage >= 80) {
    overall += "The predominance of upright cards indicates positive energy, clear direction, and favorable circumstances. You're aligned with the natural flow of events. ";
  } else if (uprightPercentage >= 60) {
    overall += "Most cards are upright, suggesting generally positive energy with some areas requiring attention or inner work. ";
  } else if (uprightPercentage >= 40) {
    overall += "The balance of upright and reversed cards indicates a mixed situation with both opportunities and challenges present. ";
  } else if (uprightPercentage >= 20) {
    overall += "The majority of reversed cards suggests internal blocks, delays, or the need for significant introspection and inner work. ";
  } else {
    overall += "The predominance of reversed cards indicates a time of deep inner transformation, spiritual crisis, or significant obstacles that require patience and self-reflection. ";
  }

  // Add specific guidance based on card combinations and spread type
  overall += generateAdvancedCombinationInterpretation(drawnCards);

  return overall;
}

/**
 * Generate advanced interpretation for card combinations
 */
function generateAdvancedCombinationInterpretation(drawnCards: DrawnCard[]): string {
  let interpretation = "";

  // Elemental analysis
  const elementCounts = analyzeElements(drawnCards);
  interpretation += interpretElementalBalance(elementCounts);

  // Suit analysis for Minor Arcana
  const suitAnalysis = analyzeSuits(drawnCards);
  interpretation += suitAnalysis;

  // Numerical patterns
  const numericalAnalysis = analyzeNumericalPatterns(drawnCards);
  interpretation += numericalAnalysis;

  // Court card analysis
  const courtCardAnalysis = analyzeCourtCards(drawnCards);
  interpretation += courtCardAnalysis;

  // Archetypal patterns in Major Arcana
  const archetypeAnalysis = analyzeMajorArcanaPatterns(drawnCards);
  interpretation += archetypeAnalysis;

  interpretation += "\n\nTrust your intuition as you reflect on these insights and how they apply to your specific situation.";

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
function interpretElementalBalance(elementCounts: Record<string, number>): string {
  const total = Object.values(elementCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return "";

  let interpretation = "";
  const dominantElement = Object.entries(elementCounts)
    .sort(([,a], [,b]) => b - a)[0];

  if (dominantElement[1] > total / 2) {
    switch (dominantElement[0]) {
      case "fire":
        interpretation += "The dominance of Fire energy suggests this is a time for action, creativity, and passionate pursuit of your goals. ";
        break;
      case "water":
        interpretation += "The prevalence of Water energy indicates this situation is deeply emotional and intuitive, requiring you to trust your feelings. ";
        break;
      case "air":
        interpretation += "The abundance of Air energy suggests this is primarily a mental matter requiring clear thinking, communication, and intellectual approach. ";
        break;
      case "earth":
        interpretation += "The strong Earth energy indicates this situation requires practical action, patience, and attention to material concerns. ";
        break;
    }
  }

  // Check for missing elements
  const missingElements = Object.entries(elementCounts)
    .filter(([, count]) => count === 0)
    .map(([element]) => element);

  if (missingElements.length > 0) {
    interpretation += `The absence of ${missingElements.join(" and ")} energy suggests you may need to cultivate these qualities to achieve balance. `;
  }

  return interpretation;
}

/**
 * Analyze suit patterns
 */
function analyzeSuits(drawnCards: DrawnCard[]): string {
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
      interpretation += "The multiple Wands indicate this situation involves creative projects, career ambitions, and the need for decisive action. ";
      break;
    case "cups":
      interpretation += "The presence of multiple Cups shows this is fundamentally about emotions, relationships, and spiritual matters. ";
      break;
    case "swords":
      interpretation += "The dominance of Swords reveals this situation involves mental challenges, conflicts, and the need for clear communication. ";
      break;
    case "pentacles":
      interpretation += "Multiple Pentacles emphasize material concerns, financial matters, and the need for practical, grounded action. ";
      break;
  }

  return interpretation;
}

/**
 * Analyze numerical patterns in the reading
 */
function analyzeNumericalPatterns(drawnCards: DrawnCard[]): string {
  const numbers = drawnCards
    .filter(c => c.card.number !== undefined)
    .map(c => c.card.number!);

  if (numbers.length < 2) return "";

  let interpretation = "";
  const avgNumber = numbers.reduce((a, b) => a + b, 0) / numbers.length;

  // Analyze the journey stage
  if (avgNumber <= 3) {
    interpretation += "The low-numbered cards indicate this situation is in its beginning stages, full of potential and new energy. ";
  } else if (avgNumber <= 6) {
    interpretation += "The mid-range numbers suggest this situation is in its development phase, requiring steady progress and patience. ";
  } else if (avgNumber <= 9) {
    interpretation += "The higher numbers indicate this situation is approaching completion or mastery, requiring final efforts. ";
  } else {
    interpretation += "The presence of high numbers and court cards suggests mastery, completion, or the involvement of significant people. ";
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
  const repeatedThemes = repeatedNumbers
    .map((num) => REPEATED_NUMBER_THEMES[num])
    .filter((theme): theme is string => theme !== undefined);

  if (repeatedThemes.length > 0) {
    interpretation += `The repetition of ${repeatedNumbers.join(" and ")} emphasizes the themes of ${repeatedThemes.join(", ")}. `;
  }

  return interpretation;
}

/**
 * Analyze court cards in the reading
 */
function analyzeCourtCards(drawnCards: DrawnCard[]): string {
  const courtCards = drawnCards.filter(c =>
    c.card.name.includes("Page") ||
    c.card.name.includes("Knight") ||
    c.card.name.includes("Queen") ||
    c.card.name.includes("King")
  );

  if (courtCards.length === 0) return "";

  let interpretation = "";
  if (courtCards.length === 1) {
    interpretation += "The presence of a court card suggests that a specific person or personality aspect is significant to this situation. ";
  } else {
    interpretation += `The ${courtCards.length} court cards indicate that multiple people or personality aspects are influencing this situation. `;
  }

  return interpretation;
}

/**
 * Analyze Major Arcana patterns and archetypal themes
 */
function analyzeMajorArcanaPatterns(drawnCards: DrawnCard[]): string {
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
      interpretation += "The wide span of Major Arcana cards suggests you're experiencing a significant life transformation that touches many aspects of your spiritual journey. ";
    } else if (span < 5) {
      interpretation += "The close grouping of Major Arcana cards indicates you're working through a specific phase of spiritual development. ";
    }
  }

  // Look for specific archetypal themes
  const cardNames = majorCards.map(c => c.card.name.toLowerCase());

  if (cardNames.includes("the fool") && cardNames.includes("the magician")) {
    interpretation += "The presence of both The Fool and The Magician suggests a powerful combination of new beginnings and the ability to manifest your desires. ";
  }

  if (cardNames.includes("the high priestess") && cardNames.includes("the hierophant")) {
    interpretation += "The High Priestess and Hierophant together indicate a balance between inner wisdom and traditional teachings. ";
  }

  return interpretation;
}
