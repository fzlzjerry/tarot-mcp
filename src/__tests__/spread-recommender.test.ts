import { TarotServer } from "../mcp/tarot-service.js";
import { TOOL_NAMES } from "../mcp/public-api.js";

let server: TarotServer;

beforeAll(async () => {
  server = await TarotServer.create();
});

async function recommend(args: Record<string, unknown>): Promise<string> {
  const result = await server.executeTool(TOOL_NAMES.recommendSpread, args);
  if (!result.ok) {
    throw new Error(`recommend_spread failed: ${result.error}`);
  }
  return result.text;
}

/** Extract recommended spread ids in display order from the Markdown. */
function extractSpreads(markdown: string): string[] {
  return [...markdown.matchAll(/## \d+\. ([^(]+) \(\d+% match\)/g)].map((m) =>
    m[1].trim().toLowerCase().replace(/ /g, "_"),
  );
}

describe("recommend_spread characterization", () => {
  it("recommends love spreads for love questions, ordered by confidence", async () => {
    const result = await recommend({
      question: "Will my relationship with my partner improve?",
    });
    expect(extractSpreads(result)).toEqual([
      "venus_love",
      "relationship_cross",
      "compatibility",
    ]);
    expect(result).toContain("(90% match)");
  });

  it("recommends the career path spread for job questions", async () => {
    const result = await recommend({ question: "Should I change my job?" });
    // "should i" also fires decision rules; career and decision tie at 0.9
    // with career pushed first.
    const spreads = extractSpreads(result);
    expect(spreads).toContain("career_path");
    expect(spreads).toContain("decision_making");
    expect(spreads[0]).toBe("career_path");
  });

  it("honors the category parameter without keyword matches", async () => {
    const result = await recommend({
      question: "Tell me more",
      category: "spiritual",
    });
    expect(extractSpreads(result)).toEqual([
      "spiritual_guidance",
      "tree_of_life",
    ]);
  });

  it("honors the timeframe parameter", async () => {
    const result = await recommend({
      question: "What lies ahead?",
      timeframe: "long_term",
    });
    // "ahead" is not a keyword, but "future" isn't present either; the
    // long_term timeframe alone selects the yearly spreads.
    expect(extractSpreads(result)).toEqual(["year_ahead", "celtic_cross"]);
  });

  it("recommends karmic and lunar spreads from special keywords", async () => {
    const karma = await recommend({ question: "What karma from my past life?" });
    expect(extractSpreads(karma)[0]).toBe("past_life_karma");

    const moon = await recommend({ question: "What does this moon cycle mean?" });
    expect(extractSpreads(moon)).toEqual(
      expect.arrayContaining(["new_moon_intentions", "full_moon_release"]),
    );
  });

  it("recommends shadow work for hidden/unconscious questions", async () => {
    const result = await recommend({
      question: "What hidden forces are in my unconscious?",
    });
    expect(extractSpreads(result)[0]).toBe("shadow_work");
  });

  it("falls back to versatile defaults when nothing matches", async () => {
    const result = await recommend({ question: "Hmm." });
    expect(extractSpreads(result)).toEqual(["three_card", "celtic_cross"]);
    expect(result).toContain("(60% match)");
    expect(result).toContain("(50% match)");
  });

  it("caps recommendations at three and deduplicates", async () => {
    const result = await recommend({
      question:
        "Will my love relationship with my partner survive this karma from a past life under the full moon?",
    });
    const spreads = extractSpreads(result);
    expect(spreads).toHaveLength(3);
    expect(new Set(spreads).size).toBe(3);
  });

  it("echoes the question, category, and timeframe in the header", async () => {
    const result = await recommend({
      question: "What about work?",
      timeframe: "short_term",
      category: "career",
    });
    expect(result).toContain('**Your Question:** "What about work?"');
    expect(result).toContain("**Category:** career | **Timeframe:** short_term");
    expect(result).toContain("`perform_reading` with spreadType:");
  });

  it("rejects invalid timeframe and category values", async () => {
    const badTimeframe = await server.executeTool(TOOL_NAMES.recommendSpread, {
      question: "Hi",
      timeframe: "someday",
    });
    expect(badTimeframe.ok).toBe(false);

    const badCategory = await server.executeTool(TOOL_NAMES.recommendSpread, {
      question: "Hi",
      category: "gambling",
    });
    expect(badCategory.ok).toBe(false);
  });
});
