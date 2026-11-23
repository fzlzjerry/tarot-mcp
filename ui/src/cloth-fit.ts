import type { LayoutPoint } from "./types.js";

export interface ClothBox {
  /** Cloth size in CSS pixels. */
  width: number;
  height: number;
  /** Card height over card width. */
  aspect: number;
  /** Height a position caption takes beside its card; 0 when captions are hidden. */
  caption: number;
  min: number;
  max: number;
}

export interface ClothFit {
  /** Card width in whole CSS pixels. */
  slotWidth: number;
  /** The layout, moved only as far as it takes to keep every card on the cloth. */
  points: LayoutPoint[];
  /**
   * How wide each card's caption may run, in whole CSS pixels, before a
   * neighbouring card, another caption or the rim is in its way.
   */
  captionWidths: number[];
}

/** Clearance kept between a card and the cloth rim, and between neighbours. */
const RIM = 10;
const GAP = 8;
/**
 * Clearance between a caption and the card below it: wider than the 7px a
 * caption keeps from its own card, so it reads as belonging to that one.
 */
const CAPTION_GAP = 14;
/** Clearance between the end of a caption and whatever stops it. */
const CAPTION_SIDE = 6;
/** The gap between two cards standing either side of one point, as in CSS. */
const SIDE_GAP = 12;

const sideways = (point: LayoutPoint): boolean =>
  Math.abs(point.rotation ?? 0) % 180 === 90;

/** A card on the cloth: its centre, and how far it and its caption reach. */
interface Placed {
  x: number;
  y: number;
  /** Half the card's bounding box, with its rotation taken into account. */
  halfWidth: number;
  halfHeight: number;
  /** Caption room over the top edge and under the bottom edge. */
  above: number;
  below: number;
  /** The caption's band, as offsets from the centre; absent when hidden. */
  caption?: { top: number; bottom: number };
  /** How far the centre stands from the layout point, for a card beside it. */
  aside: number;
}

/** How far a card reaches before and after its centre along one axis. */
interface Reach {
  centre: number;
  before: number;
  after: number;
}

/**
 * Slide a run of cards back inside [RIM, size - RIM]; squeeze the run only
 * when it is longer than the room there is. The squeeze is anchored on the
 * outermost centres, so a wide card in the middle of the run costs the cards
 * at its ends nothing.
 */
function settle(cards: Reach[], size: number): (value: number) => number {
  const start = Math.min(...cards.map((card) => card.centre - card.before));
  const end = Math.max(...cards.map((card) => card.centre + card.after));
  if (start >= RIM && end <= size - RIM) return (value) => value;
  if (end - start <= size - 2 * RIM) {
    const shift = start < RIM ? RIM - start : size - RIM - end;
    return (value) => value + shift;
  }
  const first = Math.min(...cards.map((card) => card.centre));
  const last = Math.max(...cards.map((card) => card.centre));
  const outermost = (edge: number, pick: (card: Reach) => number): number =>
    Math.max(
      ...cards.filter((card) => Math.abs(card.centre - edge) < 1).map(pick),
    );
  const low = RIM + outermost(first, (card) => card.before);
  const high = size - RIM - outermost(last, (card) => card.after);
  if (last - first < 1) return () => (low + high) / 2;
  const scale = Math.max(0, high - low) / (last - first);
  return (value) => low + (value - first) * scale;
}

function place(
  layout: LayoutPoint[],
  box: ClothBox,
  width: number,
): { placed: Placed[]; clear: boolean } {
  const height = width * box.aspect;
  const gapY = box.caption > 0 ? CAPTION_GAP : GAP;
  const cards = layout.map((point) => {
    const turned = sideways(point);
    const angle = ((point.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const halfHeight = (width * sin + height * cos) / 2;
    // A sideways card lies across an upright one. Its caption sits above the
    // pair, so the upright card under it needs that room over its top edge.
    const crossed =
      !turned &&
      layout.some(
        (other) =>
          sideways(other) && other.x === point.x && other.y === point.y,
      );
    return {
      halfWidth: (width * cos + height * sin) / 2,
      halfHeight,
      above: crossed ? box.caption : 0,
      below: turned ? 0 : box.caption,
      caption:
        box.caption === 0
          ? undefined
          : turned
            ? { top: -height / 2 - box.caption, bottom: -height / 2 }
            : { top: halfHeight, bottom: halfHeight + box.caption },
    };
  });
  // A card beside its point is drawn that far from it at any size, so the
  // offset is taken off again before the point is handed back.
  const aside = layout.map(
    (point) => ((point.side ?? 0) * (width + SIDE_GAP)) / 2,
  );
  const moveX = settle(
    layout.map((point, index) => ({
      centre: (point.x / 100) * box.width + aside[index],
      before: cards[index].halfWidth,
      after: cards[index].halfWidth,
    })),
    box.width,
  );
  const moveY = settle(
    layout.map((point, index) => ({
      centre: (point.y / 100) * box.height,
      before: cards[index].halfHeight + cards[index].above,
      after: cards[index].halfHeight + cards[index].below,
    })),
    box.height,
  );
  const placed = layout.map((point, index) => ({
    ...cards[index],
    x: moveX((point.x / 100) * box.width + aside[index]),
    y: moveY((point.y / 100) * box.height),
    aside: aside[index],
  }));
  const clear = placed.every(
    (card, index) =>
      card.x - card.halfWidth >= RIM - 0.5 &&
      card.x + card.halfWidth <= box.width - RIM + 0.5 &&
      card.y - card.halfHeight - card.above >= RIM - 0.5 &&
      card.y + card.halfHeight + card.below <= box.height - RIM + 0.5 &&
      placed.slice(index + 1).every((other) => {
        const dx = Math.abs(card.x - other.x);
        const dy = Math.abs(card.y - other.y);
        // Two cards on one point are a deliberate stack.
        if (dx < 1 && dy < 1) return true;
        const [upper, lower] =
          card.y <= other.y ? [card, other] : [other, card];
        return (
          dx >= card.halfWidth + other.halfWidth + GAP ||
          dy >=
            upper.halfHeight +
              upper.below +
              lower.above +
              lower.halfHeight +
              gapY
        );
      }),
  );
  return { placed, clear };
}

/**
 * A caption is one line, centred on its card and cut short with an ellipsis.
 * It may run as wide as the cloth allows: up to the rim, up to any card whose
 * side stands in its line, and half way to a caption written on the same line.
 */
function captionWidths(
  placed: Placed[],
  box: ClothBox,
  width: number,
): number[] {
  return placed.map((card, index) => {
    const band = card.caption;
    if (!band) return 0;
    const top = card.y + band.top;
    const bottom = card.y + band.bottom;
    let room = Math.min(card.x, box.width - card.x) - CAPTION_SIDE;
    placed.forEach((other, at) => {
      if (at === index) return;
      const apart = Math.abs(other.x - card.x);
      if (
        other.y - other.halfHeight < bottom - 1 &&
        other.y + other.halfHeight > top + 1
      ) {
        room = Math.min(room, apart - other.halfWidth - CAPTION_SIDE);
      }
      if (
        other.caption &&
        other.y + other.caption.top < bottom - 1 &&
        other.y + other.caption.bottom > top + 1
      ) {
        room = Math.min(room, apart / 2 - CAPTION_SIDE);
      }
    });
    // Never narrower than the card it names, even on a cloth too full to fit.
    return Math.floor(Math.max(width, 2 * room));
  });
}

/**
 * The widest card at which every card of the layout stays on the cloth and
 * clear of its neighbours, with the layout nudged inward where a card would
 * otherwise cross the rim. A card is also a button, so the result never drops
 * below `min` even when that still overlaps.
 */
export function fitCloth(layout: LayoutPoint[], box: ClothBox): ClothFit {
  let low = Math.floor(box.min);
  let high = Math.max(low, Math.floor(box.max));
  if (place(layout, box, low).clear) {
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (place(layout, box, middle).clear) low = middle;
      else high = middle - 1;
    }
  }
  const { placed } = place(layout, box, low);
  return {
    slotWidth: low,
    points: layout.map((point, index) => ({
      ...point,
      x: ((placed[index].x - placed[index].aside) / box.width) * 100,
      y: (placed[index].y / box.height) * 100,
    })),
    captionWidths: captionWidths(placed, box, low),
  };
}
