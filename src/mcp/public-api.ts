export const MCP_SERVER_INFO = {
  name: "tarot-mcp-server",
  version: "1.0.0",
} as const;

export const HTTP_ENDPOINTS = {
  streamableHttp: "/mcp",
  legacySse: "/sse",
  legacyMessages: "/messages",
  health: "/health",
  draw: "/draw",
  visualCardAssets: "/assets/cards/midnight-art-nouveau-v1",
  api: {
    info: "/api/info",
    spreads: "/api/spreads",
    cards: "/api/cards",
    reading: "/api/reading",
    customSpread: "/api/custom-spread",
    visualReadings: "/api/visual-readings",
    visualHandoffResolve: "/api/visual-handoff/resolve",
    visualHandoffConfirm: "/api/visual-handoff/confirm",
    tools: "/api/tools",
  },
} as const;

export const TOOL_NAMES = {
  getCardInfo: "get_card_info",
  listAllCards: "list_all_cards",
  listAvailableSpreads: "list_available_spreads",
  performReading: "perform_reading",
  beginVisualReading: "begin_visual_reading",
  confirmVisualReading: "confirm_visual_reading",
  searchCards: "search_cards",
  findSimilarCards: "find_similar_cards",
  getDatabaseAnalytics: "get_database_analytics",
  getRandomCards: "get_random_cards",
  getDailyCard: "get_daily_card",
  recommendSpread: "recommend_spread",
  getMoonPhaseReading: "get_moon_phase_reading",
  getCardMeaningsComparison: "get_card_meanings_comparison",
  createCustomSpread: "create_custom_spread",
  getSessionHistory: "get_session_history",
} as const;
