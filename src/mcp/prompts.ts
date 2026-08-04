import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PROMPTS = [
  {
    name: "perform-reading",
    description:
      "Perform a tarot reading for a question with a chosen spread and interpret it card by card",
    arguments: [
      {
        name: "question",
        description: "The question or focus for the reading",
        required: true,
      },
      {
        name: "spreadType",
        description:
          "Spread type id (see list_available_spreads); omit to let the assistant pick one",
        required: false,
      },
      {
        name: "language",
        description: 'Output language: "en" or "zh" (default: en)',
        required: false,
      },
    ],
  },
  {
    name: "daily-draw",
    description: "Draw and interpret a single daily guidance card",
    arguments: [
      {
        name: "question",
        description: "Optional focus for the day",
        required: false,
      },
      {
        name: "language",
        description: 'Output language: "en" or "zh" (default: en)',
        required: false,
      },
    ],
  },
] as const;

/**
 * Register canonical reading workflows as MCP prompts.
 */
export function registerPrompts(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: [...prompt.arguments],
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "perform-reading") {
      const question =
        args?.question ?? "What guidance do the cards have for me?";
      const spreadType = args?.spreadType;
      const language = args?.language === "zh" ? "zh" : "en";
      const spreadInstruction = spreadType
        ? `Use the "${spreadType}" spread.`
        : "Pick a fitting spread first (the recommend_spread tool can help).";
      const languageInstruction =
        language === "zh"
          ? 'Pass language: "zh" to every tarot tool and answer in Simplified Chinese.'
          : 'Pass language: "en" to every tarot tool and answer in English.';
      return {
        description: "Guided tarot reading",
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Please perform a tarot reading for this question: "${question}". ` +
                `${spreadInstruction} ${languageInstruction} Call the perform_reading tool, then walk me ` +
                `through each card's meaning in its position and finish with an ` +
                `overall synthesis and practical guidance.`,
            },
          },
        ],
      };
    }

    if (name === "daily-draw") {
      const question = args?.question;
      const language = args?.language === "zh" ? "zh" : "en";
      return {
        description: "Daily card draw",
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Draw my daily tarot card with the get_daily_card tool` +
                `${question ? ` focused on: "${question}"` : ""}. Pass language: "${language}" and interpret ` +
                `its guidance for my day in a warm, practical tone.`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });
}
