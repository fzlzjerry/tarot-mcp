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

/**
 * Calculate the current moon phase based on a date
 * This is a simplified calculation - for production use, consider using a proper astronomical library
 */
export function calculateMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  // Simplified lunar cycle calculation
  // Real implementation would use astronomical calculations
  const lunarCycle = 29.53; // Average lunar cycle in days
  const knownNewMoon = new Date('2024-01-11'); // A known new moon date
  
  const daysSinceKnownNewMoon = Math.floor((date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24));
  const cyclePosition = (daysSinceKnownNewMoon % lunarCycle) / lunarCycle;
  
  if (cyclePosition < 0.0625) {
    return {
      phase: "new",
      illumination: 0,
      name: "New Moon",
      description: "The moon is not visible, representing new beginnings and fresh starts",
      tarotThemes: ["new beginnings", "intentions", "manifestation", "planting seeds", "inner reflection"],
      recommendedSpreads: ["new_moon_intentions", "single_card", "daily_guidance"]
    };
  } else if (cyclePosition < 0.1875) {
    return {
      phase: "waxing_crescent",
      illumination: 0.25,
      name: "Waxing Crescent",
      description: "A thin crescent appears, symbolizing growth and building energy",
      tarotThemes: ["growth", "building energy", "taking action", "momentum", "hope"],
      recommendedSpreads: ["three_card", "decision_making", "career_path"]
    };
  } else if (cyclePosition < 0.3125) {
    return {
      phase: "first_quarter",
      illumination: 0.5,
      name: "First Quarter",
      description: "Half the moon is illuminated, representing challenges and decisions",
      tarotThemes: ["challenges", "decisions", "perseverance", "action", "overcoming obstacles"],
      recommendedSpreads: ["decision_making", "horseshoe", "celtic_cross"]
    };
  } else if (cyclePosition < 0.4375) {
    return {
      phase: "waxing_gibbous",
      illumination: 0.75,
      name: "Waxing Gibbous",
      description: "The moon is nearly full, representing refinement and adjustment",
      tarotThemes: ["refinement", "adjustment", "patience", "fine-tuning", "preparation"],
      recommendedSpreads: ["spiritual_guidance", "elemental_balance", "chakra_alignment"]
    };
  } else if (cyclePosition < 0.5625) {
    return {
      phase: "full",
      illumination: 1,
      name: "Full Moon",
      description: "The moon is fully illuminated, representing culmination and release",
      tarotThemes: ["culmination", "release", "manifestation", "completion", "heightened intuition"],
      recommendedSpreads: ["full_moon_release", "shadow_work", "mandala"]
    };
  } else if (cyclePosition < 0.6875) {
    return {
      phase: "waning_gibbous",
      illumination: 0.75,
      name: "Waning Gibbous",
      description: "The moon begins to wane, representing gratitude and sharing wisdom",
      tarotThemes: ["gratitude", "sharing wisdom", "teaching", "reflection", "giving back"],
      recommendedSpreads: ["spiritual_guidance", "tree_of_life", "past_life_karma"]
    };
  } else if (cyclePosition < 0.8125) {
    return {
      phase: "last_quarter",
      illumination: 0.5,
      name: "Last Quarter",
      description: "Half the moon is illuminated again, representing release and forgiveness",
      tarotThemes: ["release", "forgiveness", "letting go", "breaking patterns", "healing"],
      recommendedSpreads: ["shadow_work", "healing_spread", "elemental_balance"]
    };
  } else {
    return {
      phase: "waning_crescent",
      illumination: 0.25,
      name: "Waning Crescent",
      description: "A thin crescent before the new moon, representing rest and preparation",
      tarotThemes: ["rest", "preparation", "introspection", "wisdom", "surrender"],
      recommendedSpreads: ["single_card", "daily_guidance", "spiritual_guidance"]
    };
  }
}

/**
 * Get the next significant moon phase
 */
export function getNextMoonPhase(currentDate: Date = new Date()): { phase: MoonPhaseInfo; date: Date } {
  const current = calculateMoonPhase(currentDate);
  const nextDate = new Date(currentDate);
  
  // Simplified - add approximately 7 days to get to next major phase
  nextDate.setDate(nextDate.getDate() + 7);
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
