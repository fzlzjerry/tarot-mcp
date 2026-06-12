import { TarotCardManager } from "../cards/card-manager.js";
import { TarotSessionManager } from "./session-manager.js";
import { TarotReading, DrawnCard, CardOrientation, TarotCard } from "../shared/types.js";
import { getAllSpreads, getSpread, isValidSpreadType } from "./spreads.js";
import { getSecureRandomInt } from "../shared/utils.js";
import { sanitizeString } from "../shared/validation.js";

export interface TarotReadingRandomSource {
  drawCards?: (count: number) => TarotCard[];
  drawOrientation?: () => CardOrientation;
}

/**
 * Manages tarot readings and interpretations
 */
export class TarotReadingManager {
  private cardManager: TarotCardManager;
  private sessionManager: TarotSessionManager;
  private randomSource: TarotReadingRandomSource;

  constructor(
    cardManager: TarotCardManager,
    sessionManager: TarotSessionManager,
    randomSource: TarotReadingRandomSource = {}
  ) {
    this.cardManager = cardManager;
    this.sessionManager = sessionManager;
    this.randomSource = randomSource;
  }

  /**
   * Perform a tarot reading
   */
  public performReading(
    spreadType: string,
    question: string,
    sessionId?: string | null,
    options: { trackSession?: boolean } = {},
  ): string {
    if (!isValidSpreadType(spreadType)) {
      return `Error: Invalid spread type: ${spreadType}. Use list_available_spreads to see valid options.`;
    }

    const session = this.resolveSession(sessionId, options.trackSession ?? true);
    if (typeof session === "string") {
      return session;
    }

    const spread = getSpread(spreadType)!;

    // Use cryptographically secure random card drawing
    const cards = this.drawCards(spread.cardCount);

    // Generate random orientations for each card using secure randomness
    const drawnCards: DrawnCard[] = cards.map((card: any, index: number) => ({
      card,
      orientation: this.drawOrientation(),
      position: spread.positions[index].name,
      positionMeaning: spread.positions[index].meaning
    }));

    // Create the reading
    const reading: TarotReading = {
      id: this.generateReadingId(),
      spreadType,
      question,
      cards: drawnCards,
      interpretation: this.generateInterpretation(drawnCards, question, spread.name),
      timestamp: new Date(),
      sessionId: session?.id
    };

    if (session) {
      this.sessionManager.addReadingToSession(session.id, reading);
    }

    return this.formatReading(reading, spread.name, spread.description);
  }

  /**
   * Resolve an existing session or start a new one. Returns an error string
   * (suitable for direct return to the client) when an unknown session ID is
   * supplied, so stale IDs fail loudly instead of being silently dropped.
   * Returns undefined when session tracking is disabled (one-shot tools such
   * as the daily card, which cannot continue a session anyway).
   */
  private resolveSession(sessionId: string | null | undefined, trackSession: boolean) {
    if (sessionId == null) {
      return trackSession ? this.sessionManager.createSession() : undefined;
    }

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      // Echo at most a short, sanitized form of the client-supplied ID.
      const safeId = sanitizeString(sessionId).slice(0, 64);
      return `Error: Session "${safeId}" not found. Sessions expire 24 hours after their last activity. Omit sessionId to start a new session.`;
    }
    return session;
  }

  /**
   * List all available spreads
   */
  public listAvailableSpreads(): string {
    const spreads = getAllSpreads();
    
    let result = "# Available Tarot Spreads\n\n";
    
    spreads.forEach(spread => {
      result += `## ${spread.name} (${spread.cardCount} cards)\n\n`;
      result += `${spread.description}\n\n`;
      
      result += "**Positions:**\n";
      spread.positions.forEach((position, index) => {
        result += `${index + 1}. **${position.name}**: ${position.meaning}\n`;
      });
      result += "\n";
    });

    result += "Use the `perform_reading` tool with one of these spread types to get a reading.";

    return result;
  }

  /**
   * Perform a custom tarot reading with user-defined spread
   */
  public performCustomReading(
    spreadName: string,
    description: string,
    positions: { name: string; meaning: string }[],
    question: string,
    sessionId?: string | null
  ): string {
    const session = this.resolveSession(sessionId, true);
    if (typeof session === "string") {
      return session;
    }

    // Create a custom spread object
    const customSpread = {
      name: spreadName,
      description: description,
      positions: positions,
      cardCount: positions.length
    };

    // Use cryptographically secure random card drawing
    const cards = this.drawCards(customSpread.cardCount);

    // Generate random orientations for each card using secure randomness
    const drawnCards: DrawnCard[] = cards.map((card: any, index: number) => ({
      card,
      orientation: this.drawOrientation(),
      position: customSpread.positions[index].name,
      positionMeaning: customSpread.positions[index].meaning
    }));

    // Create the reading
    const reading: TarotReading = {
      id: this.generateReadingId(),
      spreadType: `custom_${spreadName.toLowerCase().replace(/\s+/g, '_')}`,
      question,
      cards: drawnCards,
      interpretation: this.generateInterpretation(drawnCards, question, customSpread.name),
      timestamp: new Date(),
      sessionId: session!.id
    };

    this.sessionManager.addReadingToSession(session!.id, reading);

    return this.formatReading(reading, customSpread.name, customSpread.description);
  }

  /**
   * Generate interpretation for a reading
   */
  private generateInterpretation(drawnCards: DrawnCard[], question: string, spreadName: string): string {
    let interpretation = `This ${spreadName} reading addresses your question: "${question}"\n\n`;

    // Individual card interpretations with context
    drawnCards.forEach((drawnCard) => {
      const meanings = drawnCard.orientation === "upright"
        ? drawnCard.card.meanings.upright
        : drawnCard.card.meanings.reversed;

      interpretation += `**${drawnCard.position}**: ${drawnCard.card.name} (${drawnCard.orientation})\n`;

      // Choose the most relevant meaning based on position
      const relevantMeaning = this.selectRelevantMeaning(
        meanings,
        drawnCard.position || "General",
        question,
        drawnCard.positionMeaning
      );
      interpretation += `${relevantMeaning}\n\n`;
    });

    // Add spread-specific analysis
    let usedSpreadSpecificAnalysis = true;
    if (spreadName.toLowerCase().includes("celtic cross")) {
      interpretation += this.generateCelticCrossAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("three card")) {
      interpretation += this.generateThreeCardAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("relationship")) {
      interpretation += this.generateRelationshipAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("career")) {
      interpretation += this.generateCareerAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("spiritual")) {
      interpretation += this.generateSpiritualAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("chakra")) {
      interpretation += this.generateChakraAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("year ahead")) {
      interpretation += this.generateYearAheadAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("venus") || spreadName.toLowerCase().includes("love")) {
      interpretation += this.generateVenusLoveAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("tree of life")) {
      interpretation += this.generateTreeOfLifeAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("astrological")) {
      interpretation += this.generateAstrologicalAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("mandala")) {
      interpretation += this.generateMandalaAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("pentagram")) {
      interpretation += this.generatePentagramAnalysis(drawnCards);
    } else if (spreadName.toLowerCase().includes("mirror of truth")) {
      interpretation += this.generateMirrorOfTruthAnalysis(drawnCards);
    } else {
      usedSpreadSpecificAnalysis = false;
    }

    if (!usedSpreadSpecificAnalysis && drawnCards.length > 1) {
      interpretation += this.generateGenericSpreadAnalysis(drawnCards);
    }

    // Overall interpretation
    interpretation += this.generateOverallInterpretation(drawnCards);

    return interpretation;
  }

  /**
   * Select the most relevant meaning based on position and question
   */
  private selectRelevantMeaning(
    meanings: any,
    position: string,
    question: string,
    positionMeaning: string = ""
  ): string {
    const contextLower = `${question} ${position} ${positionMeaning}`.toLowerCase();

    // Determine the most relevant aspect based on question content
    if (this.matchesContext(contextLower, [
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
    } else if (this.matchesContext(contextLower, [
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
    } else if (this.matchesContext(contextLower, [
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
    } else if (this.matchesContext(contextLower, [
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

  private matchesContext(context: string, terms: string[]): boolean {
    return terms.some((term) => context.includes(term));
  }

  /**
   * Generate Celtic Cross specific analysis
   */
  private generateCelticCrossAnalysis(drawnCards: DrawnCard[]): string {
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

    analysis += `**Current Pattern:** ${this.withDefiniteArticle(present.card.name)} at the center is crossed by ${challenge.card.name}, showing the main tension in the situation. `;
    if (present.orientation === challenge.orientation) {
      analysis += "Because both cards share the same orientation, the challenge is visible and can be addressed directly. ";
    } else {
      analysis += "The different orientations suggest a contrast between the obvious situation and the way the challenge is operating. ";
    }

    analysis += `**Possible vs Final Outcome:** The possible outcome (${possibleOutcome.card.name}) `;
    if (this.cardsHaveSimilarEnergy(possibleOutcome, finalOutcome)) {
      analysis += "aligns with the final outcome, suggesting the current path can mature without a drastic change. ";
    } else {
      analysis += "differs from the final outcome, so the reading points to a course correction before the pattern settles. ";
    }

    analysis += `**Near Future Impact:** ${this.withDefiniteArticle(nearFuture.card.name)} in your near future will `;
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

  private generateGenericSpreadAnalysis(drawnCards: DrawnCard[]): string {
    const first = drawnCards[0];
    const last = drawnCards[drawnCards.length - 1];

    let analysis = "**Contextual Spread Analysis:**\n\n";
    analysis += `This spread moves from ${first.position || "the opening card"} (${first.card.name}) to ${last.position || "the closing card"} (${last.card.name}). `;
    analysis += "No dedicated spread template is registered for this layout, so the reading uses each position meaning, card orientation, elemental balance, and the question context as its interpretive frame.\n\n";
    return analysis;
  }

  /**
   * Generate Three Card specific analysis
   */
  private generateThreeCardAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateRelationshipAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateCareerAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateSpiritualAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateChakraAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateYearAheadAnalysis(drawnCards: DrawnCard[]): string {
    if (drawnCards.length !== 13) return "";

    let analysis = "**Year Ahead Overview:**\n\n";

    const overallTheme = drawnCards[0];
    const monthlyCards = drawnCards.slice(1);

    // Analyze overall year energy
    analysis += `**Year Theme:** ${this.withDefiniteArticle(overallTheme.card.name)} sets the tone for your year, `;
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
  private generateVenusLoveAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateTreeOfLifeAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateAstrologicalAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateMandalaAnalysis(drawnCards: DrawnCard[]): string {
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
  private generatePentagramAnalysis(drawnCards: DrawnCard[]): string {
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
  private generateMirrorOfTruthAnalysis(drawnCards: DrawnCard[]): string {
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
  private withDefiniteArticle(cardName: string): string {
    return cardName.startsWith("The ") ? cardName : `The ${cardName}`;
  }

  /**
   * Check if two cards have similar energy
   */
  private cardsHaveSimilarEnergy(card1: DrawnCard, card2: DrawnCard): boolean {
    // Simple heuristic: same orientation and similar themes
    if (card1.orientation !== card2.orientation) return false;

    // Check for similar suits or arcana
    if (card1.card.suit && card2.card.suit && card1.card.suit === card2.card.suit) return true;
    if (card1.card.arcana === card2.card.arcana) return true;

    return false;
  }

  /**
   * Generate overall interpretation considering card interactions
   */
  private generateOverallInterpretation(drawnCards: DrawnCard[]): string {
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
    overall += this.generateAdvancedCombinationInterpretation(drawnCards);

    return overall;
  }

  /**
   * Generate advanced interpretation for card combinations
   */
  private generateAdvancedCombinationInterpretation(drawnCards: DrawnCard[]): string {
    let interpretation = "";

    // Elemental analysis
    const elementCounts = this.analyzeElements(drawnCards);
    interpretation += this.interpretElementalBalance(elementCounts);

    // Suit analysis for Minor Arcana
    const suitAnalysis = this.analyzeSuits(drawnCards);
    interpretation += suitAnalysis;

    // Numerical patterns
    const numericalAnalysis = this.analyzeNumericalPatterns(drawnCards);
    interpretation += numericalAnalysis;

    // Court card analysis
    const courtCardAnalysis = this.analyzeCourtCards(drawnCards);
    interpretation += courtCardAnalysis;

    // Archetypal patterns in Major Arcana
    const archetypeAnalysis = this.analyzeMajorArcanaPatterns(drawnCards);
    interpretation += archetypeAnalysis;

    interpretation += "\n\nTrust your intuition as you reflect on these insights and how they apply to your specific situation.";

    return interpretation;
  }

  /**
   * Analyze elemental balance in the reading
   */
  private analyzeElements(drawnCards: DrawnCard[]): Record<string, number> {
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
  private interpretElementalBalance(elementCounts: Record<string, number>): string {
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
  private analyzeSuits(drawnCards: DrawnCard[]): string {
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
  private analyzeNumericalPatterns(drawnCards: DrawnCard[]): string {
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

    if (repeatedNumbers.length > 0) {
      interpretation += `The repetition of ${repeatedNumbers.join(" and ")} emphasizes the themes of `;
      repeatedNumbers.forEach(num => {
        switch (num) {
          case 1: interpretation += "new beginnings and potential, "; break;
          case 2: interpretation += "balance and partnerships, "; break;
          case 3: interpretation += "creativity and growth, "; break;
          case 4: interpretation += "stability and foundation, "; break;
          case 5: interpretation += "change and challenge, "; break;
          case 6: interpretation += "harmony and responsibility, "; break;
          case 7: interpretation += "spiritual development and introspection, "; break;
          case 8: interpretation += "material mastery and achievement, "; break;
          case 9: interpretation += "completion and wisdom, "; break;
          case 10: interpretation += "fulfillment and new cycles, "; break;
        }
      });
      interpretation = interpretation.slice(0, -2) + ". ";
    }

    return interpretation;
  }

  /**
   * Analyze court cards in the reading
   */
  private analyzeCourtCards(drawnCards: DrawnCard[]): string {
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
  private analyzeMajorArcanaPatterns(drawnCards: DrawnCard[]): string {
    const majorCards = drawnCards.filter(c => c.card.arcana === "major");
    if (majorCards.length === 0) return "";

    let interpretation = "";

    // Analyze the Fool's Journey progression
    const majorNumbers = majorCards
      .map(c => c.card.number!)
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

  /**
   * Format a reading for display
   */
  private formatReading(reading: TarotReading, spreadName: string, spreadDescription: string): string {
    let result = `# ${spreadName} Reading\n\n`;
    result += `**Question:** ${reading.question}\n`;
    result += `**Date:** ${reading.timestamp.toLocaleString()}\n`;
    result += `**Reading ID:** ${reading.id}\n`;
    if (reading.sessionId) {
      const readingNumber = this.sessionManager.getSessionReadings(reading.sessionId).length;
      result += `**Session ID:** ${reading.sessionId}`;
      result += readingNumber > 1 ? ` (reading #${readingNumber} in this session)` : "";
      result += `\n*Pass this sessionId to future readings to continue the session.*\n`;
    }
    result += `\n`;
    
    result += `*${spreadDescription}*\n\n`;
    
    result += `## Your Cards\n\n`;
    reading.cards.forEach((drawnCard, index) => {
      result += `### ${index + 1}. ${drawnCard.position}\n`;
      if (drawnCard.positionMeaning) {
        result += `*${drawnCard.positionMeaning}*\n\n`;
      }
      result += `**${drawnCard.card.name}** (${drawnCard.orientation})\n\n`;
      
      const keywords = drawnCard.orientation === "upright" 
        ? drawnCard.card.keywords.upright 
        : drawnCard.card.keywords.reversed;
      result += `*Keywords: ${keywords.join(", ")}*\n\n`;
    });

    result += `## Interpretation\n\n`;
    result += reading.interpretation;

    return result;
  }

  /**
   * Get a specific spread by type
   */
  public getSpreadByType(spreadType: string): any {
    return getSpread(spreadType);
  }

  /**
   * Generate cryptographically secure random orientation
   */
  private getSecureRandomOrientation(): CardOrientation {
    return getSecureRandomInt(2) === 0 ? "upright" : "reversed";
  }

  private drawCards(count: number): TarotCard[] {
    return this.randomSource.drawCards
      ? this.randomSource.drawCards(count)
      : this.cardManager.getRandomCards(count);
  }

  private drawOrientation(): CardOrientation {
    return this.randomSource.drawOrientation
      ? this.randomSource.drawOrientation()
      : this.getSecureRandomOrientation();
  }


  /**
   * Generate a unique reading ID with secure randomness
   */
  private generateReadingId(): string {
    const timestamp = Date.now();
    const randomPart = getSecureRandomInt(1000000000).toString(36);
    return `reading_${timestamp}_${randomPart}`;
  }
}
