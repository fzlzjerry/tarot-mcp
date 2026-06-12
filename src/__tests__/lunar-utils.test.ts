import {
  calculateMoonPhase,
  getMoonPhaseRecommendations,
  getNextMoonPhase,
  getSeasonalInfo,
  isSignificantMoonPhase,
} from "../tarot/readings/lunar-utils.js";

const PHASE_ORDER = [
  "new",
  "waxing_crescent",
  "first_quarter",
  "waxing_gibbous",
  "full",
  "waning_gibbous",
  "last_quarter",
  "waning_crescent",
] as const;

describe("calculateMoonPhase", () => {
  it("returns new moon for the 2000-01-06 18:14 UTC reference new moon", () => {
    expect(calculateMoonPhase(new Date("2000-01-06T18:14:00Z")).phase).toBe(
      "new",
    );
  });

  it("returns new moon for the 2024-01-11 new moon (old epoch continuity)", () => {
    expect(calculateMoonPhase(new Date("2024-01-11T00:00:00Z")).phase).toBe(
      "new",
    );
    expect(calculateMoonPhase(new Date("2024-01-11T12:00:00Z")).phase).toBe(
      "new",
    );
  });

  it("returns new moon for 2024-02-09 (previously misreported as waning crescent)", () => {
    expect(calculateMoonPhase(new Date("2024-02-09T00:00:00Z")).phase).toBe(
      "new",
    );
  });

  it.each([
    "2023-07-03T12:00:00Z",
    "2024-01-25T12:00:00Z",
    "2020-10-31T12:00:00Z",
  ])("returns full moon for the known full moon on %s", (iso) => {
    expect(calculateMoonPhase(new Date(iso)).phase).toBe("full");
  });

  it("returns full moon for the pre-epoch 1999-12-22 full moon (negative modulo path)", () => {
    expect(calculateMoonPhase(new Date("1999-12-22T12:00:00Z")).phase).toBe(
      "full",
    );
  });

  it("returns first quarter around 2024-01-18", () => {
    expect(calculateMoonPhase(new Date("2024-01-18T00:00:00Z")).phase).toBe(
      "first_quarter",
    );
  });

  it("returns last quarter around 2024-02-02", () => {
    expect(calculateMoonPhase(new Date("2024-02-02T12:00:00Z")).phase).toBe(
      "last_quarter",
    );
  });

  it("derives illumination from the cycle position", () => {
    const newMoon = calculateMoonPhase(new Date("2024-01-11T12:00:00Z"));
    expect(newMoon.illumination).toBeLessThan(0.05);

    const fullMoon = calculateMoonPhase(new Date("2023-07-03T12:00:00Z"));
    expect(fullMoon.illumination).toBeGreaterThan(0.95);

    const firstQuarter = calculateMoonPhase(new Date("2024-01-18T12:00:00Z"));
    expect(Math.abs(firstQuarter.illumination - 0.5)).toBeLessThanOrEqual(0.1);

    const lastQuarter = calculateMoonPhase(new Date("2024-02-02T12:00:00Z"));
    expect(Math.abs(lastQuarter.illumination - 0.5)).toBeLessThanOrEqual(0.1);
  });

  it("always reports illumination between 0 and 1", () => {
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2024, 0, 11 + day));
      const { illumination } = calculateMoonPhase(date);
      expect(illumination).toBeGreaterThanOrEqual(0);
      expect(illumination).toBeLessThanOrEqual(1);
    }
  });
});

describe("isSignificantMoonPhase", () => {
  it("flags actual new moons as significant", () => {
    expect(isSignificantMoonPhase(new Date("2024-02-09T12:00:00Z"))).toBe(
      true,
    );
  });

  it("flags actual full moons as significant", () => {
    expect(isSignificantMoonPhase(new Date("2023-07-03T12:00:00Z"))).toBe(
      true,
    );
  });

  it("does not flag crescent phases as significant", () => {
    expect(isSignificantMoonPhase(new Date("2024-01-14T12:00:00Z"))).toBe(
      false,
    );
  });
});

describe("getNextMoonPhase", () => {
  it.each([
    "2024-01-11T12:00:00Z",
    "2024-01-18T00:00:00Z",
    "2024-02-07T00:00:00Z",
    "1999-12-22T12:00:00Z",
  ])("advances %s to the immediately following phase", (iso) => {
    const currentDate = new Date(iso);
    const current = calculateMoonPhase(currentDate);
    const next = getNextMoonPhase(currentDate);

    expect(next.date.getTime()).toBeGreaterThan(currentDate.getTime());
    expect(next.phase.phase).not.toBe(current.phase);
    expect(calculateMoonPhase(next.date).phase).toBe(next.phase.phase);

    const currentIndex = PHASE_ORDER.indexOf(current.phase);
    const expectedNext = PHASE_ORDER[(currentIndex + 1) % PHASE_ORDER.length];
    expect(next.phase.phase).toBe(expectedNext);
  });
});

describe("getMoonPhaseRecommendations", () => {
  it("includes the phase name and the next phase", () => {
    const recommendations = getMoonPhaseRecommendations(
      new Date("2023-07-03T12:00:00Z"),
    );

    expect(recommendations).toContain("Full Moon Tarot Guidance");
    expect(recommendations).toContain("**Next Phase:**");
  });
});

describe("getSeasonalInfo", () => {
  it.each([
    ["2024-04-15T12:00:00Z", "spring"],
    ["2024-07-15T12:00:00Z", "summer"],
    ["2024-10-15T12:00:00Z", "autumn"],
    ["2024-01-15T12:00:00Z", "winter"],
  ])("maps %s to %s", (iso, season) => {
    expect(getSeasonalInfo(new Date(iso)).season).toBe(season);
  });
});
