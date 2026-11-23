import { type ClothBox, type ClothFit, fitCloth } from "../cloth-fit.js";
import { autoLayout, SPREAD_LAYOUTS } from "../spreads.js";
import type { LayoutPoint } from "../types.js";

/** The full cloth as the stylesheet draws it at 1440px and at 390px wide. */
const desktop: ClothBox = {
  width: 1338,
  height: 836,
  aspect: 3.35 / 2,
  caption: 22,
  min: 44,
  max: 168,
};
const phone: ClothBox = {
  width: 354,
  height: 520,
  aspect: 3 / 2,
  caption: 0,
  min: 44,
  max: 168,
};

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const sideways = (point: LayoutPoint): boolean =>
  Math.abs(point.rotation ?? 0) % 180 === 90;

/**
 * Each card's footprint in pixels, drawn the way the stylesheet draws it: the
 * card centred on its point, its caption hanging below, and the caption of a
 * card laid across another one sitting above the pair.
 */
function footprints(
  layout: LayoutPoint[],
  box: ClothBox,
  fit: ClothFit,
): Rect[] {
  const height = fit.slotWidth * box.aspect;
  return fit.points.map((point, index) => {
    const turned = sideways(point);
    const crossed =
      !turned &&
      layout.some(
        (other, at) =>
          at !== index &&
          sideways(other) &&
          other.x === layout[index].x &&
          other.y === layout[index].y,
      );
    // A card beside its point stands half a card and half a 12px gap off it.
    const x =
      (point.x / 100) * box.width +
      ((point.side ?? 0) * (fit.slotWidth + 12)) / 2;
    const y = (point.y / 100) * box.height;
    // A tilted card takes the bounding box of its rotated outline.
    const angle = ((point.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const halfWidth = (fit.slotWidth * cos + height * sin) / 2;
    const halfHeight = (fit.slotWidth * sin + height * cos) / 2;
    return {
      left: x - halfWidth,
      right: x + halfWidth,
      top: y - halfHeight - (crossed ? box.caption : 0),
      bottom: y + halfHeight + (turned ? 0 : box.caption),
    };
  });
}

function collisions(
  layout: LayoutPoint[],
  box: ClothBox,
  fit: ClothFit,
): string[] {
  const rects = footprints(layout, box, fit);
  const found: string[] = [];
  rects.forEach((rect, index) => {
    if (
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > box.width ||
      rect.bottom > box.height
    ) {
      found.push(`card ${index + 1} leaves the cloth`);
    }
    rects.slice(index + 1).forEach((other, offset) => {
      const at = index + 1 + offset;
      // Two cards on one point are a deliberate stack.
      if (
        layout[index].x === layout[at].x &&
        layout[index].y === layout[at].y
      ) {
        return;
      }
      if (
        rect.left < other.right &&
        other.left < rect.right &&
        rect.top < other.bottom &&
        other.top < rect.bottom
      ) {
        found.push(`cards ${index + 1} and ${at + 1} overlap`);
      }
    });
  });
  return found;
}

describe("fitting cards to the cloth", () => {
  const spreads = Object.entries(SPREAD_LAYOUTS).filter(
    ([, layout]) => layout.length > 3,
  );

  it.each(spreads)(
    "lays %s out without an overlap on a desk and on a phone",
    (_id, layout) => {
      for (const box of [desktop, phone]) {
        const fit = fitCloth(layout, box);
        expect(fit.points).toHaveLength(layout.length);
        expect(Number.isInteger(fit.slotWidth)).toBe(true);
        expect(fit.slotWidth).toBeGreaterThanOrEqual(box.min);
        expect(fit.slotWidth).toBeLessThanOrEqual(box.max);
        expect(collisions(layout, box, fit)).toEqual([]);
      }
    },
  );

  it("gives a spread the room its layout leaves, not one size for all", () => {
    // Four cards have the table to themselves; ten share it.
    expect(fitCloth(autoLayout(4), desktop).slotWidth).toBe(desktop.max);
    expect(
      fitCloth(SPREAD_LAYOUTS.celtic_cross, desktop).slotWidth,
    ).toBeLessThan(120);
    // The stylesheet alone gave a phone 46px cards for every dense spread.
    expect(
      fitCloth(SPREAD_LAYOUTS.celtic_cross, phone).slotWidth,
    ).toBeGreaterThanOrEqual(60);
    expect(
      fitCloth(SPREAD_LAYOUTS.weekly_forecast, phone).slotWidth,
    ).toBeGreaterThanOrEqual(60);
  });

  it("leaves a layout that already fits exactly where it was", () => {
    const layout = [
      { x: 30, y: 50 },
      { x: 70, y: 50 },
    ];
    const fit = fitCloth(layout, { ...desktop, max: 120 });
    expect(fit.slotWidth).toBe(120);
    expect(fit.points).toEqual(layout);
  });

  it("slides a row inward before it makes the cards smaller", () => {
    const layout = [
      { x: 2, y: 50 },
      { x: 50, y: 50 },
      { x: 98, y: 50 },
    ];
    const box: ClothBox = { ...desktop, width: 1000, height: 600, max: 120 };
    const fit = fitCloth(layout, box);
    expect(fit.slotWidth).toBe(120);
    expect(fit.points.map(({ x }) => Math.round(x * 100) / 100)).toEqual([
      7, 50, 93,
    ]);
    expect(fit.points.map(({ y }) => y)).toEqual([50, 50, 50]);
  });

  it("keeps room above a crossed card for the caption of the card across it", () => {
    const layout = SPREAD_LAYOUTS.celtic_cross;
    const fit = fitCloth(layout, desktop);
    const [present, crossing, , , crown] = footprints(layout, desktop, fit);
    // One centre for the pair, whatever captions either of them carries.
    expect(fit.points[0]).toMatchObject({
      x: fit.points[1].x,
      y: fit.points[1].y,
    });
    expect(Math.round(crossing.bottom - crossing.top)).toBe(fit.slotWidth);
    // The caption above the pair still clears the card over it.
    expect(present.top).toBeGreaterThan(crown.bottom);
  });

  it("lets a caption run as far as the cloth is free and no further", () => {
    const box: ClothBox = { ...desktop, width: 1000, height: 600, max: 100 };
    // Side by side, two captions share the line and meet half way.
    expect(
      fitCloth(
        [
          { x: 30, y: 50 },
          { x: 70, y: 50 },
        ],
        box,
      ).captionWidths,
    ).toEqual([388, 388]);
    // A card standing lower down blocks the first caption at its near side;
    // nothing is beside its own caption but the rim.
    const stepped = fitCloth(
      [
        { x: 40, y: 40 },
        { x: 55, y: 60 },
      ],
      box,
    );
    expect(stepped.slotWidth).toBe(100);
    expect(stepped.captionWidths).toEqual([188, 888]);
    // With captions hidden there is nothing to make room for.
    expect(fitCloth(SPREAD_LAYOUTS.celtic_cross, phone).captionWidths).toEqual(
      Array.from({ length: 10 }, () => 0),
    );
  });

  it("never squeezes a caption narrower than its own card", () => {
    for (const [, layout] of spreads) {
      const fit = fitCloth(layout, desktop);
      for (const width of fit.captionWidths) {
        expect(width).toBeGreaterThanOrEqual(fit.slotWidth);
      }
    }
  });

  it("holds the 44px floor for a spread no phone can lay out clear", () => {
    const layout = autoLayout(60);
    const fit = fitCloth(layout, phone);
    expect(fit.slotWidth).toBe(44);
    expect(collisions(layout, phone, fit)).not.toEqual([]);
  });
});
