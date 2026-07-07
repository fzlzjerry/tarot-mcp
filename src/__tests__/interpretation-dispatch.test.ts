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

/** Chinese headings mirroring EXPECTED_ANALYSIS, spread by spread. */
const EXPECTED_ANALYSIS_ZH: Record<SpreadType, string | "generic" | null> = {
  single_card: null,
  three_card: "三牌流动分析",
  celtic_cross: "凯尔特十字分析",
  horseshoe: "generic",
  relationship_cross: "关系动态分析",
  career_path: "事业路径分析",
  decision_making: "generic",
  spiritual_guidance: "灵性发展分析",
  year_ahead: "年度前瞻总览",
  chakra_alignment: "脉轮能量分析",
  shadow_work: "generic",
  venus_love: "金星之爱能量分析",
  tree_of_life: "生命之树灵性分析",
  astrological_houses: "占星宫位分析",
  mandala: "曼陀罗圆满分析",
  pentagram: "五芒星元素分析",
  mirror_of_truth: "真相之镜——四束光明分析",
  daily_guidance: null,
  yes_no: "generic",
  weekly_forecast: "generic",
  new_moon_intentions: "generic",
  full_moon_release: "generic",
  elemental_balance: "generic",
  past_life_karma: "generic",
  compatibility: "generic",
};

function analysisHeadings(
  expected: Record<SpreadType, string | "generic" | null>,
  generic: string,
): string[] {
  return [
    ...new Set(
      Object.values(expected).filter(
        (v): v is string => typeof v === "string" && v !== "generic",
      ),
    ),
    generic,
  ];
}

const ALL_ANALYSIS_HEADINGS = analysisHeadings(
  EXPECTED_ANALYSIS,
  "Contextual Spread Analysis",
);
const ALL_ANALYSIS_HEADINGS_ZH = analysisHeadings(
  EXPECTED_ANALYSIS_ZH,
  "牌阵脉络分析",
);

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

  it.each(SPREAD_TYPES.map((type) => [type] as const))(
    "routes %s to its localized analyzer for zh readings",
    (spreadType) => {
      const expected = EXPECTED_ANALYSIS_ZH[spreadType];

      const result = readingManager.performReading(
        spreadType,
        "现在的情况如何？",
        undefined,
        { language: "zh" },
      );

      if (expected === null) {
        for (const heading of ALL_ANALYSIS_HEADINGS_ZH) {
          expect(result).not.toContain(heading);
        }
      } else if (expected === "generic") {
        expect(result).toContain("牌阵脉络分析");
      } else {
        expect(result).toContain(expected);
        expect(result).not.toContain("牌阵脉络分析");
      }

      // The interpretation prose itself must be Chinese, never the en text.
      for (const heading of ALL_ANALYSIS_HEADINGS) {
        expect(result).not.toContain(heading);
      }
    },
  );

  it("gives custom spreads the localized generic analysis for zh readings", () => {
    const result = readingManager.performCustomReading(
      "Celtic Cross Career Love Chakra",
      "A trap-named custom spread",
      [
        { name: "A", meaning: "First" },
        { name: "B", meaning: "Second" },
      ],
      "牌阵名会撞车吗？",
      undefined,
      { language: "zh" },
    );

    expect(result).toContain("牌阵脉络分析");
    for (const heading of [
      ...ALL_ANALYSIS_HEADINGS,
      ...ALL_ANALYSIS_HEADINGS_ZH.slice(0, -1),
    ]) {
      expect(result).not.toContain(heading);
    }
  });

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
