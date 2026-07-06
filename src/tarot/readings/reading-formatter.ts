import { TarotReading, TarotSpread } from "../shared/types.js";

/**
 * Format a reading for display.
 * @param readingNumber The monotonic position of this reading within its
 * session (0/1 = first; session line omits the "#N" marker for the first).
 */
export function formatReading(
  reading: TarotReading,
  spreadName: string,
  spreadDescription: string,
  readingNumber: number,
): string {
  let result = `# ${spreadName} Reading\n\n`;
  result += `**Question:** ${reading.question}\n`;
  result += `**Date:** ${reading.timestamp.toLocaleString()}\n`;
  result += `**Reading ID:** ${reading.id}\n`;
  if (reading.sessionId) {
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
 * Render the catalog of available spreads as Markdown.
 */
export function renderAvailableSpreads(spreads: TarotSpread[]): string {
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
