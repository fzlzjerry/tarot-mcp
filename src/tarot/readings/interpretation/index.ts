import { DrawnCard, Language } from "../../shared/types.js";
import { localizedCardName, localizedMeanings, pick } from "../../shared/i18n.js";
import { orientationLabel } from "../reading-formatter.js";
import { generateGenericSpreadAnalysis, selectSpreadAnalysis } from "./analyzers.js";
import { generateOverallInterpretation, selectRelevantMeaning } from "./patterns.js";

/**
 * Generate the full interpretation for a reading: per-card contextual
 * meanings, the spread-specific (or generic) cross-card analysis, and the
 * overall pattern interpretation. All sections are bilingual (en/zh).
 */
export function generateInterpretation(
  drawnCards: DrawnCard[],
  question: string,
  spreadType: string,
  spreadName: string,
  language: Language = "en",
): string {
  let interpretation = pick(
    language,
    `This ${spreadName} reading addresses your question: "${question}"\n\n`,
    `这次「${spreadName}」解读回应你的问题：「${question}」\n\n`,
  );

  // Individual card interpretations with context
  drawnCards.forEach((drawnCard) => {
    const meanings = localizedMeanings(
      drawnCard.card,
      drawnCard.orientation,
      language,
    );

    interpretation += pick(
      language,
      `**${drawnCard.position}**: `,
      `**${drawnCard.position}**：`,
    );
    interpretation += `${localizedCardName(drawnCard.card, language)}${orientationLabel(drawnCard.orientation, language)}\n`;

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
  const spreadAnalysis = selectSpreadAnalysis(drawnCards, spreadType, language);
  if (spreadAnalysis) {
    interpretation += spreadAnalysis;
  } else if (drawnCards.length > 1) {
    interpretation += generateGenericSpreadAnalysis(drawnCards, language);
  }

  // Overall interpretation
  interpretation += generateOverallInterpretation(drawnCards, language);

  return interpretation;
}
