import type { LayoutPoint, SpreadTemplate } from "./types.js";

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

function column(count: number, x = 50, from = 10, to = 90): LayoutPoint[] {
  if (count === 1) return [point(x, 50)];
  return Array.from({ length: count }, (_, index) =>
    point(x, from + ((to - from) * index) / (count - 1)),
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

function arc(count: number, start = 200, end = 340): LayoutPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle =
      ((start + ((end - start) * index) / Math.max(1, count - 1)) * Math.PI) /
      180;
    return point(50 + Math.cos(angle) * 42, 18 - Math.sin(angle) * 60);
  });
}

export function autoLayout(count: number): LayoutPoint[] {
  const safeCount = Math.max(1, Math.min(78, Math.floor(count)));
  const columns = Math.max(1, Math.ceil(Math.sqrt(safeCount * 1.45)));
  return grid(safeCount, columns);
}

const templates: SpreadTemplate[] = [
  {
    id: "single_card",
    name: { en: "Single Card", zh: "单牌指引" },
    positions: ["The Message"],
    layout: [point(50, 50)],
  },
  {
    id: "three_card",
    name: { en: "Three Card Spread", zh: "三牌阵" },
    positions: ["Past / Situation", "Present / Action", "Future / Outcome"],
    layout: line(3),
  },
  {
    id: "celtic_cross",
    name: { en: "Celtic Cross", zh: "凯尔特十字" },
    positions: [
      "Present Situation",
      "Challenge / Cross",
      "Distant Past / Foundation",
      "Recent Past",
      "Possible Outcome",
      "Near Future",
      "Your Approach",
      "External Influences",
      "Hopes and Fears",
      "Final Outcome",
    ],
    layout: [
      point(36, 50),
      point(36, 50, 90),
      point(36, 84),
      point(12, 50),
      point(36, 16),
      point(60, 50),
      point(84, 88),
      point(84, 64),
      point(84, 40),
      point(84, 16),
    ],
  },
  {
    id: "horseshoe",
    name: { en: "Horseshoe", zh: "马蹄牌阵" },
    positions: [
      "Past",
      "Present",
      "Hidden",
      "Obstacles",
      "External",
      "Advice",
      "Outcome",
    ],
    layout: arc(7),
  },
  {
    id: "relationship_cross",
    name: { en: "Relationship Cross", zh: "关系十字" },
    positions: [
      "You",
      "Partner",
      "Relationship",
      "Union",
      "Division",
      "Advice",
      "Potential",
    ],
    layout: [
      point(20, 50),
      point(80, 50),
      point(50, 50),
      point(50, 18),
      point(50, 82),
      point(28, 18),
      point(72, 18),
    ],
  },
  {
    id: "career_path",
    name: { en: "Career Path", zh: "事业路径" },
    positions: [
      "Now",
      "Skills",
      "Challenges",
      "Opportunities",
      "Action",
      "Outcome",
    ],
    layout: [
      point(12, 72),
      point(28, 56),
      point(44, 68),
      point(58, 42),
      point(74, 52),
      point(88, 20),
    ],
  },
  {
    id: "decision_making",
    name: { en: "Decision Making", zh: "抉择牌阵" },
    positions: ["Situation", "Option A", "Option B", "Knowledge", "Path"],
    layout: [
      point(50, 82),
      point(24, 50),
      point(76, 50),
      point(50, 50),
      point(50, 16),
    ],
  },
  {
    id: "spiritual_guidance",
    name: { en: "Spiritual Guidance", zh: "灵性指引" },
    positions: [
      "State",
      "Lessons",
      "Blocks",
      "Gifts",
      "Guidance",
      "Next Steps",
    ],
    layout: column(6),
  },
  {
    id: "year_ahead",
    name: { en: "Year Ahead", zh: "年度展望" },
    positions: [
      "Theme",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    layout: [point(50, 50), ...ring(12)],
  },
  {
    id: "chakra_alignment",
    name: { en: "Chakra Alignment", zh: "脉轮校准" },
    positions: [
      "Root",
      "Sacral",
      "Solar Plexus",
      "Heart",
      "Throat",
      "Third Eye",
      "Crown",
    ],
    layout: column(7),
  },
  {
    id: "shadow_work",
    name: { en: "Shadow Work", zh: "阴影功课" },
    positions: [
      "Shadow",
      "Manifestation",
      "Gift",
      "Integration",
      "Transformation",
    ],
    layout: [
      point(18, 72),
      point(34, 44),
      point(50, 70),
      point(66, 44),
      point(82, 18),
    ],
  },
  {
    id: "venus_love",
    name: { en: "Venus Love", zh: "金星爱情" },
    positions: [
      "Energy",
      "Self Love",
      "Attraction",
      "Blocks",
      "Enhancement",
      "Desire",
      "Potential",
    ],
    layout: [
      point(50, 84),
      point(20, 57),
      point(32, 28),
      point(50, 48),
      point(68, 28),
      point(80, 57),
      point(50, 14),
    ],
  },
  {
    id: "tree_of_life",
    name: { en: "Tree of Life", zh: "生命之树" },
    positions: [
      "Kether",
      "Chokmah",
      "Binah",
      "Chesed",
      "Geburah",
      "Tiphareth",
      "Netzach",
      "Hod",
      "Yesod",
      "Malkuth",
    ],
    layout: [
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
  },
  {
    id: "astrological_houses",
    name: { en: "Astrological Houses", zh: "占星十二宫" },
    positions: Array.from({ length: 12 }, (_, index) => `House ${index + 1}`),
    layout: ring(12),
  },
  {
    id: "mandala",
    name: { en: "Mandala", zh: "曼陀罗" },
    positions: [
      "Core",
      "North",
      "Northeast",
      "East",
      "Southeast",
      "South",
      "Southwest",
      "West",
      "Northwest",
    ],
    layout: [point(50, 50), ...ring(8)],
  },
  {
    id: "pentagram",
    name: { en: "Pentagram", zh: "五芒星" },
    positions: ["Spirit", "Air", "Fire", "Earth", "Water"],
    layout: [
      point(50, 8),
      point(88, 40),
      point(74, 90),
      point(26, 90),
      point(12, 40),
    ],
  },
  {
    id: "mirror_of_truth",
    name: { en: "Mirror of Truth", zh: "真相之镜" },
    positions: ["Self", "Their Heart", "Truth", "Direction"],
    layout: [
      point(25, 28, -5),
      point(75, 28, 5),
      point(25, 72, 5),
      point(75, 72, -5),
    ],
  },
  {
    id: "daily_guidance",
    name: { en: "Daily Guidance", zh: "每日指引" },
    positions: ["Today's Guidance"],
    layout: [point(50, 50)],
  },
  {
    id: "yes_no",
    name: { en: "Yes / No", zh: "是否牌阵" },
    positions: ["Situation", "Influences", "Answer"],
    layout: [point(25, 62), point(50, 32), point(75, 62)],
  },
  {
    id: "weekly_forecast",
    name: { en: "Weekly Forecast", zh: "每周展望" },
    positions: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    layout: line(7),
  },
  {
    id: "new_moon_intentions",
    name: { en: "New Moon Intentions", zh: "新月意图" },
    positions: ["Energy", "Release", "Intention", "Manifest", "Outcome"],
    layout: [
      point(50, 50),
      point(20, 68),
      point(32, 20),
      point(68, 20),
      point(80, 68),
    ],
  },
  {
    id: "full_moon_release",
    name: { en: "Full Moon Release", zh: "满月释放" },
    positions: ["Manifested", "Release", "Blessings", "How", "Forward"],
    layout: [
      point(50, 14),
      point(18, 44),
      point(50, 50),
      point(82, 44),
      point(50, 86),
    ],
  },
  {
    id: "elemental_balance",
    name: { en: "Elemental Balance", zh: "元素平衡" },
    positions: ["Fire", "Water", "Air", "Earth"],
    layout: [point(50, 14), point(82, 50), point(18, 50), point(50, 86)],
  },
  {
    id: "past_life_karma",
    name: { en: "Past Life Karma", zh: "前世业力" },
    positions: [
      "Influence",
      "Lesson",
      "Debt",
      "Gifts",
      "Challenge",
      "Resolution",
    ],
    layout: [
      point(18, 72),
      point(34, 45),
      point(50, 18),
      point(66, 45),
      point(82, 72),
      point(50, 82),
    ],
  },
  {
    id: "compatibility",
    name: { en: "Compatibility", zh: "契合度牌阵" },
    positions: [
      "Person A",
      "Person B",
      "Attraction",
      "Challenges",
      "Communication",
      "Goals",
      "Growth",
      "Long Term",
    ],
    layout: [
      point(18, 22),
      point(82, 22),
      point(34, 44),
      point(66, 44),
      point(34, 68),
      point(66, 68),
      point(18, 88),
      point(82, 88),
    ],
  },
];

export const SPREAD_TEMPLATES: readonly SpreadTemplate[] =
  Object.freeze(templates);

export function getSpreadTemplate(id: string): SpreadTemplate | undefined {
  return SPREAD_TEMPLATES.find((spread) => spread.id === id);
}

export function layoutForSpread(id: string, cardCount: number): LayoutPoint[] {
  const template = getSpreadTemplate(id);
  if (template && template.layout.length === cardCount) {
    return template.layout;
  }
  return autoLayout(cardCount);
}
