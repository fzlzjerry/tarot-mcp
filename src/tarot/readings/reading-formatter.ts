import { Language, TarotReading, TarotSpread } from "../shared/types.js";
import {
  localizedCardName,
  localizedKeywords,
  localizedOrientation,
  pick,
} from "../shared/i18n.js";
import { DrawnCard } from "../shared/types.js";

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
  language: Language = "en",
): string {
  let result = pick(
    language,
    `# ${spreadName} Reading\n\n`,
    `# ${spreadName} 塔罗解读\n\n`,
  );
  result += `${pick(language, "**Question:**", "**问题：**")} ${reading.question}\n`;
  result += `${pick(language, "**Date:**", "**日期：**")} ${reading.timestamp.toISOString()}\n`;
  result += `${pick(language, "**Reading ID:**", "**解读 ID：**")} ${reading.id}\n`;
  if (reading.sessionId) {
    result += `${pick(language, "**Session ID:**", "**会话 ID：**")} ${reading.sessionId}`;
    result +=
      readingNumber > 1
        ? pick(
            language,
            ` (reading #${readingNumber} in this session)`,
            // Leading space is load-bearing: clients extract the sessionId
            // as the whitespace-delimited token after the label, so the
            // marker must never be glued onto the id.
            ` （本会话第 ${readingNumber} 次解读）`,
          )
        : "";
    result += pick(
      language,
      `\n*Pass this sessionId to future readings to continue the session.*\n`,
      `\n*在后续解读中传入此 sessionId 即可延续本会话。*\n`,
    );
  }
  result += `\n`;

  result += `*${spreadDescription}*\n\n`;

  result += pick(language, `## Your Cards\n\n`, `## 你抽到的牌\n\n`);
  reading.cards.forEach((drawnCard: DrawnCard, index: number) => {
    result += `### ${index + 1}. ${drawnCard.position}\n`;
    if (drawnCard.positionMeaning) {
      result += `*${drawnCard.positionMeaning}*\n\n`;
    }
    result += `**${localizedCardName(drawnCard.card, language)}**${orientationLabel(drawnCard.orientation, language)}\n\n`;

    const keywords = localizedKeywords(
      drawnCard.card,
      drawnCard.orientation,
      language,
    );
    result += pick(
      language,
      `*Keywords: ${keywords.join(", ")}*\n\n`,
      `*关键词：${keywords.join("、")}*\n\n`,
    );
  });

  result += pick(language, `## Interpretation\n\n`, `## 解读\n\n`);
  result += reading.interpretation;

  return result;
}

export function orientationLabel(
  orientation: "upright" | "reversed",
  language: Language,
): string {
  const label = localizedOrientation(orientation, language);
  return language === "zh" ? `（${label}）` : ` (${label})`;
}

/**
 * Render the catalog of available spreads as Markdown.
 */
export function renderAvailableSpreads(
  spreads: TarotSpread[],
  language: Language = "en",
): string {
  let result = pick(
    language,
    "# Available Tarot Spreads\n\n",
    "# 可用塔罗牌阵\n\n",
  );

  spreads.forEach(spread => {
    result += pick(
      language,
      `## ${spread.name} (${spread.cardCount} cards)\n\n`,
      `## ${spread.name}（${spread.cardCount} 张牌）\n\n`,
    );
    result += `${spread.description}\n\n`;

    result += pick(language, "**Positions:**\n", "**牌位：**\n");
    spread.positions.forEach((position, index) => {
      result += `${index + 1}. **${position.name}**: ${position.meaning}\n`;
    });
    result += "\n";
  });

  result += pick(
    language,
    "Use the `perform_reading` tool with one of these spread types to get a reading.",
    "使用 `perform_reading` 工具并传入上述任一牌阵类型即可进行解读。",
  );

  return result;
}
