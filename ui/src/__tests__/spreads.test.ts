import { SPREAD_TYPES } from "@tarot/shared/types.js";
import { getSpreadPickerCatalog } from "@tarot/readings/spread-localizations.js";
import { TAROT_SPREADS } from "@tarot/readings/spreads.js";
import { autoLayout, layoutForSpread, SPREAD_LAYOUTS } from "../spreads.js";

describe("spread layouts", () => {
  it("defines a complete layout for all 25 built-in spreads", () => {
    expect(Object.keys(SPREAD_LAYOUTS).sort()).toEqual([...SPREAD_TYPES].sort());
    for (const id of SPREAD_TYPES) {
      expect(SPREAD_LAYOUTS[id], id).toHaveLength(TAROT_SPREADS[id].cardCount);
      for (const position of SPREAD_LAYOUTS[id]) {
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThanOrEqual(100);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("uses the server catalog names in the setup picker", () => {
    const chinese = getSpreadPickerCatalog("zh");
    const career = chinese.find((spread) => spread.id === "career_path");
    const weekly = chinese.find((spread) => spread.id === "weekly_forecast");
    expect(career?.name).toBe("职业发展牌阵");
    expect(weekly?.name).toBe("一周运势");
    expect(chinese.map((spread) => spread.id).sort()).toEqual(
      [...SPREAD_TYPES].sort(),
    );
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
