import type { Language } from "../../shared/types.js";

/**
 * Themes of the Minor Arcana pip ranks 1-10, also used for the root number a
 * Major Arcana card reduces to. Court ranks (11-14) are a separate table so
 * Justice (11) never collides with a Page (11).
 */
const PIP_THEMES: Record<number, { en: string; zh: string }> = {
  1: { en: "new beginnings and raw potential", zh: "全新起点与原始潜能" },
  2: { en: "balance, choice, and partnership", zh: "平衡、抉择与合作关系" },
  3: { en: "growth, synthesis, and collaboration", zh: "成长、整合与协作推进" },
  4: {
    en: "stability, structure, and consolidation",
    zh: "稳固、结构与根基夯实",
  },
  5: { en: "friction, change, and adaptation", zh: "摩擦、变动与调适考验" },
  6: { en: "reciprocity, harmony, and adjustment", zh: "互惠、调和与重新校准" },
  7: {
    en: "assessment, perseverance, and inner testing",
    zh: "审视、耐力与内在试炼",
  },
  8: {
    en: "momentum, mastery, and focused effort",
    zh: "推进、精进与专注发力",
  },
  9: {
    en: "near-completion, resilience, and reflection",
    zh: "临近收尾、韧性与沉淀",
  },
  10: {
    en: "culmination, saturation, and cycle transitions",
    zh: "阶段顶点、饱和与周期转换",
  },
};

const COURT_THEMES: Record<number, { en: string; zh: string }> = {
  11: { en: "messages and fresh perspectives", zh: "新讯息与新鲜视角" },
  12: { en: "movement and decisive action", zh: "推进节奏与果断行动" },
  13: { en: "emotional depth and mastery", zh: "内在定力与成熟掌控" },
  14: { en: "leadership and command", zh: "领导担当与全局统筹" },
};

export function pipTheme(rank: number, language: Language): string | undefined {
  return PIP_THEMES[rank]?.[language];
}

export function courtTheme(
  rank: number,
  language: Language,
): string | undefined {
  return COURT_THEMES[rank]?.[language];
}

/**
 * Root number of a Major Arcana card: its digits summed until one digit is
 * left (XIII → 4, XIX → 1). The Fool (0) has no root.
 */
export function majorRootNumber(number: number): number | undefined {
  if (number <= 0) return undefined;
  let root = number;
  while (root > 9) {
    root = String(root)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return root;
}
