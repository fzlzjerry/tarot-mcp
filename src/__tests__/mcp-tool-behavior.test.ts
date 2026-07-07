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
  const result = await server.executeTool(TOOL_NAMES[toolKey], args);
  return result.ok ? result.text : result.error;
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

  it("lists a session's readings through get_session_history", async () => {
    const first = await executeTool("performReading", {
      spreadType: "single_card",
      question: "First question?",
    });
    const sessionId = first.match(/\*\*Session ID:\*\* (\S+)/)![1];

    await executeTool("performReading", {
      spreadType: "three_card",
      question: "Second question?",
      sessionId,
    });

    const history = await executeTool("getSessionHistory", { sessionId });
    expect(history).toContain("Session History");
    expect(history).toContain("**Readings performed:** 2");
    expect(history).toContain("First question?");
    expect(history).toContain("Second question?");
    expect(history).toContain("single_card");
    expect(history).toContain("three_card");

    const missing = await executeTool("getSessionHistory", {
      sessionId: "session_nope",
    });
    expect(missing).toContain('Error: Session "session_nope" not found');
  });

  it("keeps natural-language characters like < and > in questions", async () => {
    const result = await executeTool("performReading", {
      spreadType: "single_card",
      question: "Will my salary be < 50k or > 100k?",
    });

    expect(result).toContain("Will my salary be < 50k or > 100k?");
  });

  it("renders readings in Chinese when language=zh", async () => {
    const result = await executeTool("performReading", {
      spreadType: "three_card",
      question: "我的事业发展如何？",
      language: "zh",
    });

    expect(result).toContain("塔罗解读");
    expect(result).toContain("**问题：**");
    expect(result).toContain("## 你抽到的牌");
    expect(result).toContain("## 解读");
    expect(result).toContain("**整体解读：**");
    // Orientation labels are localized
    expect(result).toMatch(/（正位）|（逆位）/);
    expect(result).not.toContain("## Interpretation");
  });

  it("renders card info in Chinese when language=zh", async () => {
    const result = await executeTool("getCardInfo", {
      cardName: "The Fool",
      language: "zh",
    });

    expect(result).toContain("**阿卡纳：** 大阿卡纳");
    expect(result).toContain("**关键词：**");
    expect(result).toContain("## 象征意义");
  });

  it("keeps the English path unchanged and rejects unknown languages", async () => {
    const english = await executeTool("performReading", {
      spreadType: "single_card",
      question: "Plain English?",
    });
    expect(english).toContain("# Single Card Reading");
    expect(english).toContain("## Interpretation");

    const bad = await executeTool("performReading", {
      spreadType: "single_card",
      question: "Hi",
      language: "fr",
    });
    expect(bad).toContain("Error: Invalid language");
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
