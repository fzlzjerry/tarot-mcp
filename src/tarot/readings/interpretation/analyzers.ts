import { DrawnCard, Language, SpreadType } from "../../shared/types.js";
import { isValidSpreadType } from "../spreads.js";

/**
 * Spread-specific analyzers keyed by the stable spread type id (never the
 * display name, which is presentation and can collide with custom spread
 * names). Types without an entry fall back to the generic analysis.
 */
const SPREAD_ANALYZERS: Partial<
  Record<SpreadType, (drawnCards: DrawnCard[]) => string>
> = {
  three_card: generateThreeCardAnalysis,
  celtic_cross: generateCelticCrossAnalysis,
  relationship_cross: generateRelationshipAnalysis,
  career_path: generateCareerAnalysis,
  spiritual_guidance: generateSpiritualAnalysis,
  year_ahead: generateYearAheadAnalysis,
  chakra_alignment: generateChakraAnalysis,
  venus_love: generateVenusLoveAnalysis,
  tree_of_life: generateTreeOfLifeAnalysis,
  astrological_houses: generateAstrologicalAnalysis,
  mandala: generateMandalaAnalysis,
  pentagram: generatePentagramAnalysis,
  mirror_of_truth: generateMirrorOfTruthAnalysis,
};

/**
 * Pick the spread-specific analyzer registered for the spread type id.
 * Returns "" when no analyzer is registered or the card count doesn't fit.
 */
export function selectSpreadAnalysis(
  drawnCards: DrawnCard[],
  spreadType: string,
): string {
  const analyzer = isValidSpreadType(spreadType)
    ? SPREAD_ANALYZERS[spreadType]
    : undefined;
  return analyzer ? analyzer(drawnCards) : "";
}

/**
 * Generate Celtic Cross specific analysis
 */
function generateCelticCrossAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 10) return "";

  let analysis = "**Celtic Cross Analysis:**\n\n";

  // Analyze key relationships between positions
  const present = drawnCards[0];
  const challenge = drawnCards[1];
  const distantPast = drawnCards[2];
  const recentPast = drawnCards[3];
  const possibleOutcome = drawnCards[4];
  const nearFuture = drawnCards[5];
  const approach = drawnCards[6];
  const external = drawnCards[7];
  const hopesFears = drawnCards[8];
  const finalOutcome = drawnCards[9];

  analysis += `**Current Pattern:** ${withDefiniteArticle(present.card.name)} at the center is crossed by ${challenge.card.name}, showing the main tension in the situation. `;
  if (present.orientation === challenge.orientation) {
    analysis += "Because both cards share the same orientation, the challenge is visible and can be addressed directly. ";
  } else {
    analysis += "The different orientations suggest a contrast between the obvious situation and the way the challenge is operating. ";
  }

  analysis += `**Possible vs Final Outcome:** The possible outcome (${possibleOutcome.card.name}) `;
  if (cardsHaveSimilarEnergy(possibleOutcome, finalOutcome)) {
    analysis += "aligns with the final outcome, suggesting the current path can mature without a drastic change. ";
  } else {
    analysis += "differs from the final outcome, so the reading points to a course correction before the pattern settles. ";
  }

  analysis += `**Near Future Impact:** ${withDefiniteArticle(nearFuture.card.name)} in your near future will `;
  if (nearFuture.orientation === "upright") {
    analysis += "support your journey toward the final outcome. ";
  } else {
    analysis += "present challenges that need to be navigated carefully to reach your desired outcome. ";
  }

  analysis += `**Past Movement:** ${distantPast.card.name} sets the deeper foundation, while ${recentPast.card.name} shows what is now passing out of the foreground. `;
  analysis += `**Response Pattern:** Your approach (${approach.card.name}) meets external influences (${external.card.name}) and the hopes or fears carried by ${hopesFears.card.name}. `;

  analysis += "\n";
  return analysis;
}

export function generateGenericSpreadAnalysis(
  drawnCards: DrawnCard[],
  language: Language = "en",
): string {
  const first = drawnCards[0];
  const last = drawnCards[drawnCards.length - 1];

  if (language === "zh") {
    let analysis = "**牌阵脉络分析:**\n\n";
    analysis += `这个牌阵从「${first.position || "起始牌"}」(${first.card.name})延展到「${last.position || "收尾牌"}」(${last.card.name})。`;
    analysis += "此布局没有专属的牌阵模板,因此解读以每个牌位的含义、牌的正逆位、元素平衡与问题语境作为诠释框架。\n\n";
    return analysis;
  }

  let analysis = "**Contextual Spread Analysis:**\n\n";
  analysis += `This spread moves from ${first.position || "the opening card"} (${first.card.name}) to ${last.position || "the closing card"} (${last.card.name}). `;
  analysis += "No dedicated spread template is registered for this layout, so the reading uses each position meaning, card orientation, elemental balance, and the question context as its interpretive frame.\n\n";
  return analysis;
}

/**
 * Generate Three Card specific analysis
 */
function generateThreeCardAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 3) return "";

  let analysis = "**Three Card Flow Analysis:**\n\n";

  const [past, present, future] = drawnCards;

  analysis += `**The Journey:** From ${past.card.name} in the past, through ${present.card.name} in the present, to ${future.card.name} in the future, `;

  // Analyze the progression
  const pastEnergy = past.orientation === "upright" ? "positive" : "challenging";
  const presentEnergy = present.orientation === "upright" ? "positive" : "challenging";
  const futureEnergy = future.orientation === "upright" ? "positive" : "challenging";

  if (pastEnergy === "challenging" && presentEnergy === "positive" && futureEnergy === "positive") {
    analysis += "shows a clear progression from difficulty to resolution and success. ";
  } else if (pastEnergy === "positive" && presentEnergy === "challenging" && futureEnergy === "positive") {
    analysis += "indicates a temporary setback that will resolve positively. ";
  } else if (pastEnergy === "positive" && presentEnergy === "positive" && futureEnergy === "positive") {
    analysis += "reveals a consistently positive trajectory with continued growth. ";
  } else {
    analysis += "shows a complex journey requiring careful attention to the lessons each phase offers. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Relationship spread specific analysis
 */
function generateRelationshipAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 7) return "";

  let analysis = "**Relationship Dynamics Analysis:**\n\n";

  const you = drawnCards[0];
  const partner = drawnCards[1];
  const relationship = drawnCards[2];
  const unites = drawnCards[3];

  // Analyze compatibility
  analysis += `**Compatibility Assessment:** `;
  if (you.orientation === partner.orientation) {
    analysis += "You and your partner are currently in similar emotional states, which can create harmony. ";
  } else {
    analysis += "You and your partner are in different emotional phases, which requires understanding and patience. ";
  }

  // Analyze relationship balance
  const positiveCards = [you, partner, relationship, unites].filter(c => c.orientation === "upright").length;
  if (positiveCards >= 3) {
    analysis += "The overall energy of the relationship is positive and supportive. ";
  } else {
    analysis += "The relationship may need attention and conscious effort to improve dynamics. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Career spread specific analysis
 */
function generateCareerAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 6) return "";

  let analysis = "**Career Path Analysis:**\n\n";

  const skills = drawnCards[1];
  const challenges = drawnCards[2];
  const opportunities = drawnCards[3];

  // Analyze career readiness
  analysis += `**Career Readiness:** `;
  if (skills.orientation === "upright" && opportunities.orientation === "upright") {
    analysis += "You have strong skills and good opportunities ahead. This is a favorable time for career advancement. ";
  } else if (challenges.orientation === "reversed") {
    analysis += "Previous obstacles are clearing, making way for new professional growth. ";
  } else {
    analysis += "Focus on developing your skills and overcoming current challenges before pursuing new opportunities. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Spiritual Guidance spread analysis
 */
function generateSpiritualAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 6) return "";

  let analysis = "**Spiritual Development Analysis:**\n\n";

  const spiritualState = drawnCards[0];
  const blocks = drawnCards[2];

  // Analyze spiritual progress
  analysis += `**Spiritual Progress:** `;
  if (spiritualState.orientation === "upright") {
    analysis += "You are in a positive phase of spiritual growth and awareness. ";
  } else {
    analysis += "You may be experiencing spiritual challenges or confusion that require inner work. ";
  }

  if (blocks.orientation === "reversed") {
    analysis += "Previous spiritual blocks are dissolving, allowing for greater growth. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Chakra Alignment spread analysis
 */
function generateChakraAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 7) return "";

  let analysis = "**Chakra Energy Analysis:**\n\n";

  const uprightChakras = drawnCards.filter(c => c.orientation === "upright").length;
  const balancePercentage = (uprightChakras / 7) * 100;

  analysis += `**Overall Energy Balance:** `;
  if (balancePercentage >= 70) {
    analysis += "Your chakras are well-balanced with strong energy flow. ";
  } else if (balancePercentage >= 50) {
    analysis += "Your energy centers have moderate balance with some areas needing attention. ";
  } else {
    analysis += "Several chakras need healing and rebalancing for optimal energy flow. ";
  }

  // Identify energy patterns
  const lowerChakras = drawnCards.slice(0, 3).filter(c => c.orientation === "upright").length;
  const upperChakras = drawnCards.slice(4, 7).filter(c => c.orientation === "upright").length;

  if (lowerChakras > upperChakras) {
    analysis += "Your grounding and physical energy centers are stronger than your spiritual centers. ";
  } else if (upperChakras > lowerChakras) {
    analysis += "Your spiritual and intuitive centers are more active than your grounding centers. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Year Ahead spread analysis
 */
function generateYearAheadAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 13) return "";

  let analysis = "**Year Ahead Overview:**\n\n";

  const overallTheme = drawnCards[0];
  const monthlyCards = drawnCards.slice(1);

  // Analyze overall year energy
  analysis += `**Year Theme:** ${withDefiniteArticle(overallTheme.card.name)} sets the tone for your year, `;
  if (overallTheme.orientation === "upright") {
    analysis += "indicating a positive and growth-oriented period ahead. ";
  } else {
    analysis += "suggesting a year of inner work and overcoming challenges. ";
  }

  // Analyze seasonal patterns
  const quarters = [
    monthlyCards.slice(0, 3), // Q1: Jan-Mar
    monthlyCards.slice(3, 6), // Q2: Apr-Jun
    monthlyCards.slice(6, 9), // Q3: Jul-Sep
    monthlyCards.slice(9, 12) // Q4: Oct-Dec
  ];

  quarters.forEach((quarter, index) => {
    const uprightCount = quarter.filter(c => c.orientation === "upright").length;
    const quarterNames = ["First Quarter", "Second Quarter", "Third Quarter", "Fourth Quarter"];

    analysis += `**${quarterNames[index]}:** `;
    if (uprightCount >= 2) {
      analysis += "A positive and productive period. ";
    } else {
      analysis += "A time for patience and inner work. ";
    }
  });

  analysis += "\n";
  return analysis;
}

/**
 * Generate Venus Love spread analysis
 */
function generateVenusLoveAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 7) return "";

  let analysis = "**Venus Love Energy Analysis:**\n\n";

  const [currentEnergy, selfLove, attraction, blocks, , , future] = drawnCards;

  // Analyze love energy flow
  analysis += `**Love Energy Flow:** Your current relationship energy (${currentEnergy.card.name}) `;
  if (currentEnergy.orientation === "upright") {
    analysis += "shows positive romantic vibrations and openness to love. ";
  } else {
    analysis += "suggests some healing or inner work is needed before fully opening to love. ";
  }

  // Self-love foundation
  analysis += `Your self-love foundation (${selfLove.card.name}) `;
  if (selfLove.orientation === "upright") {
    analysis += "indicates healthy self-worth that attracts genuine love. ";
  } else {
    analysis += "reveals areas where self-compassion and self-acceptance need attention. ";
  }

  // Attraction and blocks
  analysis += `What attracts love to you (${attraction.card.name}) works in harmony with `;
  analysis += `overcoming blocks (${blocks.card.name}) to create a path forward. `;

  // Future potential
  analysis += `The future potential (${future.card.name}) `;
  if (future.orientation === "upright") {
    analysis += "promises beautiful developments in your love life. ";
  } else {
    analysis += "suggests patience and continued inner work will lead to love. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Tree of Life spread analysis
 */
function generateTreeOfLifeAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 10) return "";

  let analysis = "**Tree of Life Spiritual Analysis:**\n\n";

  const [kether, chokmah, binah, chesed, geburah, , netzach, hod, , malkuth] = drawnCards;

  // Analyze the three pillars
  const leftPillar = [binah, geburah, hod]; // Severity
  const rightPillar = [chokmah, chesed, netzach]; // Mercy

  // Pillar analysis
  const leftUprightCount = leftPillar.filter(c => c.orientation === "upright").length;
  const rightUprightCount = rightPillar.filter(c => c.orientation === "upright").length;

  analysis += `**Pillar Balance:** `;
  if (rightUprightCount > leftUprightCount) {
    analysis += "The Pillar of Mercy dominates, indicating expansion, growth, and positive energy. ";
  } else if (leftUprightCount > rightUprightCount) {
    analysis += "The Pillar of Severity is prominent, suggesting discipline, boundaries, and necessary restrictions. ";
  } else {
    analysis += "The pillars are balanced, showing harmony between expansion and contraction. ";
  }

  // Crown to Kingdom flow
  analysis += `**Divine Flow:** From Kether (${kether.card.name}) to Malkuth (${malkuth.card.name}), `;
  if (kether.orientation === malkuth.orientation) {
    analysis += "there's alignment between your highest purpose and material manifestation. ";
  } else {
    analysis += "there's a need to bridge the gap between spiritual ideals and earthly reality. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Astrological Houses spread analysis
 */
function generateAstrologicalAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 12) return "";

  let analysis = "**Astrological Houses Analysis:**\n\n";

  // Group houses by element
  const fireHouses = [drawnCards[0], drawnCards[4], drawnCards[8]]; // 1st, 5th, 9th
  const earthHouses = [drawnCards[1], drawnCards[5], drawnCards[9]]; // 2nd, 6th, 10th
  const airHouses = [drawnCards[2], drawnCards[6], drawnCards[10]]; // 3rd, 7th, 11th
  const waterHouses = [drawnCards[3], drawnCards[7], drawnCards[11]]; // 4th, 8th, 12th

  // Analyze elemental balance
  const fireUpright = fireHouses.filter(c => c.orientation === "upright").length;
  const earthUpright = earthHouses.filter(c => c.orientation === "upright").length;
  const airUpright = airHouses.filter(c => c.orientation === "upright").length;
  const waterUpright = waterHouses.filter(c => c.orientation === "upright").length;

  analysis += `**Elemental Balance:** `;
  const elements = [
    { name: "Fire (Identity/Creativity/Philosophy)", count: fireUpright },
    { name: "Earth (Resources/Work/Career)", count: earthUpright },
    { name: "Air (Communication/Partnerships/Community)", count: airUpright },
    { name: "Water (Home/Transformation/Spirituality)", count: waterUpright }
  ];

  const strongestElement = elements.reduce((max, current) =>
    current.count > max.count ? current : max
  );

  analysis += `${strongestElement.name} energy is strongest in your chart, `;
  analysis += `indicating focus in these life areas. `;

  // Angular houses analysis (1st, 4th, 7th, 10th)
  const angularHouses = [drawnCards[0], drawnCards[3], drawnCards[6], drawnCards[9]];
  const angularUpright = angularHouses.filter(c => c.orientation === "upright").length;

  analysis += `**Life Direction:** With ${angularUpright} out of 4 angular houses upright, `;
  if (angularUpright >= 3) {
    analysis += "you have strong momentum and clear direction in major life areas. ";
  } else if (angularUpright >= 2) {
    analysis += "you have moderate stability with some areas needing attention. ";
  } else {
    analysis += "focus on building stronger foundations in key life areas. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Mandala spread analysis
 */
function generateMandalaAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 9) return "";

  let analysis = "**Mandala Wholeness Analysis:**\n\n";

  const [center, north, northeast, east, southeast, south, southwest, west, northwest] = drawnCards;

  // Analyze center in relation to outer cards
  analysis += `**Core Integration:** Your center (${center.card.name}) `;
  if (center.orientation === "upright") {
    analysis += "shows a strong, balanced core that can integrate the surrounding energies. ";
  } else {
    analysis += "suggests the need for inner healing before achieving wholeness. ";
  }

  // Analyze directional balance
  const directions = [north, northeast, east, southeast, south, southwest, west, northwest];
  const uprightDirections = directions.filter(c => c.orientation === "upright").length;

  analysis += `**Directional Balance:** With ${uprightDirections} out of 8 directions upright, `;
  if (uprightDirections >= 6) {
    analysis += "your life energies are well-balanced and flowing harmoniously. ";
  } else if (uprightDirections >= 4) {
    analysis += "you have good balance with some areas needing attention. ";
  } else {
    analysis += "focus on healing and balancing multiple life areas. ";
  }

  // Opposite directions analysis
  const opposites = [
    [north, south], [east, west], [northeast, southwest], [southeast, northwest]
  ];

  let balancedPairs = 0;
  opposites.forEach(([dir1, dir2]) => {
    if (dir1.orientation === dir2.orientation) {
      balancedPairs++;
    }
  });

  analysis += `**Polarity Integration:** ${balancedPairs} out of 4 opposite pairs are balanced, `;
  if (balancedPairs >= 3) {
    analysis += "showing excellent integration of opposing forces. ";
  } else {
    analysis += "indicating opportunities to harmonize conflicting energies. ";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Pentagram spread analysis
 */
function generatePentagramAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 5) return "";

  let analysis = "**Pentagram Elemental Analysis:**\n\n";

  const [spirit, air, fire, earth, water] = drawnCards;

  // Analyze elemental balance
  const elements = [air, fire, earth, water];
  const uprightElements = elements.filter(c => c.orientation === "upright").length;

  analysis += `**Elemental Harmony:** With ${uprightElements} out of 4 elements upright, `;
  if (uprightElements === 4) {
    analysis += "all elements are in perfect harmony, creating powerful manifestation energy. ";
  } else if (uprightElements >= 3) {
    analysis += "strong elemental balance with minor adjustments needed. ";
  } else if (uprightElements >= 2) {
    analysis += "moderate balance requiring attention to weaker elements. ";
  } else {
    analysis += "significant elemental imbalance requiring healing and rebalancing. ";
  }

  // Spirit connection analysis
  analysis += `**Divine Connection:** Spirit (${spirit.card.name}) `;
  if (spirit.orientation === "upright") {
    analysis += "shows strong divine connection guiding your elemental balance. ";
  } else {
    analysis += "suggests the need to strengthen your spiritual foundation. ";
  }

  // Element-specific insights
  analysis += `**Elemental Flow:** `;
  if (air.orientation === "upright") analysis += "Clear thinking and communication support your goals. ";
  if (fire.orientation === "upright") analysis += "Passionate energy drives your actions. ";
  if (earth.orientation === "upright") analysis += "Practical foundations support manifestation. ";
  if (water.orientation === "upright") analysis += "Emotional wisdom guides your intuition. ";

  analysis += "\n";
  return analysis;
}

/**
 * Generate Mirror of Truth spread analysis
 */
function generateMirrorOfTruthAnalysis(drawnCards: DrawnCard[]): string {
  if (drawnCards.length !== 4) return "";

  let analysis = "**Mirror of Truth - Four Beams of Light Analysis:**\n\n";
  const [yourPerspective, theirIntention, objectiveTruth, futureGuidance] = drawnCards;

  // First Light Analysis - Your Perspective
  analysis += `**First Light - Illuminate Yourself:** ${yourPerspective.card.name} (${yourPerspective.orientation})\n`;
  analysis += `Your current emotional state and inner filters show: `;
  if (yourPerspective.orientation === "upright") {
    analysis += "Your perception of the situation is relatively clear, your emotional state is stable, and you can view the problem objectively.";
  }
  else {
    analysis += "Your perspective may be influenced by strong emotions, anxiety, or expectations, requiring inner calm to see the truth clearly.";
  }
  analysis += "\n\n";

  // Second Light Analysis - Their Intention
  analysis += `**Second Light - Explore Their Heart:** ${theirIntention.card.name} (${theirIntention.orientation})\n`;
  analysis += `Their true intentions and inner state indicate: `;
  if (theirIntention.orientation === "upright") {
    analysis += "Their motivations are relatively positive and sincere, with good intentions or at least neutral intent behind their actions.";
  }
  else {
    analysis += "They may have complex inner states, their true intentions might not align with surface behavior, or they themselves are confused.";
  }
  analysis += "\n\n";

  // Third Light Analysis - Objective Truth
  analysis += `**Third Light - Restore Original Truth:** ${objectiveTruth.card.name} (${objectiveTruth.orientation})\n`;
  analysis += `Stripping away all subjective emotions, the truth is: `;
  if (objectiveTruth.orientation === "upright") {
    analysis += "The situation itself is relatively simple and clear, you and the other person may have over-interpreted it. The facts are more direct than imagined.";
  }
  else {
    analysis += "The situation does have complexity and hidden layers, requiring more time and information to fully understand.";
  }
  analysis += "\n\n";

  // Fourth Light Analysis - Future Guidance
  analysis += `**Fourth Light - Guide Future Direction:** ${futureGuidance.card.name} (${futureGuidance.orientation})\n`;
  analysis += `Based on understanding the truth, you should: `;
  if (futureGuidance.orientation === "upright") {
    analysis += "Take positive and proactive action, now is a good time to clarify misunderstandings, improve relationships, or make decisions.";
  }
  else {
    analysis += "Maintain patience and observation, don't rush into action, let time and more information reveal the best path forward.";
  }
  analysis += "\n\n";

  // Comprehensive Analysis of Four Lights
  analysis += `**Comprehensive Insights from Four Lights:**\n`;
  const uprightCount = drawnCards.filter(c => c.orientation === "upright").length;

  // Analyze relationship between your perspective and their intention
  if (yourPerspective.orientation === theirIntention.orientation) {
    analysis += `Your perception and their intention are in similar energy states, indicating some synchronicity between you. `;
  }
  else {
    analysis += `Your perception and their intention have energy differences, which may be the source of misunderstanding. `;
  }

  // Analyze relationship between objective truth and guidance
  if (objectiveTruth.orientation === futureGuidance.orientation) {
    analysis += `The nature of the facts aligns with future guidance, indicating you can trust this direction. `;
  }
  else {
    analysis += `The complexity of the facts requires flexibility and openness in your actions. `;
  }

  // Overall clarity assessment
  analysis += `\n\n**Clarity of Truth:** ${uprightCount} out of 4 lights shine clearly, `;
  if (uprightCount === 4) {
    analysis += "all dimensions are clear, this is a moment of complete truth where decisive action can be taken.";
  }
  else if (uprightCount === 3) {
    analysis += "most of the truth has been revealed, requiring only patience and understanding in one dimension.";
  }
  else if (uprightCount === 2) {
    analysis += "truth is gradually emerging, requiring balance of information from different dimensions to make judgments.";
  }
  else if (uprightCount === 1) {
    analysis += "currently only one dimension is relatively clear, more time is needed for other truths to surface.";
  }
  else {
    analysis += "all dimensions are still in fog, this is a period requiring great patience and inner calm.";
  }

  analysis += "\n";
  return analysis;
}

/**
 * Prefix a card name with "The" unless it already starts with it
 * (Major Arcana names like "The Hierophant" must not become "The The ...").
 */
function withDefiniteArticle(cardName: string): string {
  return cardName.startsWith("The ") ? cardName : `The ${cardName}`;
}

/**
 * Check if two cards have similar energy
 */
function cardsHaveSimilarEnergy(card1: DrawnCard, card2: DrawnCard): boolean {
  // Simple heuristic: same orientation and similar themes
  if (card1.orientation !== card2.orientation) return false;

  // Check for similar suits or arcana
  if (card1.card.suit && card2.card.suit && card1.card.suit === card2.card.suit) return true;
  if (card1.card.arcana === card2.card.arcana) return true;

  return false;
}
