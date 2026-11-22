import { DrawnCard, Language, SpreadType } from "../../shared/types.js";
import { localizedCardName, pick } from "../../shared/i18n.js";
import { orientationLabel } from "../reading-formatter.js";
import { isValidSpreadType } from "../spreads.js";

/**
 * Spread-specific analyzers keyed by the stable spread type id (never the
 * display name, which is presentation and can collide with custom spread
 * names). Types without an entry fall back to the generic analysis.
 *
 * Every analyzer is bilingual: prose fragments go through pick() so the
 * control flow stays single-sourced and the en output stays byte-stable.
 */
const SPREAD_ANALYZERS: Partial<
  Record<SpreadType, (drawnCards: DrawnCard[], language: Language) => string>
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
  language: Language = "en",
): string {
  const analyzer = isValidSpreadType(spreadType)
    ? SPREAD_ANALYZERS[spreadType]
    : undefined;
  return analyzer ? analyzer(drawnCards, language) : "";
}

/**
 * Generate Celtic Cross specific analysis
 */
function generateCelticCrossAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 10) return "";

  let analysis = pick(
    language,
    "**Celtic Cross Analysis:**\n\n",
    "**凯尔特十字分析：**\n\n",
  );

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

  analysis += pick(
    language,
    `**Current Pattern:** ${withDefiniteArticle(present.card.name)} at the center is crossed by ${challenge.card.name}, showing the main tension in the situation. `,
    `**当前格局：**位于中心的${zhName(present)}被${zhName(challenge)}所横跨，呈现出局面中的主要张力。`,
  );
  if (present.orientation === challenge.orientation) {
    analysis += pick(
      language,
      "Because both cards share the same orientation, the challenge is visible and can be addressed directly. ",
      "两张牌方向一致，挑战清晰可见，可以直接着手应对。",
    );
  } else {
    analysis += pick(
      language,
      "The different orientations suggest a contrast between the obvious situation and the way the challenge is operating. ",
      "两张牌方向不同，暗示表面的局势与挑战实际运作的方式之间存在反差。",
    );
  }

  analysis += pick(
    language,
    `**Possible vs Final Outcome:** The possible outcome (${possibleOutcome.card.name}) `,
    `**可能结果与最终结果：**可能的结果（${zhName(possibleOutcome)}）`,
  );
  if (cardsHaveSimilarEnergy(possibleOutcome, finalOutcome)) {
    analysis += pick(
      language,
      `shares a suit or elemental thread with the final outcome (${finalOutcome.card.name}), keeping the same core arena in focus—compare both cards' specific meanings and orientations to judge whether that thread steadies or shifts. `,
      `与最终结果（${zhName(finalOutcome)}）共享同一花色或元素脉络，说明核心议题延续在同一领域——请结合两张牌各自的具体牌义与正逆位，判断这股脉络是趋于稳固还是发生转折。`,
    );
  } else {
    analysis += pick(
      language,
      `sits in a different elemental or arcana register from the final outcome (${finalOutcome.card.name}), highlighting how later influences and choices can redirect the trajectory. `,
      `与最终结果（${zhName(finalOutcome)}）分属不同的元素或牌组维度，说明后续的外在影响与个人选择会让局势走向发生变化。`,
    );
  }

  analysis += pick(
    language,
    `**Near Future Impact:** ${withDefiniteArticle(nearFuture.card.name)} in your near future `,
    `**近期未来的影响：**出现在近期未来的${zhName(nearFuture)}`,
  );
  if (nearFuture.orientation === "upright") {
    analysis += pick(
      language,
      "will express its theme directly in the upcoming phase—weigh its specific archetype against your desired outcome. ",
      "将在接下来以直接外显的方式展开其主题——请结合这张牌本身的原型，判断它对最终结果的推动或警示。",
    );
  } else {
    analysis += pick(
      language,
      "operates through inward friction, delay, or release—check what needs recalibrating before the next turn. ",
      "将以更偏内在、延宕或松动的方式运作——留意在下一个转折前需要先疏通或调整的环节。",
    );
  }

  analysis += pick(
    language,
    `**Past Movement:** ${distantPast.card.name} sets the deeper foundation, while ${recentPast.card.name} shows what is now passing out of the foreground. `,
    `**过去的走向：**${zhName(distantPast)}奠定了更深层的根基，而${zhName(recentPast)}显示出正从台前淡去的事物。`,
  );
  analysis += pick(
    language,
    `**Response Pattern:** Your approach (${approach.card.name}) meets external influences (${external.card.name}) and the hopes or fears carried by ${hopesFears.card.name}. `,
    `**回应模式：**你的态度（${zhName(approach)}）与外界影响（${zhName(external)}）相遇，并承载着${zhName(hopesFears)}所代表的希望与恐惧。`,
  );

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
    let analysis = "**牌阵脉络分析：**\n\n";
    analysis += `这个牌阵从「${first.position || "起始牌"}」（${zhName(first)}）延展到「${last.position || "收尾牌"}」（${zhName(last)}）。`;
    analysis += "此布局没有专属的牌阵模板，因此解读以每个牌位的含义、牌的正逆位、元素平衡与问题语境作为诠释框架。\n\n";
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
function generateThreeCardAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 3) return "";

  let analysis = pick(
    language,
    "**Three Card Flow Analysis:**\n\n",
    "**三牌流动分析：**\n\n",
  );

  const [past, present, future] = drawnCards;
  const reversedCount = drawnCards.filter(
    (c) => c.orientation === "reversed",
  ).length;

  analysis += pick(
    language,
    `**The Journey:** From ${past.card.name} (${past.orientation}) in the foundation, through ${present.card.name} (${present.orientation}) in the present, to ${future.card.name} (${future.orientation}) in the outcome, `,
    `**旅程：**从起点位的${zhName(past)}${orientationLabel(past.orientation, "zh")}，经过当下位的${zhName(present)}${orientationLabel(present.orientation, "zh")}，再到走向位的${zhName(future)}${orientationLabel(future.orientation, "zh")}，`,
  );

  if (reversedCount === 0) {
    analysis += pick(
      language,
      "all three cards express directly and outwardly—read the trajectory from how each card's own archetype evolves across the three positions rather than treating uprightness as guaranteed smoothness. ",
      "三张牌均以直接外显的方式呈现——请顺着三张牌各自原型在牌位间的演变来判断走势，而非把正位默认成一味顺遂。",
    );
  } else if (reversedCount === 3) {
    analysis += pick(
      language,
      "all three cards appear reversed, indicating that the real movement is happening beneath the surface through inward reassessment, friction, or release. ",
      "三张牌均为逆位，说明真正的变化主要发生在水面之下，体现在内在重估、阻力疏通或旧态松动之中。",
    );
  } else {
    analysis += pick(
      language,
      "the shift between upright and reversed cards marks where outward momentum meets an area needing pause, boundary work, or a different angle. ",
      "正逆位的切换标出了外显推进与需要暂停、设界或换个角度处理的节点所在。",
    );
  }

  if (cardsHaveSimilarEnergy(past, future)) {
    analysis += pick(
      language,
      `Shared elemental or suit resonance between ${past.card.name} and ${future.card.name} keeps the core thread continuous across the arc. `,
      `${zhName(past)}与${zhName(future)}共享同一花色或元素共鸣，说明贯穿首尾的核心脉络保持连贯。`,
    );
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Relationship spread specific analysis
 */
function generateRelationshipAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 7) return "";

  let analysis = pick(
    language,
    "**Relationship Dynamics Analysis:**\n\n",
    "**关系动态分析：**\n\n",
  );

  const you = drawnCards[0];
  const partner = drawnCards[1];
  const relationship = drawnCards[2];
  const unites = drawnCards[3];

  // Analyze compatibility
  analysis += pick(language, `**Compatibility Assessment:** `, `**契合度评估：**`);
  if (you.orientation === partner.orientation) {
    analysis += pick(
      language,
      "You and your partner are currently in similar emotional states, which can create harmony. ",
      "你与伴侣目前处于相似的情绪状态，这有助于营造和谐。",
    );
  } else {
    analysis += pick(
      language,
      "You and your partner are in different emotional phases, which requires understanding and patience. ",
      "你与伴侣正处于不同的情绪阶段，需要彼此理解与耐心。",
    );
  }

  // Analyze relationship dynamics factually without equating upright to harmony
  const uprightRelational = [you, partner, relationship, unites].filter(
    (c) => c.orientation === "upright",
  ).length;
  analysis += pick(
    language,
    `${uprightRelational} of the 4 core relational positions appear upright; weigh what unites you (${unites.card.name}) directly against what creates friction in the spread. `,
    `4 个核心关系牌位中有 ${uprightRelational} 张呈正位；请将「连结彼此之处」（${zhName(unites)}）与牌阵中的分歧位直接对照着看。`,
  );

  analysis += "\n";
  return analysis;
}

/**
 * Generate Career spread specific analysis
 */
function generateCareerAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 6) return "";

  let analysis = pick(
    language,
    "**Career Path Analysis:**\n\n",
    "**事业路径分析：**\n\n",
  );

  const skills = drawnCards[1];
  const challenges = drawnCards[2];
  const opportunities = drawnCards[3];

  // Analyze career readiness from position roles rather than orientation valence
  analysis += pick(language, `**Career Readiness:** `, `**职业准备度：**`);
  analysis += pick(
    language,
    `Pair your strengths (${skills.card.name}, ${skills.orientation}) with hidden openings (${opportunities.card.name}, ${opportunities.orientation}) to decide how to navigate the challenge posed by ${challenges.card.name} (${challenges.orientation}). `,
    `请将「自身才能」（${zhName(skills)}${orientationLabel(skills.orientation, "zh")}）与「潜藏机会」（${zhName(opportunities)}${orientationLabel(opportunities.orientation, "zh")}）结合起来，具体回应「职业挑战」（${zhName(challenges)}${orientationLabel(challenges.orientation, "zh")}）指出的卡点。`,
  );

  analysis += "\n";
  return analysis;
}

/**
 * Generate Spiritual Guidance spread analysis
 */
function generateSpiritualAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 6) return "";

  let analysis = pick(
    language,
    "**Spiritual Development Analysis:**\n\n",
    "**灵性发展分析：**\n\n",
  );

  const spiritualState = drawnCards[0];
  const blocks = drawnCards[2];

  // Analyze spiritual progress without equating orientation with good/bad
  analysis += pick(language, `**Spiritual Progress:** `, `**灵性进程：**`);
  analysis += pick(
    language,
    `Your present state (${spiritualState.card.name}, ${spiritualState.orientation}) meets the main block (${blocks.card.name}, ${blocks.orientation}); inspect how each archetype operates rather than treating orientation alone as progress or setback. `,
    `你当前的灵性状态（${zhName(spiritualState)}${orientationLabel(spiritualState.orientation, "zh")}）正面对主要阻滞（${zhName(blocks)}${orientationLabel(blocks.orientation, "zh")}）；请按牌面本义对照两者关系，而不单凭正逆位判定进退。`,
  );

  analysis += "\n";
  return analysis;
}

/**
 * Generate Chakra Alignment spread analysis
 */
function generateChakraAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 7) return "";

  let analysis = pick(
    language,
    "**Chakra Energy Analysis:**\n\n",
    "**脉轮能量分析：**\n\n",
  );

  const uprightChakras = drawnCards.filter(c => c.orientation === "upright").length;
  const balancePercentage = (uprightChakras / 7) * 100;

  analysis += pick(language, `**Overall Energy Balance:** `, `**整体能量平衡：**`);
  if (balancePercentage >= 70) {
    analysis += pick(
      language,
      "Your chakras are well-balanced with strong energy flow. ",
      "你的脉轮整体平衡良好，能量流动强劲顺畅。",
    );
  } else if (balancePercentage >= 50) {
    analysis += pick(
      language,
      "Your energy centers have moderate balance with some areas needing attention. ",
      "你的能量中心处于中等平衡，部分区域需要关注。",
    );
  } else {
    analysis += pick(
      language,
      "Several chakras need healing and rebalancing for optimal energy flow. ",
      "有多个脉轮需要疗愈与再平衡，能量才能顺畅流动。",
    );
  }

  // Identify energy patterns
  const lowerChakras = drawnCards.slice(0, 3).filter(c => c.orientation === "upright").length;
  const upperChakras = drawnCards.slice(4, 7).filter(c => c.orientation === "upright").length;

  if (lowerChakras > upperChakras) {
    analysis += pick(
      language,
      "Your grounding and physical energy centers are stronger than your spiritual centers. ",
      "你的扎根与身体层面的能量中心比灵性中心更为强健。",
    );
  } else if (upperChakras > lowerChakras) {
    analysis += pick(
      language,
      "Your spiritual and intuitive centers are more active than your grounding centers. ",
      "你的灵性与直觉中心比扎根的能量中心更为活跃。",
    );
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Year Ahead spread analysis
 */
function generateYearAheadAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 13) return "";

  let analysis = pick(
    language,
    "**Year Ahead Overview:**\n\n",
    "**年度前瞻总览：**\n\n",
  );

  const overallTheme = drawnCards[0];
  const monthlyCards = drawnCards.slice(1);

  // Analyze overall year theme factually
  analysis += pick(
    language,
    `**Year Theme:** ${withDefiniteArticle(overallTheme.card.name)} (${overallTheme.orientation}) anchors the year's central motif; read the four quarters by how their card archetypes and elements shift across the seasons. `,
    `**年度主题：**${zhName(overallTheme)}${orientationLabel(overallTheme.orientation, "zh")}定下全年的核心母题；四个季度请结合各月单牌原型与元素流转来解读。`,
  );

  // Analyze seasonal patterns factually
  const quarters = [
    monthlyCards.slice(0, 3), // Q1: Jan-Mar
    monthlyCards.slice(3, 6), // Q2: Apr-Jun
    monthlyCards.slice(6, 9), // Q3: Jul-Sep
    monthlyCards.slice(9, 12), // Q4: Oct-Dec
  ];

  quarters.forEach((quarter, index) => {
    const uprightCount = quarter.filter((c) => c.orientation === "upright").length;
    const reversedCount = quarter.length - uprightCount;
    const quarterNames = ["First Quarter", "Second Quarter", "Third Quarter", "Fourth Quarter"];
    const quarterNamesZh = ["第一季度", "第二季度", "第三季度", "第四季度"];

    analysis += pick(
      language,
      `**${quarterNames[index]}:** ${uprightCount} upright, ${reversedCount} reversed (${quarter.map((c) => c.card.name).join(", ")}). `,
      `**${quarterNamesZh[index]}：**${uprightCount} 正 ${reversedCount} 逆（${quarter.map((c) => zhName(c)).join("、")}）。`,
    );
  });

  analysis += "\n";
  return analysis;
}

/**
 * Generate Venus Love spread analysis
 */
function generateVenusLoveAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 7) return "";

  let analysis = pick(
    language,
    "**Venus Love Energy Analysis:**\n\n",
    "**金星之爱能量分析：**\n\n",
  );

  const [currentEnergy, selfLove, attraction, blocks, , , future] = drawnCards;

  // Analyze love energy flow without assuming upright=positive
  analysis += pick(
    language,
    `**Love Energy Flow:** Your current relationship state (${currentEnergy.card.name}, ${currentEnergy.orientation}) meets your self-love foundation (${selfLove.card.name}, ${selfLove.orientation}). `,
    `**爱的能量流动：**你当前的感情状态（${zhName(currentEnergy)}${orientationLabel(currentEnergy.orientation, "zh")}）与自我价值根基（${zhName(selfLove)}${orientationLabel(selfLove.orientation, "zh")}）相互映照。`,
  );

  // Attraction and blocks
  analysis += pick(
    language,
    `Compare what draws connection (${attraction.card.name}) directly with what creates friction (${blocks.card.name}), and read the future card (${future.card.name}, ${future.orientation}) as a trajectory you actively shape. `,
    `请把「吸引爱的特质」（${zhName(attraction)}）与「主要阻碍」（${zhName(blocks)}）对照来看，并将未来潜能位（${zhName(future)}${orientationLabel(future.orientation, "zh")}）视作可经由当下选择重塑的走向。`,
  );

  analysis += "\n";
  return analysis;
}

/**
 * Generate Tree of Life spread analysis
 */
function generateTreeOfLifeAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 10) return "";

  let analysis = pick(
    language,
    "**Tree of Life Spiritual Analysis:**\n\n",
    "**生命之树灵性分析：**\n\n",
  );

  const [kether, chokmah, binah, chesed, geburah, , netzach, hod, , malkuth] = drawnCards;

  // Analyze the three pillars
  const leftPillar = [binah, geburah, hod]; // Severity
  const rightPillar = [chokmah, chesed, netzach]; // Mercy

  // Pillar analysis
  const leftUprightCount = leftPillar.filter(c => c.orientation === "upright").length;
  const rightUprightCount = rightPillar.filter(c => c.orientation === "upright").length;

  analysis += pick(language, `**Pillar Balance:** `, `**支柱平衡：**`);
  if (rightUprightCount > leftUprightCount) {
    analysis += pick(
      language,
      "The Pillar of Mercy carries more upright cards, accentuating outward expansion and expression. ",
      "慈悲之柱出现更多正位牌，突出了向外扩展与表达的倾向。",
    );
  } else if (leftUprightCount > rightUprightCount) {
    analysis += pick(
      language,
      "The Pillar of Severity is prominent, suggesting discipline, boundaries, and necessary restrictions. ",
      "严厉之柱较为突出，提示纪律、界限与必要的约束。",
    );
  } else {
    analysis += pick(
      language,
      "The pillars are balanced, showing harmony between expansion and contraction. ",
      "两柱势均力敌，显示扩张与收敛之间的和谐。",
    );
  }

  // Crown to Kingdom flow
  analysis += pick(
    language,
    `**Divine Flow:** From Kether (${kether.card.name}) to Malkuth (${malkuth.card.name}), `,
    `**神圣之流：**从王冠（Kether）的${zhName(kether)}到王国（Malkuth）的${zhName(malkuth)},`,
  );
  if (kether.orientation === malkuth.orientation) {
    analysis += pick(
      language,
      "there's alignment between your highest purpose and material manifestation. ",
      "你的至高目标与物质层面的显化彼此对齐。",
    );
  } else {
    analysis += pick(
      language,
      "there's a need to bridge the gap between spiritual ideals and earthly reality. ",
      "需要在灵性理想与尘世现实之间架起桥梁。",
    );
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Astrological Houses spread analysis
 */
function generateAstrologicalAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 12) return "";

  let analysis = pick(
    language,
    "**Astrological Houses Analysis:**\n\n",
    "**占星宫位分析：**\n\n",
  );

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

  analysis += pick(language, `**Elemental Balance:** `, `**元素平衡：**`);
  const elements = [
    { en: "Fire (Identity/Creativity/Philosophy)", zh: "火元素（自我/创造/哲思）", count: fireUpright },
    { en: "Earth (Resources/Work/Career)", zh: "土元素（资源/工作/事业）", count: earthUpright },
    { en: "Air (Communication/Partnerships/Community)", zh: "风元素（沟通/伙伴/社群）", count: airUpright },
    { en: "Water (Home/Transformation/Spirituality)", zh: "水元素（家庭/转化/灵性）", count: waterUpright }
  ];

  const strongestElement = elements.reduce((max, current) =>
    current.count > max.count ? current : max
  );

  analysis += pick(
    language,
    `${strongestElement.en} energy is strongest in your chart, indicating focus in these life areas. `,
    `${strongestElement.zh}的能量在你的星盘中最为强盛，预示这些生活领域将成为你的焦点。`,
  );

  // Angular houses analysis (1st, 4th, 7th, 10th)
  const angularHouses = [drawnCards[0], drawnCards[3], drawnCards[6], drawnCards[9]];
  const angularUpright = angularHouses.filter(c => c.orientation === "upright").length;

  analysis += pick(
    language,
    `**Life Direction:** With ${angularUpright} out of 4 angular houses upright, `,
    `**人生方向：**四个角宫中有${angularUpright}个正位，`,
  );
  if (angularUpright >= 3) {
    analysis += pick(
      language,
      "you have strong momentum and clear direction in major life areas. ",
      "你在人生的主要领域拥有强劲的动能与清晰的方向。",
    );
  } else if (angularUpright >= 2) {
    analysis += pick(
      language,
      "you have moderate stability with some areas needing attention. ",
      "你保持着中等程度的稳定，部分领域需要关注。",
    );
  } else {
    analysis += pick(
      language,
      "focus on building stronger foundations in key life areas. ",
      "需要着力在关键的生活领域筑牢根基。",
    );
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Mandala spread analysis
 */
function generateMandalaAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 9) return "";

  let analysis = pick(
    language,
    "**Mandala Wholeness Analysis:**\n\n",
    "**曼陀罗圆满分析：**\n\n",
  );

  const [center, north, northeast, east, southeast, south, southwest, west, northwest] = drawnCards;

  // Analyze center in relation to outer cards
  analysis += pick(
    language,
    `**Core Integration:** Your center (${center.card.name}) `,
    `**核心整合：**你的中心（${zhName(center)}）`,
  );
  if (center.orientation === "upright") {
    analysis += pick(
      language,
      "shows a strong, balanced core that can integrate the surrounding energies. ",
      "显示出强健而平衡的内核，足以整合四周的能量。",
    );
  } else {
    analysis += pick(
      language,
      "suggests the need for inner healing before achieving wholeness. ",
      "提示在抵达圆满之前，需要先进行内在疗愈。",
    );
  }

  // Analyze directional balance
  const directions = [north, northeast, east, southeast, south, southwest, west, northwest];
  const uprightDirections = directions.filter(c => c.orientation === "upright").length;

  analysis += pick(
    language,
    `**Directional Balance:** With ${uprightDirections} out of 8 directions upright, `,
    `**方位平衡：**八个方位中有${uprightDirections}个正位，`,
  );
  if (uprightDirections >= 6) {
    analysis += pick(
      language,
      "your life energies are well-balanced and flowing harmoniously. ",
      "你的生命能量整体均衡，流动和谐。",
    );
  } else if (uprightDirections >= 4) {
    analysis += pick(
      language,
      "you have good balance with some areas needing attention. ",
      "你保持着不错的平衡，个别领域需要关注。",
    );
  } else {
    analysis += pick(
      language,
      "focus on healing and balancing multiple life areas. ",
      "需要着力疗愈并平衡多个生活领域。",
    );
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

  analysis += pick(
    language,
    `**Polarity Integration:** ${balancedPairs} out of 4 opposite pairs are balanced, `,
    `**两极整合：**四组对位中有${balancedPairs}组彼此平衡，`,
  );
  if (balancedPairs >= 3) {
    analysis += pick(
      language,
      "showing excellent integration of opposing forces. ",
      "显示对立的力量得到了出色的整合。",
    );
  } else {
    analysis += pick(
      language,
      "indicating opportunities to harmonize conflicting energies. ",
      "提示仍有机会去调和相互冲突的能量。",
    );
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Pentagram spread analysis
 */
function generatePentagramAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 5) return "";

  let analysis = pick(
    language,
    "**Pentagram Elemental Analysis:**\n\n",
    "**五芒星元素分析：**\n\n",
  );

  const [spirit, air, fire, earth, water] = drawnCards;

  // Analyze elemental balance
  const elements = [air, fire, earth, water];
  const uprightElements = elements.filter(c => c.orientation === "upright").length;

  analysis += pick(
    language,
    `**Elemental Harmony:** With ${uprightElements} out of 4 elements upright, `,
    `**元素和谐：**四大元素中有${uprightElements}个正位，`,
  );
  if (uprightElements === 4) {
    analysis += pick(
      language,
      "all elements are in perfect harmony, creating powerful manifestation energy. ",
      "所有元素处于完美和谐，汇聚成强大的显化能量。",
    );
  } else if (uprightElements >= 3) {
    analysis += pick(
      language,
      "strong elemental balance with minor adjustments needed. ",
      "元素平衡良好，只需细微的调整。",
    );
  } else if (uprightElements >= 2) {
    analysis += pick(
      language,
      "moderate balance requiring attention to weaker elements. ",
      "平衡程度中等，需要关注较弱的元素。",
    );
  } else {
    analysis += pick(
      language,
      "significant elemental imbalance requiring healing and rebalancing. ",
      "元素明显失衡，需要疗愈与再平衡。",
    );
  }

  // Spirit connection analysis
  analysis += pick(
    language,
    `**Divine Connection:** Spirit (${spirit.card.name}) `,
    `**神圣连结：**灵性之位（${zhName(spirit)}）`,
  );
  if (spirit.orientation === "upright") {
    analysis += pick(
      language,
      "shows strong divine connection guiding your elemental balance. ",
      "显示强大的神圣连结正在引导你的元素平衡。",
    );
  } else {
    analysis += pick(
      language,
      "suggests the need to strengthen your spiritual foundation. ",
      "提示需要巩固你的灵性根基。",
    );
  }

  // Element-specific insights
  analysis += pick(language, `**Elemental Flow:** `, `**元素之流：**`);
  if (air.orientation === "upright") {
    analysis += pick(
      language,
      "Clear thinking and communication support your goals. ",
      "清晰的思维与顺畅的沟通支持着你的目标。",
    );
  }
  if (fire.orientation === "upright") {
    analysis += pick(
      language,
      "Passionate energy drives your actions. ",
      "炽热的能量推动着你的行动。",
    );
  }
  if (earth.orientation === "upright") {
    analysis += pick(
      language,
      "Practical foundations support manifestation. ",
      "务实的根基支撑着显化。",
    );
  }
  if (water.orientation === "upright") {
    analysis += pick(
      language,
      "Emotional wisdom guides your intuition. ",
      "情感的智慧引导着你的直觉。",
    );
  }

  analysis += "\n";
  return analysis;
}

/**
 * Generate Mirror of Truth spread analysis
 */
function generateMirrorOfTruthAnalysis(
  drawnCards: DrawnCard[],
  language: Language,
): string {
  if (drawnCards.length !== 4) return "";

  let analysis = pick(
    language,
    "**Mirror of Truth - Four Beams of Light Analysis:**\n\n",
    "**真相之镜——四束光明分析：**\n\n",
  );
  const [yourPerspective, theirIntention, objectiveTruth, futureGuidance] = drawnCards;

  // First Light Analysis - Your Perspective
  analysis += pick(
    language,
    `**First Light - Illuminate Yourself:** ${yourPerspective.card.name} (${yourPerspective.orientation})\n`,
    `**第一束光——照见自己：**${zhName(yourPerspective)}${orientationLabel(yourPerspective.orientation, "zh")}\n`,
  );
  analysis += pick(
    language,
    `Your current emotional state and inner filters show: `,
    `你当前的情绪状态与内在滤镜显示：`,
  );
  if (yourPerspective.orientation === "upright") {
    analysis += pick(
      language,
      "Your perception of the situation is relatively clear, your emotional state is stable, and you can view the problem objectively.",
      "你对局面的感知相对清晰，情绪平稳，能够客观地看待问题。",
    );
  }
  else {
    analysis += pick(
      language,
      "Your perspective may be influenced by strong emotions, anxiety, or expectations, requiring inner calm to see the truth clearly.",
      "你的视角可能受到强烈情绪、焦虑或期待的影响，需要让内心平静下来才能看清真相。",
    );
  }
  analysis += "\n\n";

  // Second Light Analysis - Their Intention
  analysis += pick(
    language,
    `**Second Light - Explore Their Heart:** ${theirIntention.card.name} (${theirIntention.orientation})\n`,
    `**第二束光——探问对方之心：**${zhName(theirIntention)}${orientationLabel(theirIntention.orientation, "zh")}\n`,
  );
  analysis += pick(
    language,
    `Read this card as a reflection of the dynamic you are encountering rather than mind-reading someone's private motives; ${theirIntention.orientation === "upright" ? "the pattern shows openly in behavior." : "mixed signals or unspoken hesitation may be active beneath the surface."}`,
    `将这张牌视为你所面对互动模式的映照，而非替对方下定论；${theirIntention.orientation === "upright" ? "相关态度较直接地体现在外在言行里。" : "表面言行之下可能存在纠结、犹豫或尚未摊开的信号。"}`,
  );
  analysis += "\n\n";

  // Third Light Analysis - Objective Truth
  analysis += pick(
    language,
    `**Third Light - Restore Original Truth:** ${objectiveTruth.card.name} (${objectiveTruth.orientation})\n`,
    `**第三束光——还原本来面目：**${zhName(objectiveTruth)}${orientationLabel(objectiveTruth.orientation, "zh")}\n`,
  );
  analysis += pick(
    language,
    `Stripping away all subjective emotions, the truth is: `,
    `剥离所有主观情绪之后，真相是：`,
  );
  if (objectiveTruth.orientation === "upright") {
    analysis += pick(
      language,
      "The situation itself is relatively simple and clear, you and the other person may have over-interpreted it. The facts are more direct than imagined.",
      "事情本身相对简单明了，你和对方或许都过度解读了，事实比想象中更直接。",
    );
  }
  else {
    analysis += pick(
      language,
      "The situation does have complexity and hidden layers, requiring more time and information to fully understand.",
      "局面确实存在复杂性与隐藏的层面，需要更多时间与信息才能完全理解。",
    );
  }
  analysis += "\n\n";

  // Fourth Light Analysis - Future Guidance
  analysis += pick(
    language,
    `**Fourth Light - Guide Future Direction:** ${futureGuidance.card.name} (${futureGuidance.orientation})\n`,
    `**第四束光——指引未来方向：**${zhName(futureGuidance)}${orientationLabel(futureGuidance.orientation, "zh")}\n`,
  );
  analysis += pick(
    language,
    `Based on understanding the truth, you should: `,
    `在理解真相的基础上，你应当：`,
  );
  if (futureGuidance.orientation === "upright") {
    analysis += pick(
      language,
      "Take positive and proactive action, now is a good time to clarify misunderstandings, improve relationships, or make decisions.",
      "采取积极主动的行动，现在正是澄清误会、改善关系或做出决定的好时机。",
    );
  }
  else {
    analysis += pick(
      language,
      "Maintain patience and observation, don't rush into action, let time and more information reveal the best path forward.",
      "保持耐心与观察，不要贸然行动，让时间与更多信息揭示最佳的前行之路。",
    );
  }
  analysis += "\n\n";

  // Comprehensive Analysis of Four Lights
  analysis += pick(
    language,
    `**Comprehensive Insights from Four Lights:**\n`,
    `**四束光明的综合洞见：**\n`,
  );
  const uprightCount = drawnCards.filter(c => c.orientation === "upright").length;

  // Analyze relationship between your perspective and their intention
  if (yourPerspective.orientation === theirIntention.orientation) {
    analysis += pick(
      language,
      `Your perception and their intention are in similar energy states, indicating some synchronicity between you. `,
      `你的感知与对方的意图处于相近的能量状态，说明你们之间存在某种同频。`,
    );
  }
  else {
    analysis += pick(
      language,
      `Your perception and their intention have energy differences, which may be the source of misunderstanding. `,
      `你的感知与对方的意图之间存在能量落差，这可能正是误解的来源。`,
    );
  }

  // Analyze relationship between objective truth and guidance
  if (objectiveTruth.orientation === futureGuidance.orientation) {
    analysis += pick(
      language,
      `The nature of the facts aligns with future guidance, indicating you can trust this direction. `,
      `事实的本质与未来的指引方向一致，说明你可以信任这个方向。`,
    );
  }
  else {
    analysis += pick(
      language,
      `The complexity of the facts requires flexibility and openness in your actions. `,
      `事实的复杂性要求你在行动中保持灵活与开放。`,
    );
  }

  // Overall clarity assessment
  analysis += pick(
    language,
    `\n\n**Clarity of Truth:** ${uprightCount} out of 4 lights shine clearly, `,
    `\n\n**真相的清晰度：**四束光之中有${uprightCount}束清澈明亮，`,
  );
  if (uprightCount === 4) {
    analysis += pick(
      language,
      "all dimensions are clear, this is a moment of complete truth where decisive action can be taken.",
      "所有维度都清晰可见，这是真相大白的时刻，可以果断采取行动。",
    );
  }
  else if (uprightCount === 3) {
    analysis += pick(
      language,
      "most of the truth has been revealed, requiring only patience and understanding in one dimension.",
      "大部分真相已经显现，只需在其中一个维度上保持耐心与理解。",
    );
  }
  else if (uprightCount === 2) {
    analysis += pick(
      language,
      "truth is gradually emerging, requiring balance of information from different dimensions to make judgments.",
      "真相正在逐渐浮现，需要综合不同维度的信息来做出判断。",
    );
  }
  else if (uprightCount === 1) {
    analysis += pick(
      language,
      "currently only one dimension is relatively clear, more time is needed for other truths to surface.",
      "目前只有一个维度相对清晰，其余的真相还需要更多时间浮出水面。",
    );
  }
  else {
    analysis += pick(
      language,
      "all dimensions are still in fog, this is a period requiring great patience and inner calm.",
      "所有维度仍笼罩在迷雾之中，这是需要极大耐心与内心平静的时期。",
    );
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

/** Card name rendered for zh prose fragments, e.g. "愚者（The Fool）". */
function zhName(drawn: DrawnCard): string {
  return localizedCardName(drawn.card, "zh");
}

/**
 * Check if two cards share genuine elemental or suit resonance.
 * Unlike the earlier heuristic, two unrelated Minor Arcana cards of different
 * suits no longer falsely count as having "similar energy".
 */
function cardsHaveSimilarEnergy(card1: DrawnCard, card2: DrawnCard): boolean {
  if (card1.card.suit && card2.card.suit && card1.card.suit === card2.card.suit) {
    return true;
  }
  if (
    card1.card.element &&
    card2.card.element &&
    card1.card.element === card2.card.element
  ) {
    return true;
  }
  return false;
}
