import { DrawnCard } from "../../shared/types.js";
import { generateGenericSpreadAnalysis, selectSpreadAnalysis } from "./analyzers.js";
import { generateOverallInterpretation, selectRelevantMeaning } from "./patterns.js";

/**
 * Generate the full interpretation for a reading: per-card contextual
 * meanings, the spread-specific (or generic) cross-card analysis, and the
 * overall pattern interpretation.
 */
export function generateInterpretation(
  drawnCards: DrawnCard[],
  question: string,
  spreadType: string,
  spreadName: string,
): string {
  let interpretation = `This ${spreadName} reading addresses your question: "${question}"\n\n`;

  // Individual card interpretations with context
  drawnCards.forEach((drawnCard) => {
    const meanings = drawnCard.orientation === "upright"
      ? drawnCard.card.meanings.upright
      : drawnCard.card.meanings.reversed;

    interpretation += `**${drawnCard.position}**: ${drawnCard.card.name} (${drawnCard.orientation})\n`;

    // Choose the most relevant meaning based on position
    const relevantMeaning = selectRelevantMeaning(
      meanings,
      drawnCard.position || "General",
      question,
      drawnCard.positionMeaning
    );
    interpretation += `${relevantMeaning}\n\n`;
  });

  // Add spread-specific analysis. An analyzer returns "" when the card
  // count doesn't match its layout; fall back to the generic analysis
  // instead of silently dropping all cross-card analysis.
  const spreadAnalysis = selectSpreadAnalysis(drawnCards, spreadType);
  if (spreadAnalysis) {
    interpretation += spreadAnalysis;
  } else if (drawnCards.length > 1) {
    interpretation += generateGenericSpreadAnalysis(drawnCards);
  }

  // Overall interpretation
  interpretation += generateOverallInterpretation(drawnCards);

  return interpretation;
}
