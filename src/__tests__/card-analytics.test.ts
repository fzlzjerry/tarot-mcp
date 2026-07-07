import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotCardAnalytics } from "../tarot/cards/card-analytics.js";

describe("TarotCardAnalytics", () => {
  let analytics: TarotCardAnalytics;

  beforeAll(async () => {
    const cardManager = await TarotCardManager.create();
    analytics = new TarotCardAnalytics(cardManager.getAllCards());
  });

  it("reports the canonical deck composition", () => {
    const { overview } = analytics.generateReport();

    expect(overview.totalCards).toBe(78);
    expect(overview.arcanaDistribution.major).toBe(22);
    expect(overview.arcanaDistribution.minor).toBe(56);
    expect(overview.suitDistribution).toEqual({
      wands: 14,
      cups: 14,
      swords: 14,
      pentacles: 14,
    });
  });

  it("reports element coverage for every suit and the majors", () => {
    const { overview } = analytics.generateReport();
    const totalWithElements = Object.values(
      overview.elementDistribution,
    ).reduce((a, b) => a + b, 0);

    expect(Object.keys(overview.elementDistribution).sort()).toEqual([
      "air",
      "earth",
      "fire",
      "water",
    ]);
    expect(totalWithElements).toBeGreaterThanOrEqual(56);
  });

  it("finds the card data complete", () => {
    const { overview, dataQuality } = analytics.generateReport();

    expect(dataQuality.completeCards).toBe(overview.totalCards);
    expect(dataQuality.incompleteCards).toEqual([]);
    expect(overview.completionRate).toBe(100);
    expect(dataQuality.averageKeywordsPerCard).toBeGreaterThan(0);
    expect(dataQuality.averageSymbolsPerCard).toBeGreaterThan(0);
  });

  it("analyzes keyword frequency and content lengths", () => {
    const { contentAnalysis } = analytics.generateReport();

    expect(contentAnalysis.mostCommonKeywords.length).toBeGreaterThan(0);
    const [top] = contentAnalysis.mostCommonKeywords;
    expect(top.count).toBeGreaterThanOrEqual(1);
    expect(top.percentage).toBeGreaterThan(0);

    expect(
      contentAnalysis.lengthStatistics.averageDescriptionLength,
    ).toBeGreaterThan(0);
    expect(
      contentAnalysis.lengthStatistics.longestDescription.length,
    ).toBeGreaterThanOrEqual(
      contentAnalysis.lengthStatistics.shortestDescription.length,
    );
  });

  it("caches the report (immutable card data)", () => {
    expect(analytics.generateReport()).toBe(analytics.generateReport());
  });
});
