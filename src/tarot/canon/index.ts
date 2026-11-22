import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CardOrientation,
  Language,
  PositionRole,
  ReadingDomain,
} from "../shared/types.js";

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface LocalizedList {
  en: string[];
  zh: string[];
}

export interface CanonPromptSpec {
  lightingKey: string;
  suitAccent: string;
  scene: string;
  requiredObjects: Array<{ object: string; count: number }>;
  compositionNote: string;
  avoid: string[];
}

export interface CanonCardEntry {
  id: string;
  archetypeEssence: LocalizedText;
  traditionMotifs: LocalizedList;
  editionMotifs: LocalizedList;
  meaningBranches: {
    upright: {
      core: LocalizedText;
      byRole?: Partial<Record<PositionRole, LocalizedText>>;
      domains: Record<ReadingDomain, LocalizedText>;
    };
    reversed: {
      core: LocalizedText;
      lenses?: Partial<
        Record<"blocked" | "excess" | "internalized" | "release", LocalizedText>
      >;
      byRole?: Partial<Record<PositionRole, LocalizedText>>;
      domains: Record<ReadingDomain, LocalizedText>;
    };
  };
  promptSpec?: CanonPromptSpec;
}

const CANON_DATA_FILES = [
  "major.json",
  "wands.json",
  "cups.json",
  "swords.json",
  "pentacles.json",
] as const;

const CANON_DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "data",
);

export const CANON_KNOWLEDGE_VERSION = "canon-v2.1";
export const CANON_DECK_EDITION = "midnight-art-nouveau-v2";

const CANON_ENTRIES: Array<[string, CanonCardEntry]> = [];
for (const file of CANON_DATA_FILES) {
  const parsed = JSON.parse(
    readFileSync(join(CANON_DATA_DIR, file), "utf8"),
  ) as Record<string, CanonCardEntry>;
  for (const [id, entry] of Object.entries(parsed)) {
    CANON_ENTRIES.push([id.toLowerCase(), entry]);
  }
}

const CANON_BY_ID: ReadonlyMap<string, CanonCardEntry> = new Map(CANON_ENTRIES);

export function getCanonCard(cardId: string): CanonCardEntry | undefined {
  return CANON_BY_ID.get(cardId.toLowerCase());
}

export function getAllCanonCards(): ReadonlyMap<string, CanonCardEntry> {
  return CANON_BY_ID;
}

export function getCanonMeaning(
  cardId: string,
  orientation: CardOrientation,
  domain: ReadingDomain,
  positionRole: PositionRole | undefined,
  language: Language,
): string | undefined {
  const entry = getCanonCard(cardId);
  if (!entry) return undefined;
  const branch = entry.meaningBranches[orientation];
  const roleSpecific = positionRole ? branch.byRole?.[positionRole] : undefined;
  const domainSpecific = branch.domains[domain] ?? branch.domains.general;
  if (roleSpecific && domain !== "general") {
    return `${roleSpecific[language]} ${domainSpecific[language]}`;
  }
  if (roleSpecific) {
    return roleSpecific[language];
  }
  return domainSpecific?.[language] ?? branch.core[language];
}

export function getCanonMotifs(
  cardId: string,
  language: Language,
  deckVersion?: string,
): { tradition: string[]; edition: string[] } | undefined {
  const entry = getCanonCard(cardId);
  if (!entry) return undefined;
  return {
    tradition: [...entry.traditionMotifs[language]],
    edition:
      deckVersion === CANON_DECK_EDITION ? [...entry.editionMotifs[language]] : [],
  };
}

export function getCanonReversalLenses(
  cardId: string,
  language: Language,
): Partial<Record<"blocked" | "excess" | "internalized" | "release", string>> | undefined {
  const entry = getCanonCard(cardId);
  const lenses = entry?.meaningBranches.reversed.lenses;
  if (!lenses) return undefined;
  const out: Partial<
    Record<"blocked" | "excess" | "internalized" | "release", string>
  > = {};
  for (const key of ["blocked", "excess", "internalized", "release"] as const) {
    const val = lenses[key];
    if (val) out[key] = val[language];
  }
  return out;
}

/**
 * Ordered role patterns for positions that carry no explicit role (custom
 * spreads). English terms match at a word start so "represents" is not read
 * as "present" and "across" is not read as "cross". Order resolves overlaps:
 * a hopes-and-fears position mentions the outcome, and a hidden influence
 * mentions the present, so the more specific role is tested first.
 */
const POSITION_ROLE_PATTERNS: Array<[PositionRole, RegExp]> = [
  ["hopes_fears", /\b(hopes?|fears?|wish(es)?|worr(y|ies)|anxiet)|希望|期望|期待|恐惧|担忧|害怕|顾虑/],
  ["challenge", /\b(challeng|obstacle|cross(es|ing)?\b|block|divid|friction|conflict|difficult|struggl)|阻碍|挑战|障碍|冲突|分歧|难题|卡点/],
  ["hidden", /\b(hidden|subconscious|unconscious|shadow|unseen|secret|underlying|beneath)|隐藏|潜意识|阴影|未知|潜在|暗处/],
  ["external", /\b(external|environment|surroundings|outside|other people|others)\b|外部|外界|环境|周遭|他人的影响/],
  ["other", /\b(partner|the other (person|party|side)|other person|their (feelings?|perspective|intentions?|view|side|attitude|stance))\b|^(them|they|him|her)$|对方|伴侣|另一半|另一方|^[他她]$/],
  ["self", /\b(yourself|myself|querent|your (own )?(self|role|attitude|stance|perspective|part|feelings?|state))\b|^(you|me|self|i)$|自己|自我|本人|你的(态度|立场|状态|角色|感受)|^[你我]$/],
  ["resource", /\b(resource|strength|skill|talent|support|unit(e|es|ing)\b|asset|gift|ally|allies)|资源|优势|助力|支持|才能|天赋|长处/],
  ["advice", /\b(advice|advis|guidance|recommend|counsel)|建议|指引|劝告|忠告/],
  ["action", /\b(action|act\b|step|next\b|approach|what to do|do next)|行动|举措|做法|下一步|怎么做/],
  ["outcome", /\b(outcome|future|potential|result|destin|answer|where (it|this) (leads|goes))|结果|未来|走向|结局|答案/],
  ["foundation", /\b(past|foundation|root|origin|background|history|cause)|过去|根基|起点|渊源|根源|起因|背景/],
  ["present", /\b(present|current|situation|now\b|today)|现状|当下|目前|现在|处境/],
  ["message", /\b(message|insight|theme|lesson)|讯息|启示|主题|课题/],
];

function matchPositionRole(text: string): PositionRole | undefined {
  return POSITION_ROLE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}

/**
 * Fallback position role classifier for custom spreads, whose positions carry
 * no explicit role. Checks the position name first so a description that
 * mentions another role (e.g. "Likely Outcome" described as "if you follow the
 * advice given") never overrides the name.
 */
export function inferPositionRole(
  positionName = "",
  positionMeaning = "",
): PositionRole {
  return (
    matchPositionRole(positionName.toLowerCase()) ??
    matchPositionRole(positionMeaning.toLowerCase()) ??
    "general"
  );
}
