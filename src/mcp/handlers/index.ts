import { TOOL_NAMES } from "../public-api.js";
import type { ToolResult } from "../tool-result.js";
import {
  handleFindSimilarCards,
  handleGetAnalytics,
  handleGetCardMeaningsComparison,
  handleGetRandomCards,
  handleSearchCards,
} from "./analytics.js";
import {
  handleGetCardInfo,
  handleListAllCards,
  handleListAvailableSpreads,
} from "./catalog.js";
import type { TarotToolContext, ToolHandler } from "./shared.js";
import {
  handleCreateCustomSpread,
  handleGetDailyCard,
  handleGetMoonPhaseReading,
  handleGetSessionHistory,
  handlePerformReading,
  handleRecommendSpread,
} from "./sessions.js";
import {
  handleBeginVisualReading,
  handleConfirmVisualReading,
} from "./visual.js";

export type BoundToolHandler = (
  args: Record<string, unknown>,
) => ToolResult | Promise<ToolResult>;

const HANDLERS: ReadonlyArray<readonly [string, ToolHandler]> = [
  [TOOL_NAMES.getCardInfo, handleGetCardInfo],
  [TOOL_NAMES.listAllCards, handleListAllCards],
  [TOOL_NAMES.listAvailableSpreads, handleListAvailableSpreads],
  [TOOL_NAMES.performReading, handlePerformReading],
  [TOOL_NAMES.beginVisualReading, handleBeginVisualReading],
  [TOOL_NAMES.confirmVisualReading, handleConfirmVisualReading],
  [TOOL_NAMES.searchCards, handleSearchCards],
  [TOOL_NAMES.findSimilarCards, handleFindSimilarCards],
  [TOOL_NAMES.getDatabaseAnalytics, handleGetAnalytics],
  [TOOL_NAMES.getRandomCards, handleGetRandomCards],
  [TOOL_NAMES.getDailyCard, handleGetDailyCard],
  [TOOL_NAMES.recommendSpread, handleRecommendSpread],
  [TOOL_NAMES.getMoonPhaseReading, handleGetMoonPhaseReading],
  [TOOL_NAMES.getCardMeaningsComparison, handleGetCardMeaningsComparison],
  [TOOL_NAMES.createCustomSpread, handleCreateCustomSpread],
  [TOOL_NAMES.getSessionHistory, handleGetSessionHistory],
];

export function createToolHandlers(
  ctx: TarotToolContext,
): ReadonlyMap<string, BoundToolHandler> {
  return new Map(
    HANDLERS.map(([name, handler]) => [
      name,
      (args: Record<string, unknown>) => handler(ctx, args),
    ]),
  );
}
