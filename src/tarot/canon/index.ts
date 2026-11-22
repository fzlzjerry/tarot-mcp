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

interface GateCanonFile {
  knowledgeVersion: string;
  deckEdition: string;
  cards: Record<string, CanonCardEntry>;
}

const CANON_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "gate-cards.json",
);

const parsedCanon = JSON.parse(readFileSync(CANON_PATH, "utf8")) as GateCanonFile;

export const CANON_KNOWLEDGE_VERSION = parsedCanon.knowledgeVersion;
export const CANON_DECK_EDITION = parsedCanon.deckEdition;

const CANON_BY_ID: ReadonlyMap<string, CanonCardEntry> = new Map(
  Object.entries(parsedCanon.cards).map(([id, entry]) => [
    id.toLowerCase(),
    entry,
  ]),
);

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

function matchPositionRole(text: string): PositionRole | undefined {
  if (/(challenge|obstacle|cross|block|divid|friction|阻碍|挑战|障碍|冲突|分歧)/.test(text)) {
    return "challenge";
  }
  if (/(resource|strength|skill|talent|support|unite|asset|资源|优势|助力|支持|才能)/.test(text)) {
    return "resource";
  }
  if (/(action|step|next|approach|take|行动|举措|做法|下一步)/.test(text)) {
    return "action";
  }
  if (/(advice|guidance|recommend|建议|指引|劝告)/.test(text)) {
    return "advice";
  }
  if (/(outcome|future|potential|result|destin|结果|未来|走向|结局)/.test(text)) {
    return "outcome";
  }
  if (/(past|foundation|root|origin|过去|根基|起点|渊源)/.test(text)) {
    return "foundation";
  }
  if (/(hidden|subconscious|shadow|unseen|隐藏|潜意识|阴影|未知)/.test(text)) {
    return "hidden";
  }
  if (/(present|current|situation|现状|当下|目前|核心)/.test(text)) {
    return "present";
  }
  if (/(message|insight|theme|讯息|核心启示|主题)/.test(text)) {
    return "message";
  }
  return undefined;
}

/**
 * Fallback position role classifier for custom spreads or spreads whose
 * positions have not been explicitly tagged yet. Checks explicit position
 * names first so a description mentioning another role (e.g. "Likely Outcome"
 * described as "if you follow the advice given") never overrides the name.
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
