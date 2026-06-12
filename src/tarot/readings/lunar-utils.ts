/**
 * Moon phase calculations and lunar-related utilities for tarot readings
 */

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
export function getMoonPhaseRecommendations(date: Date = new Date()): string {
  const moonInfo = calculateMoonPhase(date);
  
  let recommendations = `# 🌙 ${moonInfo.name} Tarot Guidance\n\n`;
  recommendations += `**Current Phase:** ${moonInfo.name}\n`;
  recommendations += `**Illumination:** ${Math.round(moonInfo.illumination * 100)}%\n\n`;
  recommendations += `**Description:** ${moonInfo.description}\n\n`;
  
  recommendations += `## Key Themes for This Phase:\n`;
  moonInfo.tarotThemes.forEach(theme => {
    recommendations += `• ${theme}\n`;
  });
  
  recommendations += `\n## Recommended Spreads:\n`;
  moonInfo.recommendedSpreads.forEach(spread => {
    recommendations += `• ${spread.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
  });
  
  const next = getNextMoonPhase(date);
  recommendations += `\n**Next Phase:** ${next.phase.name} (approximately ${next.date.toLocaleDateString()})\n`;
  
  return recommendations;
}

/**
 * Determine if a date is during a significant moon phase for enhanced readings
 */
export function isSignificantMoonPhase(date: Date = new Date()): boolean {
  const moonInfo = calculateMoonPhase(date);
  return moonInfo.phase === "new" || moonInfo.phase === "full";
}

/**
 * Get seasonal information for enhanced readings
 */
export function getSeasonalInfo(date: Date = new Date()): {
  season: "spring" | "summer" | "autumn" | "winter";
  themes: string[];
  recommendedSpreads: string[];
} {
  const month = date.getMonth(); // 0-11
  
  if (month >= 2 && month <= 4) { // March, April, May
    return {
      season: "spring",
      themes: ["new growth", "renewal", "fresh starts", "fertility", "awakening"],
      recommendedSpreads: ["new_moon_intentions", "three_card", "career_path"]
    };
  } else if (month >= 5 && month <= 7) { // June, July, August
    return {
      season: "summer",
      themes: ["abundance", "energy", "action", "manifestation", "vitality"],
      recommendedSpreads: ["full_moon_release", "elemental_balance", "venus_love"]
    };
  } else if (month >= 8 && month <= 10) { // September, October, November
    return {
      season: "autumn",
      themes: ["harvest", "gratitude", "release", "preparation", "wisdom"],
      recommendedSpreads: ["shadow_work", "past_life_karma", "spiritual_guidance"]
    };
  } else { // December, January, February
    return {
      season: "winter",
      themes: ["introspection", "rest", "inner work", "reflection", "planning"],
      recommendedSpreads: ["tree_of_life", "year_ahead", "chakra_alignment"]
    };
  }
}
