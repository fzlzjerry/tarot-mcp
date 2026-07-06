import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { getSpread } from "../tarot/readings/spreads.js";
import { SPREAD_TYPES, SpreadType } from "../tarot/shared/types.js";

/**
 * Which cross-card analysis section each built-in spread must produce.
 * "generic" = the contextual fallback; null = no cross-card section
 * (single-card spreads).
 */
const EXPECTED_ANALYSIS: Record<SpreadType, string | "generic" | null> = {
  single_card: null,
  three_card: "Three Card Flow Analysis",
  celtic_cross: "Celtic Cross Analysis",
  horseshoe: "generic",
  relationship_cross: "Relationship Dynamics Analysis",
  career_path: "Career Path Analysis",
  decision_making: "generic",
  spiritual_guidance: "Spiritual Development Analysis",
  year_ahead: "Year Ahead Overview",
  chakra_alignment: "Chakra Energy Analysis",
  shadow_work: "generic",
  venus_love: "Venus Love Energy Analysis",
  tree_of_life: "Tree of Life Spiritual Analysis",
  astrological_houses: "Astrological Houses Analysis",
  mandala: "Mandala Wholeness Analysis",
  pentagram: "Pentagram Elemental Analysis",
  mirror_of_truth: "Mirror of Truth - Four Beams of Light Analysis",
  daily_guidance: null,
  yes_no: "generic",
  weekly_forecast: "generic",
  new_moon_intentions: "generic",
  full_moon_release: "generic",
  elemental_balance: "generic",
  past_life_karma: "generic",
  compatibility: "generic",
};

const ALL_ANALYSIS_HEADINGS = [
  ...new Set(
    Object.values(EXPECTED_ANALYSIS).filter(
      (v): v is string => typeof v === "string" && v !== "generic",
    ),
  ),
  "Contextual Spread Analysis",
];

describe("interpretation analyzer dispatch", () => {
  let cardManager: TarotCardManager;
  let readingManager: TarotReadingManager;

  beforeAll(async () => {
    cardManager = await TarotCardManager.create();
    const allCards = cardManager.getAllCards();
    readingManager = new TarotReadingManager(
      cardManager,
      new TarotSessionManager(),
      {
        drawCards: (count) => [...allCards.slice(0, count)],
        drawOrientation: () => "upright",
      },
    );
  });

  it.each(SPREAD_TYPES.map((type) => [type] as const))(
    "routes %s to its registered analyzer",
    (spreadType) => {
      const spread = getSpread(spreadType)!;
      const expected = EXPECTED_ANALYSIS[spreadType];

      const result = readingManager.performReading(
        spreadType,
        "What is happening?",
      );

      if (expected === null) {
        // Single-card spreads get no cross-card analysis at all.
        for (const heading of ALL_ANALYSIS_HEADINGS) {
          expect(result).not.toContain(heading);
        }
        expect(spread.cardCount).toBe(1);
      } else if (expected === "generic") {
        expect(result).toContain("Contextual Spread Analysis");
      } else {
        expect(result).toContain(expected);
        expect(result).not.toContain("Contextual Spread Analysis");
      }
    },
  );

  it("gives custom spreads the generic analysis regardless of their name", () => {
    const result = readingManager.performCustomReading(
      "Celtic Cross Career Love Chakra",
      "A trap-named custom spread",
      [
        { name: "A", meaning: "First" },
        { name: "B", meaning: "Second" },
      ],
      "Does the name collide?",
    );

    expect(result).toContain("Contextual Spread Analysis");
    for (const heading of ALL_ANALYSIS_HEADINGS.slice(0, -1)) {
      expect(result).not.toContain(heading);
    }
  });
});
