/**
 * Display-order and arc-geometry helpers for the drawing ritual.
 *
 * These functions only ever reorder or position the *presentation* of the
 * opaque slot ids. The server already randomised the deck and owns the
 * slotId -> card binding, so shuffling here adds no randomness. What it does
 * add is real agency: the reader picks by position, so where the cut lands
 * genuinely changes which cards surface.
 */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Deterministic 32-bit PRNG (mulberry32) so a given cut always replays. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cut the deck at `cutIndex`: everything below the cut moves to the top,
 * exactly like lifting the upper half and setting it down underneath.
 */
export function cutDeck<T>(order: readonly T[], cutIndex: number): T[] {
  if (order.length === 0) return [];
  const size = order.length;
  const k = ((Math.trunc(cutIndex) % size) + size) % size;
  return [...order.slice(k), ...order.slice(0, k)];
}

/** Seeded Fisher-Yates. Same seed, same order — every time. */
export function shuffleWithSeed<T>(order: readonly T[], seed: number): T[] {
  const result = [...order];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Fold the cut position and the length of the drag into one stable seed. */
export function deriveSeed(cutIndex: number, entropy: number): number {
  const a = Math.trunc(cutIndex) >>> 0;
  const b = Math.trunc(entropy) >>> 0;
  return (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)) >>> 0;
}

/** The full ritual: cut where the reader chose, then shuffle on that cut. */
export function ritualOrder<T>(
  order: readonly T[],
  cutIndex: number,
  entropy: number,
): T[] {
  return shuffleWithSeed(cutDeck(order, cutIndex), deriveSeed(cutIndex, entropy));
}

export interface ArcConfig {
  /** Distance in px between the centres of adjacent cards along the strip. */
  step: number;
  /** Card width in px. */
  cardWidth: number;
  /** How far the arc drops from apex to edge, in px. */
  depth: number;
  /** Distance from the apex at which the arc reaches full depth, in px. */
  reach: number;
}

export const DEFAULT_ARC: ArcConfig = {
  step: 34,
  cardWidth: 92,
  depth: 104,
  reach: 620,
};

/** Total width the strip needs so no card is clipped at either end. */
export function arcStripWidth(total: number, config: ArcConfig): number {
  return Math.max(0, total - 1) * config.step + config.cardWidth;
}

/** Static left offset of a card in the strip. Never changes while scrolling. */
export function arcCardLeft(index: number, config: ArcConfig): number {
  return index * config.step;
}

export interface ArcCurve {
  /** Downward offset in px. 0 at the apex. */
  y: number;
  /** Rotation in degrees, tangent to the arc. Negative left of the apex. */
  rotation: number;
}

/**
 * Where a card sits on the arc, given how far its centre is from the apex.
 *
 * The arc is the parabola y = depth * (d/reach)^2, so the rotation is that
 * parabola's own tangent rather than an arbitrary tilt — which is why the
 * spread reads as one continuous sweep instead of individually tilted cards.
 */
export function arcCurve(offsetFromApex: number, config: ArcConfig): ArcCurve {
  const d = clamp(offsetFromApex / config.reach, -1, 1);
  return {
    y: config.depth * d * d,
    rotation: (Math.atan2(2 * config.depth * d, config.reach) * 180) / Math.PI,
  };
}

/**
 * Pointer-proximity lift. Compact support: cards beyond `radius` get exactly
 * zero, so a hover only ever disturbs its immediate neighbours.
 */
export function proximityLift(
  distance: number,
  radius: number,
  amount: number,
): number {
  const t = clamp(1 - Math.abs(distance) / radius, 0, 1);
  return amount * t * t * (3 - 2 * t);
}
