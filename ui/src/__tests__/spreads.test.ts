import { autoLayout, layoutForSpread, SPREAD_TEMPLATES } from "../spreads.js";

describe("spread layouts", () => {
  it("defines a complete layout for all 25 built-in spreads", () => {
    expect(SPREAD_TEMPLATES).toHaveLength(25);
    expect(new Set(SPREAD_TEMPLATES.map((spread) => spread.id)).size).toBe(25);
    for (const spread of SPREAD_TEMPLATES) {
      expect(spread.layout, spread.id).toHaveLength(spread.positions.length);
      for (const position of spread.layout) {
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThanOrEqual(100);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("falls back to a centered automatic layout for custom spreads", () => {
    for (const count of [1, 2, 5, 10, 15]) {
      const layout = autoLayout(count);
      expect(layout).toHaveLength(count);
      expect(new Set(layout.map(({ x, y }) => `${x}:${y}`)).size).toBe(count);
    }
    expect(layoutForSpread("custom", 11)).toEqual(autoLayout(11));
  });
});
