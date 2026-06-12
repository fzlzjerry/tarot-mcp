import { SPREAD_TYPES } from "../tarot/shared/types.js";
import { TOOL_NAMES } from "./public-api.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export function getToolDefinitions(): Tool[] {
  return [
    {
      name: TOOL_NAMES.getCardInfo,
      description:
        "Get detailed information about a specific tarot card from the Rider-Waite deck",
      inputSchema: {
        type: "object",
        properties: {
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
      description: "List all available tarot cards in the Rider-Waite deck",
      inputSchema: {
        type: "object",
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
      description:
        "List all available tarot spreads with their positions and meanings",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.performReading,
      description: "Perform a tarot card reading using a specific spread",
      inputSchema: {
        type: "object",
        properties: {
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
    },
    {
      name: TOOL_NAMES.searchCards,
      description:
        "Search for tarot cards using various criteria like keywords, suit, element, etc.",
      inputSchema: {
        type: "object",
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
    },
    {
      name: TOOL_NAMES.findSimilarCards,
      description: "Find cards with similar meanings to a given card",
      inputSchema: {
        type: "object",
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
      description:
        "Get comprehensive analytics and statistics about the tarot card database",
      inputSchema: {
        type: "object",
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
      description: "Draw a single card for daily guidance and insight",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "Optional specific question for daily guidance",
            default: "What do I need to know for today?",
          },
        },
      },
    },
    {
      name: TOOL_NAMES.recommendSpread,
      description:
        "Get a recommendation for the most appropriate tarot spread based on your question or situation",
      inputSchema: {
        type: "object",
        properties: {
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
    },
    {
      name: TOOL_NAMES.getMoonPhaseReading,
      description:
        "Perform a tarot reading based on the current moon phase with an appropriate spread",
      inputSchema: {
        type: "object",
        properties: {
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
      description:
        "Compare 2-5 tarot cards, including optional card orientation, to understand their relationships and combined message",
      inputSchema: {
        type: "object",
        description:
          "Provide either cards or legacy cardNames. When both are present, cards takes precedence.",
        properties: {
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
      description:
        "Create a custom tarot spread and draw cards for it. Use this when no existing spread fits your needs and you want to create your own layout with specific positions and meanings.",
      inputSchema: {
        type: "object",
        properties: {
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
    },
  ];
}
