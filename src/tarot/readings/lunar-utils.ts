/**
 * Moon phase calculations and lunar-related utilities for tarot readings
 */

import { Language } from "../shared/types.js";
import { pick } from "../shared/i18n.js";
import { TAROT_SPREADS, isValidSpreadType } from "./spreads.js";
import { localizedSpread } from "./spread-localizations.js";

export interface MoonPhaseInfo {
  phase: "new" | "waxing_crescent" | "first_quarter" | "waxing_gibbous" | "full" | "waning_gibbous" | "last_quarter" | "waning_crescent";
  illumination: number; // 0-1
  name: string;
  description: string;
  tarotThemes: string[];
  recommendedSpreads: string[];
}

const LUNAR_CYCLE_DAYS = 29.530588853; // Mean synodic month in days
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14); // Known new moon: 2000-01-06 18:14 UTC
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

// The 8 phase windows are centered on multiples of 1/8 of the cycle,
// so each window spans 1/16 of the cycle on either side of its center.
const PHASE_WINDOW_HALF_WIDTH = 1 / 16;

type MoonPhaseName = MoonPhaseInfo["phase"];

const PHASE_ORDER: MoonPhaseName[] = [
  "new",
  "waxing_crescent",
  "first_quarter",
  "waxing_gibbous",
  "full",
  "waning_gibbous",
  "last_quarter",
  "waning_crescent"
];

const PHASE_DATA: Record<MoonPhaseName, Omit<MoonPhaseInfo, "illumination">> = {
  new: {
    phase: "new",
    name: "New Moon",
    description: "The moon is not visible, representing new beginnings and fresh starts",
    tarotThemes: ["new beginnings", "intentions", "manifestation", "planting seeds", "inner reflection"],
    recommendedSpreads: ["new_moon_intentions", "single_card", "daily_guidance"]
  },
  waxing_crescent: {
    phase: "waxing_crescent",
    name: "Waxing Crescent",
    description: "A thin crescent appears, symbolizing growth and building energy",
    tarotThemes: ["growth", "building energy", "taking action", "momentum", "hope"],
    recommendedSpreads: ["three_card", "decision_making", "career_path"]
  },
  first_quarter: {
    phase: "first_quarter",
    name: "First Quarter",
    description: "Half the moon is illuminated, representing challenges and decisions",
    tarotThemes: ["challenges", "decisions", "perseverance", "action", "overcoming obstacles"],
    recommendedSpreads: ["decision_making", "horseshoe", "celtic_cross"]
  },
  waxing_gibbous: {
    phase: "waxing_gibbous",
    name: "Waxing Gibbous",
    description: "The moon is nearly full, representing refinement and adjustment",
    tarotThemes: ["refinement", "adjustment", "patience", "fine-tuning", "preparation"],
    recommendedSpreads: ["spiritual_guidance", "elemental_balance", "chakra_alignment"]
  },
  full: {
    phase: "full",
    name: "Full Moon",
    description: "The moon is fully illuminated, representing culmination and release",
    tarotThemes: ["culmination", "release", "manifestation", "completion", "heightened intuition"],
    recommendedSpreads: ["full_moon_release", "shadow_work", "mandala"]
  },
  waning_gibbous: {
    phase: "waning_gibbous",
    name: "Waning Gibbous",
    description: "The moon begins to wane, representing gratitude and sharing wisdom",
    tarotThemes: ["gratitude", "sharing wisdom", "teaching", "reflection", "giving back"],
    recommendedSpreads: ["spiritual_guidance", "tree_of_life", "past_life_karma"]
  },
  last_quarter: {
    phase: "last_quarter",
    name: "Last Quarter",
    description: "Half the moon is illuminated again, representing release and forgiveness",
    tarotThemes: ["release", "forgiveness", "letting go", "breaking patterns", "healing"],
    recommendedSpreads: ["shadow_work", "full_moon_release", "elemental_balance"]
  },
  waning_crescent: {
    phase: "waning_crescent",
    name: "Waning Crescent",
    description: "A thin crescent before the new moon, representing rest and preparation",
    tarotThemes: ["rest", "preparation", "introspection", "wisdom", "surrender"],
    recommendedSpreads: ["single_card", "daily_guidance", "spiritual_guidance"]
  }
};

/** Chinese localization of the moon phase catalog. */
const PHASE_DATA_ZH: Record<
  MoonPhaseName,
  { name: string; description: string; tarotThemes: string[] }
> = {
  new: {
    name: "新月",
    description: "月亮隐没不见，象征新的开始与全新起点",
    tarotThemes: ["新的开始", "设定意图", "显化", "播种", "内在反思"],
  },
  waxing_crescent: {
    name: "眉月",
    description: "一弯新芽初现，象征成长与逐渐积聚的能量",
    tarotThemes: ["成长", "积聚能量", "采取行动", "势头", "希望"],
  },
  first_quarter: {
    name: "上弦月",
    description: "月亮半明，象征挑战与抉择",
    tarotThemes: ["挑战", "抉择", "坚持", "行动", "克服障碍"],
  },
  waxing_gibbous: {
    name: "盈凸月",
    description: "月亮将满，象征精炼与调整",
    tarotThemes: ["精炼", "调整", "耐心", "微调", "准备"],
  },
  full: {
    name: "满月",
    description: "月亮全然明亮，象征圆满与释放",
    tarotThemes: ["圆满", "释放", "显化", "完成", "直觉高涨"],
  },
  waning_gibbous: {
    name: "亏凸月",
    description: "月亮开始亏缺，象征感恩与分享智慧",
    tarotThemes: ["感恩", "分享智慧", "传授", "反思", "回馈"],
  },
  last_quarter: {
    name: "下弦月",
    description: "月亮再度半明，象征放下与宽恕",
    tarotThemes: ["释放", "宽恕", "放下", "打破旧模式", "疗愈"],
  },
  waning_crescent: {
    name: "残月",
    description: "新月前的一弯残月，象征休憩与酝酿",
    tarotThemes: ["休息", "酝酿", "内省", "智慧", "臣服"],
  },
};

/**
 * Get the fractional position (0-1) within the lunar cycle for a date,
 * where 0 is a new moon and 0.5 is a full moon
 */
function getCyclePosition(date: Date): number {
  const daysSinceKnownNewMoon = (date.getTime() - KNOWN_NEW_MOON_UTC) / MILLISECONDS_PER_DAY;
  const cycles = daysSinceKnownNewMoon / LUNAR_CYCLE_DAYS;
  // Normalized modulo so dates before the reference new moon stay in [0, 1)
  return ((cycles % 1) + 1) % 1;
}

/**
 * Pick the phase whose window contains the given cycle position.
 * The "new" window wraps around the end of the cycle: [0.9375, 1) and [0, 0.0625)
 */
function getPhaseName(cyclePosition: number): MoonPhaseName {
  const index = Math.floor(((cyclePosition + PHASE_WINDOW_HALF_WIDTH) % 1) * PHASE_ORDER.length) % PHASE_ORDER.length;
  return PHASE_ORDER[index];
}

/**
 * Calculate the current moon phase based on a date
 * This is a simplified calculation - for production use, consider using a proper astronomical library
 */
export function calculateMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  const cyclePosition = getCyclePosition(date);
  // Illuminated fraction of the lunar disc, rounded to 2 decimals
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * cyclePosition)) / 2) * 100) / 100;

  return {
    ...PHASE_DATA[getPhaseName(cyclePosition)],
    illumination
  };
}

/**
 * Get the next significant moon phase
 */
export function getNextMoonPhase(currentDate: Date = new Date()): { phase: MoonPhaseInfo; date: Date } {
  const cyclePosition = getCyclePosition(currentDate);

  // Phase window boundaries sit at k/8 + 1/16; find the first one after the current position
  const nextBoundary = (Math.floor((cyclePosition - PHASE_WINDOW_HALF_WIDTH) * PHASE_ORDER.length) + 1) / PHASE_ORDER.length + PHASE_WINDOW_HALF_WIDTH;
  // Small nudge so the computed date lands inside the next window rather than on its edge
  const epsilonDays = 0.001;
  const daysUntilNextPhase = (nextBoundary - cyclePosition) * LUNAR_CYCLE_DAYS + epsilonDays;

  const nextDate = new Date(currentDate.getTime() + daysUntilNextPhase * MILLISECONDS_PER_DAY);
  const nextPhase = calculateMoonPhase(nextDate);

  return { phase: nextPhase, date: nextDate };
}

/**
 * Get moon phase recommendations for tarot practice
 */
export function getMoonPhaseRecommendations(
  date: Date = new Date(),
  language: Language = "en",
): string {
  const moonInfo = calculateMoonPhase(date);
  const zh = PHASE_DATA_ZH[moonInfo.phase];
  const phaseName = pick(language, moonInfo.name, zh.name);
  const description = pick(language, moonInfo.description, zh.description);
  const themes = language === "zh" ? zh.tarotThemes : moonInfo.tarotThemes;

  let recommendations = pick(
    language,
    `# 🌙 ${phaseName} Tarot Guidance\n\n`,
    `# 🌙 ${phaseName}塔罗指引\n\n`,
  );
  recommendations += `${pick(language, "**Current Phase:**", "**当前月相：**")} ${phaseName}\n`;
  recommendations += `${pick(language, "**Illumination:**", "**照亮度：**")} ${Math.round(moonInfo.illumination * 100)}%\n\n`;
  recommendations += `${pick(language, "**Description:**", "**描述：**")} ${description}\n\n`;

  recommendations += pick(
    language,
    `## Key Themes for This Phase:\n`,
    `## 本月相的关键主题：\n`,
  );
  themes.forEach(theme => {
    recommendations += `• ${theme}\n`;
  });

  recommendations += pick(
    language,
    `\n## Recommended Spreads:\n`,
    `\n## 推荐牌阵：\n`,
  );
  moonInfo.recommendedSpreads.forEach((spreadId) => {
    const name = isValidSpreadType(spreadId)
      ? localizedSpread(TAROT_SPREADS[spreadId], spreadId, language).name
      : spreadId;
    recommendations += `• ${name}\n`;
  });

  const next = getNextMoonPhase(date);
  const nextName = pick(language, next.phase.name, PHASE_DATA_ZH[next.phase.phase].name);
  const nextDate = next.date.toISOString().slice(0, 10);
  recommendations += pick(
    language,
    `\n**Next Phase:** ${nextName} (approximately ${nextDate})\n`,
    `\n**下一个月相：** ${nextName}（约 ${nextDate}）\n`,
  );

  return recommendations;
}

