import { SPREAD_TYPES } from "../tarot/shared/types.js";
import { TOOL_NAMES } from "./public-api.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/** structuredContent shape for tools that perform a reading. */
const READING_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    readingId: { type: "string" },
    sessionId: {
      type: "string",
      description: "Present when the reading is tracked in a session",
    },
    spreadType: { type: "string" },
    spreadName: { type: "string" },
    question: { type: "string" },
    timestamp: { type: "string", description: "ISO 8601" },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          orientation: { type: "string" },
          position: { type: "string" },
          positionMeaning: { type: "string" },
        },
        required: ["name", "orientation"],
      },
    },
  },
  required: [
    "readingId",
    "spreadType",
    "spreadName",
    "question",
    "timestamp",
    "cards",
  ],
};

// Definitions are static; build them once at module load.
const TOOL_DEFINITIONS: readonly Tool[] = Object.freeze([
    {
      name: TOOL_NAMES.getCardInfo,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Get detailed information about a specific tarot card from the Rider-Waite deck",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
          cardName: {
            type: "string",
            description:
              "The name of the tarot card (e.g., 'The Fool', 'Two of Cups')",
          },
          orientation: {
            type: "string",
            enum: ["upright", "reversed"],
            description: "The orientation of the card (upright or reversed)",
            default: "upright",
          },
        },
        required: ["cardName"],
      },
    },
    {
      name: TOOL_NAMES.listAllCards,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description: "List all available tarot cards in the Rider-Waite deck",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: [
              "all",
              "major_arcana",
              "minor_arcana",
              "wands",
              "cups",
              "swords",
              "pentacles",
            ],
            description: "Filter cards by category",
            default: "all",
          },
        },
      },
    },
    {
      name: TOOL_NAMES.listAvailableSpreads,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "List all available tarot spreads with their positions and meanings",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
        },
      },
    },
    {
      name: TOOL_NAMES.performReading,
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      description: "Perform a tarot card reading using a specific spread",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
          spreadType: {
            type: "string",
            enum: [...SPREAD_TYPES],
            description: "The type of tarot spread to perform",
          },
          question: {
            type: "string",
            description: "The question or focus for the reading",
          },
          sessionId: {
            type: "string",
            description:
              "Optional session ID returned by a previous reading; omit to start a new session",
          },
        },
        required: ["spreadType", "question"],
      },
      outputSchema: READING_OUTPUT_SCHEMA,
    },
    {
      name: TOOL_NAMES.searchCards,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Search for tarot cards using various criteria like keywords, suit, element, etc.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          keyword: {
            type: "string",
            description:
              "Search keyword to find in card meanings, keywords, or symbolism",
          },
          suit: {
            type: "string",
            enum: ["wands", "cups", "swords", "pentacles"],
            description: "Filter by card suit",
          },
          arcana: {
            type: "string",
            enum: ["major", "minor"],
            description: "Filter by arcana type",
          },
          element: {
            type: "string",
            enum: ["fire", "water", "air", "earth"],
            description: "Filter by element",
          },
          number: {
            type: "integer",
            minimum: 0,
            maximum: 21,
            description: "Filter by card number",
          },
          orientation: {
            type: "string",
            enum: ["upright", "reversed"],
            description: "Search in upright or reversed meanings",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            description: "Maximum number of results to return (default: 10)",
          },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          totalMatches: { type: "integer" },
          showing: { type: "integer" },
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                suit: { type: "string" },
                element: { type: "string" },
                relevanceScore: { type: "number" },
                matchedFields: { type: "array", items: { type: "string" } },
              },
              required: ["id", "name", "relevanceScore", "matchedFields"],
            },
          },
        },
        required: ["totalMatches", "showing", "results"],
      },
    },
    {
      name: TOOL_NAMES.findSimilarCards,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description: "Find cards with similar meanings to a given card",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          cardName: {
            type: "string",
            description: "The name of the card to find similar cards for",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 77,
            description:
              "Maximum number of similar cards to return (default: 5)",
          },
        },
        required: ["cardName"],
      },
    },
    {
      name: TOOL_NAMES.getDatabaseAnalytics,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Get comprehensive analytics and statistics about the tarot card database",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          includeRecommendations: {
            type: "boolean",
            description:
              "Whether to include improvement recommendations (default: true)",
          },
        },
      },
    },
    {
      name: TOOL_NAMES.getRandomCards,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
      description: "Get random cards with optional filtering",
      inputSchema: {
        type: "object",
        // The handler rejects unknown parameters; advertise that contract.
        additionalProperties: false,
        properties: {
          count: {
            type: "integer",
            minimum: 1,
            maximum: 78,
            description: "Number of random cards to draw (default: 1)",
          },
          suit: {
            type: "string",
            enum: ["wands", "cups", "swords", "pentacles"],
            description: "Filter by card suit",
          },
          arcana: {
            type: "string",
            enum: ["major", "minor"],
            description: "Filter by arcana type",
          },
          element: {
            type: "string",
            enum: ["fire", "water", "air", "earth"],
            description: "Filter by element",
          },
        },
      },
    },
    {
      name: TOOL_NAMES.getDailyCard,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
      description: "Draw a single card for daily guidance and insight",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
          question: {
            type: "string",
            description: "Optional specific question for daily guidance",
            default: "What do I need to know for today?",
          },
        },
      },
      outputSchema: READING_OUTPUT_SCHEMA,
    },
    {
      name: TOOL_NAMES.recommendSpread,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Get a recommendation for the most appropriate tarot spread based on your question or situation",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
          question: {
            type: "string",
            description:
              "Your question or description of the situation you want guidance on",
          },
          timeframe: {
            type: "string",
            enum: ["immediate", "short_term", "long_term", "any"],
            description: "The timeframe you're asking about",
            default: "any",
          },
          category: {
            type: "string",
            enum: ["love", "career", "spiritual", "general", "decision", "any"],
            description: "The category of your question",
            default: "any",
          },
        },
        required: ["question"],
      },
      outputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          timeframe: { type: "string" },
          category: { type: "string" },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                spread: { type: "string" },
                reason: { type: "string" },
                confidence: { type: "number" },
              },
              required: ["spread", "reason", "confidence"],
            },
          },
        },
        required: ["question", "timeframe", "category", "recommendations"],
      },
    },
    {
      name: TOOL_NAMES.getMoonPhaseReading,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
      description:
        "Perform a tarot reading based on the current moon phase with an appropriate spread",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
          question: {
            type: "string",
            description:
              "Your question or intention for the moon phase reading",
          },
          customDate: {
            type: "string",
            description:
              "Optional custom date in YYYY-MM-DD format (defaults to today)",
          },
        },
        required: ["question"],
      },
    },
    {
      name: TOOL_NAMES.getCardMeaningsComparison,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "Compare 2-5 tarot cards, including optional card orientation, to understand their relationships and combined message",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        description:
          "Provide either cards or legacy cardNames. When both are present, cards takes precedence.",
        properties: {
          language: {
            type: "string",
            description: 'Output language: "en" or "zh" (default: en)',
            default: "en",
          },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The card name",
                },
                orientation: {
                  type: "string",
                  description:
                    "Optional orientation for this card: upright or reversed (defaults to upright)",
                  default: "upright",
                },
              },
              required: ["name"],
            },
            description:
              "Preferred input: array of 2-5 card objects with names and optional orientations",
            minItems: 2,
            maxItems: 5,
          },
          cardNames: {
            type: "array",
            items: {
              type: "string",
            },
            description:
              "Legacy input: array of 2-5 card names, interpreted as upright",
            minItems: 2,
            maxItems: 5,
          },
          context: {
            type: "string",
            description:
              "The context or question for interpreting these cards together",
          },
        },
      },
    },
    {
      name: TOOL_NAMES.createCustomSpread,
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      description:
        "Create a custom tarot spread and draw cards for it. Use this when no existing spread fits your needs and you want to create your own layout with specific positions and meanings.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          language: {
            type: "string",
            enum: ["en", "zh"],
            description: "Output language (default: en)",
            default: "en",
          },
          spreadName: {
            type: "string",
            description: "Name for your custom spread",
          },
          description: {
            type: "string",
            description:
              "Description of what this spread is designed to explore",
          },
          positions: {
            type: "array",
            description:
              "Array of position objects defining each card position in the spread",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description:
                    "Name of this position (e.g., 'Past Influences', 'Current Challenge')",
                },
                meaning: {
                  type: "string",
                  description: "What this position represents in the reading",
                },
              },
              required: ["name", "meaning"],
            },
            minItems: 1,
            maxItems: 15,
          },
          question: {
            type: "string",
            description: "The question or focus for this reading",
          },
          sessionId: {
            type: "string",
            description:
              "Optional session ID returned by a previous reading; omit to start a new session",
          },
        },
        required: ["spreadName", "description", "positions", "question"],
      },
      outputSchema: READING_OUTPUT_SCHEMA,
    },
    {
      name: TOOL_NAMES.getSessionHistory,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      description:
        "List the readings performed so far in a session (summaries with spread, question, time, and drawn cards)",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          sessionId: {
            type: "string",
            description:
              "The session ID returned by a previous reading",
          },
        },
        required: ["sessionId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          createdAt: { type: "string", description: "ISO 8601" },
          readingCount: { type: "integer" },
          storedReadings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                readingId: { type: "string" },
                spreadType: { type: "string" },
                question: { type: "string" },
                timestamp: { type: "string", description: "ISO 8601" },
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      orientation: { type: "string" },
                      position: { type: "string" },
                    },
                    required: ["name", "orientation"],
                  },
                },
              },
              required: ["readingId", "spreadType", "question", "timestamp", "cards"],
            },
          },
        },
        required: ["sessionId", "createdAt", "readingCount", "storedReadings"],
      },
    },
]);

export function getToolDefinitions(): Tool[] {
  return [...TOOL_DEFINITIONS];
}
