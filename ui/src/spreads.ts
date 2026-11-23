import type { LayoutPoint } from "./types.js";

const point = (x: number, y: number, rotation = 0): LayoutPoint => ({
  x,
  y,
  rotation,
});

function line(count: number, y = 50, from = 12, to = 88): LayoutPoint[] {
  if (count === 1) return [point(50, y)];
  return Array.from({ length: count }, (_, index) =>
    point(from + ((to - from) * index) / (count - 1), y),
  );
}

/**
 * A column in two files. Each card stands to one side of the centre line, so
 * neighbours sit side by side and a card only has to clear the one two steps
 * below it: six or seven cards stay readable on a table that is wider than it
 * is tall.
 */
function column(count: number, from = 10, to = 90): LayoutPoint[] {
  if (count === 1) return [point(50, 50)];
  return Array.from({ length: count }, (_, index) => ({
    ...point(50, from + ((to - from) * index) / (count - 1)),
    side: index % 2 === 0 ? -1 : 1,
  }));
}

/**
 * A row that steps up and down. Seven cards side by side leave each one a
 * seventh of a phone's width; alternating two levels lets neighbours overlap
 * in x, so the row keeps its order and the cards stay large enough to read.
 */
function wave(count: number, swing = 13, from = 12, to = 88): LayoutPoint[] {
  return line(count, 50, from, to).map(({ x }, index) =>
    point(x, 50 + (index % 2 === 0 ? -swing : swing)),
  );
}

function ring(
  count: number,
  radiusX = 37,
  radiusY = 39,
  offset = -90,
): LayoutPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = ((offset + (360 * index) / count) * Math.PI) / 180;
    return point(
      50 + Math.cos(angle) * radiusX,
      50 + Math.sin(angle) * radiusY,
    );
  });
}

function grid(
  count: number,
  columns = Math.ceil(Math.sqrt(count)),
): LayoutPoint[] {
  const rows = Math.ceil(count / columns);
  const xGap = columns === 1 ? 0 : 76 / (columns - 1);
  const yGap = rows === 1 ? 0 : 76 / (rows - 1);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const itemsInRow = Math.min(columns, count - row * columns);
    const columnIndex = index % columns;
    const rowWidth = (itemsInRow - 1) * xGap;
    return point(
      50 - rowWidth / 2 + columnIndex * xGap,
      rows === 1 ? 50 : 12 + row * yGap,
    );
  });
}

export function autoLayout(count: number): LayoutPoint[] {
  const safeCount = Math.max(1, Math.min(78, Math.floor(count)));
  const columns = Math.max(1, Math.ceil(Math.sqrt(safeCount * 1.45)));
  return grid(safeCount, columns);
}

export const SPREAD_LAYOUTS: Record<string, LayoutPoint[]> = {
  single_card: [point(50, 50)],
  three_card: line(3),
  // The cross's arms sit further apart than the staff does from the cross:
  // the card laid sideways is half as wide again as its upright neighbours.
  celtic_cross: [
    point(39, 50),
    point(39, 50, 90),
    point(39, 84),
    point(12.5, 50),
    point(39, 16),
    point(65.5, 50),
    point(87.5, 88),
    point(87.5, 64),
    point(87.5, 40),
    point(87.5, 16),
  ],
  // Each arm drops a full card per step, so the shoe holds its shape on a
  // cloth that is taller than it is wide.
  horseshoe: [
    point(10, 14),
    point(21, 38),
    point(33, 61),
    point(50, 84),
    point(67, 61),
    point(79, 38),
    point(90, 14),
  ],
  relationship_cross: [
    point(20, 50),
    point(80, 50),
    point(50, 50),
    point(50, 18),
    point(50, 82),
    point(28, 18),
    point(72, 18),
  ],
  career_path: [
    point(12, 80),
    point(27, 50),
    point(42, 72),
    point(58, 42),
    point(73, 64),
    point(88, 22),
  ],
  decision_making: [
    point(50, 82),
    point(24, 50),
    point(76, 50),
    point(50, 50),
    point(50, 16),
  ],
  spiritual_guidance: column(6),
  year_ahead: [point(50, 50), ...ring(12)],
  chakra_alignment: column(7),
  shadow_work: [
    point(18, 72),
    point(34, 44),
    point(50, 70),
    point(66, 44),
    point(82, 18),
  ],
  venus_love: [
    point(50, 86),
    point(15, 64),
    point(24, 28),
    point(50, 50),
    point(76, 28),
    point(85, 64),
    point(50, 14),
  ],
  tree_of_life: [
    point(50, 8),
    point(72, 24),
    point(28, 24),
    point(72, 44),
    point(28, 44),
    point(50, 50),
    point(72, 66),
    point(28, 66),
    point(50, 76),
    point(50, 94),
  ],
  astrological_houses: ring(12),
  mandala: [point(50, 50), ...ring(8, 42)],
  pentagram: [
    point(50, 8),
    point(88, 40),
    point(74, 90),
    point(26, 90),
    point(12, 40),
  ],
  mirror_of_truth: [
    point(25, 28, -5),
    point(75, 28, 5),
    point(25, 72, 5),
    point(75, 72, -5),
  ],
  daily_guidance: [point(50, 50)],
  yes_no: [point(25, 62), point(50, 32), point(75, 62)],
  weekly_forecast: wave(7),
  new_moon_intentions: [
    point(50, 50),
    point(20, 68),
    point(32, 20),
    point(68, 20),
    point(80, 68),
  ],
  full_moon_release: [
    point(50, 14),
    point(18, 44),
    point(50, 50),
    point(82, 44),
    point(50, 86),
  ],
  elemental_balance: [point(50, 14), point(82, 50), point(18, 50), point(50, 86)],
  past_life_karma: [
    point(18, 72),
    point(34, 45),
    point(50, 18),
    point(66, 45),
    point(82, 72),
    point(50, 82),
  ],
  compatibility: [
    point(18, 22),
    point(82, 22),
    point(34, 44),
    point(66, 44),
    point(34, 68),
    point(66, 68),
    point(18, 88),
    point(82, 88),
  ],
};

export function layoutForSpread(id: string, cardCount: number): LayoutPoint[] {
  const layout = SPREAD_LAYOUTS[id];
  if (layout && layout.length === cardCount) {
    return layout;
  }
  return autoLayout(cardCount);
}
