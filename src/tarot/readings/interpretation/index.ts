import { DrawnCard, Language } from "../../shared/types.js";
import { localizedCardName, localizedMeanings, pick } from "../../shared/i18n.js";
import { orientationLabel } from "../reading-formatter.js";
import { generateGenericSpreadAnalysis, selectSpreadAnalysis } from "./analyzers.js";
import { generateOverallInterpretation, selectRelevantMeaning } from "./patterns.js";

/**
 * Generate the full interpretation for a reading: per-card contextual
 * meanings, the spread-specific (or generic) cross-card analysis, and the
 * overall pattern interpretation.
 *
 * Spread-specific analyzers are English-only for now; with language "zh"
 * the reading uses the localized generic cross-card analysis instead so
 * the whole interpretation stays in one language.
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
    `这次「${spreadName}」解读回应你的问题:「${question}」\n\n`,
  );

  // Individual card interpretations with context
  drawnCards.forEach((drawnCard) => {
    const meanings = localizedMeanings(
      drawnCard.card,
      drawnCard.orientation,
      language,
    );

    interpretation += `**${drawnCard.position}**: ${localizedCardName(drawnCard.card, language)}${orientationLabel(drawnCard.orientation, language)}\n`;

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
  const spreadAnalysis =
    language === "en" ? selectSpreadAnalysis(drawnCards, spreadType) : "";
  if (spreadAnalysis) {
    interpretation += spreadAnalysis;
  } else if (drawnCards.length > 1) {
    interpretation += generateGenericSpreadAnalysis(drawnCards, language);
  }

  // Overall interpretation
  interpretation += generateOverallInterpretation(drawnCards, language);

  return interpretation;
}
