import { execFileSync } from "node:child_process";

function executeTool(toolKey: string, args: Record<string, unknown>): string {
  const script = `
    const { TarotServer } = await import("./src/mcp/tarot-service.ts");
    const { TOOL_NAMES } = await import("./src/mcp/public-api.ts");
    const server = await TarotServer.create();
    const result = await server.executeTool(TOOL_NAMES[${JSON.stringify(toolKey)}], ${JSON.stringify(args)});
    console.log(JSON.stringify(result));
  `;

  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return JSON.parse(output.trim()) as string;
}

describe("MCP tool behavior", () => {
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
