import { TarotServer } from "../mcp/tarot-service.js";
import { TOOL_NAMES } from "../mcp/public-api.js";

let server: TarotServer;

beforeAll(async () => {
  server = await TarotServer.create();
});

function getAvailableTools(): Array<{
  name: string;
  inputSchema: Record<string, unknown>;
}> {
  return server.getAvailableTools();
}

async function executeTool(
  toolKey: keyof typeof TOOL_NAMES,
  args: Record<string, unknown>,
): Promise<string> {
  return server.executeTool(TOOL_NAMES[toolKey], args);
}

function findSchemaKeywordPaths(
  value: unknown,
  keywords: Set<string>,
  path = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findSchemaKeywordPaths(item, keywords, `${path}[${index}]`),
    );
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const currentPath = `${path}.${key}`;
    const childPaths = findSchemaKeywordPaths(child, keywords, currentPath);
    return keywords.has(key) ? [currentPath, ...childPaths] : childPaths;
  });
}

describe("MCP tool behavior", () => {
  it("publishes Codex-compatible top-level input schemas", () => {
    const disallowedTopLevelKeywords = [
      "oneOf",
      "anyOf",
      "allOf",
      "enum",
      "not",
    ];

    const tools = getAvailableTools();

    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: "object" });

      for (const keyword of disallowedTopLevelKeywords) {
        expect(tool.inputSchema).not.toHaveProperty(keyword);
      }
    }

    const comparisonTool = tools.find(
      (tool) => tool.name === "get_card_meanings_comparison",
    );
    expect(comparisonTool).toBeDefined();
  });

  it("keeps the card meanings comparison schema free of Codex-sensitive keywords", () => {
    const comparisonTool = getAvailableTools().find(
      (tool) => tool.name === "get_card_meanings_comparison",
    );
    expect(comparisonTool).toBeDefined();

    expect(
      findSchemaKeywordPaths(
        comparisonTool!.inputSchema,
        new Set(["oneOf", "anyOf", "allOf", "enum", "not"]),
      ),
    ).toEqual([]);
  });

  it("supports oriented cards in card meanings comparison while preserving legacy cardNames input", async () => {
    const reversedResult = await executeTool("getCardMeaningsComparison", {
      cards: [
        { name: "The Fool", orientation: "reversed" },
        { name: "The Magician", orientation: "upright" },
      ],
      context: "career planning",
    });

    expect(reversedResult).toContain("The Fool (reversed)");
    expect(reversedResult).toContain("recklessness");
    expect(reversedResult).not.toContain("The Fool (upright)");

    const legacyResult = await executeTool("getCardMeaningsComparison", {
      cardNames: ["The Fool", "The Magician"],
      context: "career planning",
    });

    expect(legacyResult).toContain("The Fool (upright)");
    expect(legacyResult).toContain("The Magician (upright)");
  });

  it("rejects get_random_cards parameters that are not exposed in the MCP schema", async () => {
    const result = await executeTool("getRandomCards", {
      count: 1,
      number: 0,
    });

    expect(result).toContain("Error: Invalid filters");
    expect(result).toContain("Unsupported get_random_cards parameter: number");
  });
});
