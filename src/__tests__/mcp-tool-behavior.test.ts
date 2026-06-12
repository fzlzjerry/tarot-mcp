import { execFileSync } from "node:child_process";

function executeNodeScript<T>(script: string): T {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return JSON.parse(output.trim()) as T;
}

function getAvailableTools(): Array<{
  name: string;
  inputSchema: Record<string, unknown>;
}> {
  return executeNodeScript(`
    const { TarotServer } = await import("./src/mcp/tarot-service.ts");
    const server = await TarotServer.create();
    console.log(JSON.stringify(server.getAvailableTools()));
  `);
}

function executeTool(toolKey: string, args: Record<string, unknown>): string {
  return executeNodeScript(`
    const { TarotServer } = await import("./src/mcp/tarot-service.ts");
    const { TOOL_NAMES } = await import("./src/mcp/public-api.ts");
    const server = await TarotServer.create();
    const result = await server.executeTool(TOOL_NAMES[${JSON.stringify(toolKey)}], ${JSON.stringify(args)});
    console.log(JSON.stringify(result));
  `);
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

  it("supports oriented cards in card meanings comparison while preserving legacy cardNames input", () => {
    const reversedResult = executeTool("getCardMeaningsComparison", {
        cards: [
          { name: "The Fool", orientation: "reversed" },
          { name: "The Magician", orientation: "upright" },
        ],
        context: "career planning",
      });

    expect(reversedResult).toContain("The Fool (reversed)");
    expect(reversedResult).toContain("recklessness");
    expect(reversedResult).not.toContain("The Fool (upright)");

    const legacyResult = executeTool("getCardMeaningsComparison", {
        cardNames: ["The Fool", "The Magician"],
        context: "career planning",
      });

    expect(legacyResult).toContain("The Fool (upright)");
    expect(legacyResult).toContain("The Magician (upright)");
  });

  it("rejects get_random_cards parameters that are not exposed in the MCP schema", () => {
    const result = executeTool("getRandomCards", {
      count: 1,
      number: 0,
    });

    expect(result).toContain("Error: Invalid filters");
    expect(result).toContain("Unsupported get_random_cards parameter: number");
  });
});
