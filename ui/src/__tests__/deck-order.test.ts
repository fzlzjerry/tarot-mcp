import {
  DEFAULT_ARC,
  arcCardLeft,
  arcCurve,
  arcStripWidth,
  clamp,
  cutDeck,
  deriveSeed,
  proximityLift,
  ritualOrder,
  shuffleWithSeed,
} from "../deck-order.js";

const deck = Array.from({ length: 78 }, (_, index) => `slot-${index + 1}`);

describe("cutDeck", () => {
  it("moves everything below the cut to the top", () => {
    expect(cutDeck([1, 2, 3, 4, 5], 2)).toEqual([3, 4, 5, 1, 2]);
  });

  it("treats a cut of zero and a cut of the full length as no cut", () => {
    expect(cutDeck([1, 2, 3], 0)).toEqual([1, 2, 3]);
    expect(cutDeck([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it("wraps out-of-range and negative cuts instead of dropping cards", () => {
    expect(cutDeck([1, 2, 3, 4], 5)).toEqual([2, 3, 4, 1]);
    expect(cutDeck([1, 2, 3, 4], -1)).toEqual([4, 1, 2, 3]);
  });

  it("keeps every card exactly once", () => {
    const cut = cutDeck(deck, 41);
    expect(cut).toHaveLength(78);
    expect(new Set(cut).size).toBe(78);
  });

  it("handles an empty deck", () => {
    expect(cutDeck([], 3)).toEqual([]);
  });
});

describe("shuffleWithSeed", () => {
  it("is deterministic for a given seed", () => {
    expect(shuffleWithSeed(deck, 12345)).toEqual(shuffleWithSeed(deck, 12345));
  });

  it("produces a different order for a different seed", () => {
    expect(shuffleWithSeed(deck, 1)).not.toEqual(shuffleWithSeed(deck, 2));
  });

  it("is a permutation, never a rewrite", () => {
    const shuffled = shuffleWithSeed(deck, 999);
    expect(shuffled).toHaveLength(78);
    expect([...shuffled].sort()).toEqual([...deck].sort());
  });

  it("does not mutate its input", () => {
    const original = [...deck];
    shuffleWithSeed(deck, 7);
    expect(deck).toEqual(original);
  });
});

describe("ritualOrder", () => {
  it("preserves the full 78-card deck", () => {
    const order = ritualOrder(deck, 33, 812);
    expect(order).toHaveLength(78);
    expect(new Set(order).size).toBe(78);
  });

  it("replays identically for the same cut and drag", () => {
    expect(ritualOrder(deck, 33, 812)).toEqual(ritualOrder(deck, 33, 812));
  });

  it("gives a different deck when the cut lands elsewhere", () => {
    expect(ritualOrder(deck, 20, 500)).not.toEqual(ritualOrder(deck, 21, 500));
  });

  it("gives a different deck when the drag differs", () => {
    expect(ritualOrder(deck, 20, 500)).not.toEqual(ritualOrder(deck, 20, 501));
  });
});

describe("deriveSeed", () => {
  it("returns an unsigned 32-bit integer", () => {
    for (const [cut, entropy] of [
      [0, 0],
      [77, 4096],
      [-5, -900],
    ]) {
      const seed = deriveSeed(cut, entropy);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("arc geometry", () => {
  it("sits flat and upright at the apex", () => {
    const curve = arcCurve(0, DEFAULT_ARC);
    expect(curve.y).toBe(0);
    expect(curve.rotation).toBe(0);
  });

  it("drops and rotates symmetrically either side of the apex", () => {
    const left = arcCurve(-300, DEFAULT_ARC);
    const right = arcCurve(300, DEFAULT_ARC);
    expect(left.y).toBeCloseTo(right.y, 6);
    expect(left.rotation).toBeCloseTo(-right.rotation, 6);
    expect(right.rotation).toBeGreaterThan(0);
  });

  it("reaches full depth at the configured reach and clamps past it", () => {
    const atReach = arcCurve(DEFAULT_ARC.reach, DEFAULT_ARC);
    const beyond = arcCurve(DEFAULT_ARC.reach * 4, DEFAULT_ARC);
    expect(atReach.y).toBeCloseTo(DEFAULT_ARC.depth, 6);
    expect(beyond.y).toBeCloseTo(DEFAULT_ARC.depth, 6);
    expect(beyond.rotation).toBeCloseTo(atReach.rotation, 6);
  });

  it("rotates monotonically away from the apex", () => {
    const angles = [0, 150, 300, 450, 600].map(
      (offset) => arcCurve(offset, DEFAULT_ARC).rotation,
    );
    for (let i = 1; i < angles.length; i += 1) {
      expect(angles[i]).toBeGreaterThan(angles[i - 1]);
    }
  });

  it("spaces cards evenly and leaves room for the last one", () => {
    expect(arcCardLeft(0, DEFAULT_ARC)).toBe(0);
    expect(arcCardLeft(5, DEFAULT_ARC)).toBe(5 * DEFAULT_ARC.step);
    expect(arcStripWidth(78, DEFAULT_ARC)).toBe(
      77 * DEFAULT_ARC.step + DEFAULT_ARC.cardWidth,
    );
  });

  it("keeps a single-card strip exactly one card wide", () => {
    expect(arcStripWidth(1, DEFAULT_ARC)).toBe(DEFAULT_ARC.cardWidth);
    expect(arcStripWidth(0, DEFAULT_ARC)).toBe(DEFAULT_ARC.cardWidth);
  });
});

describe("proximityLift", () => {
  it("peaks under the pointer", () => {
    expect(proximityLift(0, 140, 18)).toBeCloseTo(18, 6);
  });

  it("falls to exactly zero at and beyond the radius", () => {
    expect(proximityLift(140, 140, 18)).toBe(0);
    expect(proximityLift(900, 140, 18)).toBe(0);
    expect(proximityLift(-900, 140, 18)).toBe(0);
  });

  it("decays monotonically and symmetrically", () => {
    const near = proximityLift(30, 140, 18);
    const far = proximityLift(100, 140, 18);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(proximityLift(-70, 140, 18)).toBeCloseTo(
      proximityLift(70, 140, 18),
      6,
    );
  });
});

describe("clamp", () => {
  it("bounds on both sides and passes through in range", () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(9, 0, 1)).toBe(1);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
});
