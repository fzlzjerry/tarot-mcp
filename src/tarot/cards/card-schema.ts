import type { TarotCard } from "../shared/types.js";

const ARCANA = new Set(["major", "minor"]);
const SUITS = new Set(["wands", "cups", "swords", "pentacles"]);
const ELEMENTS = new Set(["fire", "water", "air", "earth"]);
const REQUIRED_MEANING_FIELDS = [
  "general",
  "love",
  "career",
  "health",
  "spirituality",
] as const;
const REQUIRED_CARD_KEYS = [
  "id",
  "name",
  "arcana",
  "number",
  "keywords",
  "meanings",
  "symbolism",
  "element",
  "astrology",
  "numerology",
  "description",
] as const;

type Issue = {
  path: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(issues: Issue[], path: string, message: string): void {
  issues.push({ path, message });
}

function assertString(
  value: unknown,
  path: string,
  issues: Issue[],
): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, path, "Expected a non-empty string");
    return false;
  }
  if (value.trim() !== value) {
    addIssue(issues, path, "String must not have leading or trailing whitespace");
    return false;
  }
  return true;
}

function assertStringArray(
  value: unknown,
  path: string,
  issues: Issue[],
): value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, path, "Expected a non-empty string array");
    return false;
  }

  value.forEach((entry, index) => {
    assertString(entry, `${path}.${index}`, issues);
  });

  return true;
}

function validateMeanings(
  meanings: unknown,
  path: string,
  issues: Issue[],
): void {
  if (!isRecord(meanings)) {
    addIssue(issues, path, "Expected meanings object");
    return;
  }

  for (const orientation of ["upright", "reversed"] as const) {
    const orientationValue = meanings[orientation];
    if (!isRecord(orientationValue)) {
      addIssue(issues, `${path}.${orientation}`, "Expected orientation object");
      continue;
    }

    const allowedKeys = new Set(REQUIRED_MEANING_FIELDS);
    for (const key of Object.keys(orientationValue)) {
      if (!allowedKeys.has(key as (typeof REQUIRED_MEANING_FIELDS)[number])) {
        addIssue(issues, `${path}.${orientation}.${key}`, "Unknown meaning field");
      }
    }

    for (const field of REQUIRED_MEANING_FIELDS) {
      assertString(
        orientationValue[field],
        `${path}.${orientation}.${field}`,
        issues,
      );
    }
  }
}

function validateKeywords(
  keywords: unknown,
  path: string,
  issues: Issue[],
): void {
  if (!isRecord(keywords)) {
    addIssue(issues, path, "Expected keywords object");
    return;
  }

  const allowedKeys = new Set(["upright", "reversed"]);
  for (const key of Object.keys(keywords)) {
    if (!allowedKeys.has(key)) {
      addIssue(issues, `${path}.${key}`, "Unknown keyword orientation");
    }
  }

  assertStringArray(keywords.upright, `${path}.upright`, issues);
  assertStringArray(keywords.reversed, `${path}.reversed`, issues);
}

function validateCard(card: unknown, index: number, issues: Issue[]): void {
  const path = `cards.${index}`;
  if (!isRecord(card)) {
    addIssue(issues, path, "Expected card object");
    return;
  }

  const requiredKeys =
    card.arcana === "minor" ? [...REQUIRED_CARD_KEYS, "suit"] : REQUIRED_CARD_KEYS;
  const allowedKeys = new Set(requiredKeys);

  for (const key of Object.keys(card)) {
    if (!allowedKeys.has(key as (typeof requiredKeys)[number])) {
      addIssue(issues, `${path}.${key}`, "Unknown card field");
    }
  }

  for (const key of requiredKeys) {
    if (!(key in card)) {
      addIssue(issues, `${path}.${key}`, "Missing required card field");
    }
  }

  assertString(card.id, `${path}.id`, issues);
  if (typeof card.id === "string" && !/^[a-z0-9_]+$/.test(card.id)) {
    addIssue(issues, `${path}.id`, "Card id must be snake_case");
  }

  assertString(card.name, `${path}.name`, issues);

  if (typeof card.arcana !== "string" || !ARCANA.has(card.arcana)) {
    addIssue(issues, `${path}.arcana`, "Expected major or minor");
  }

  const numberValue = card.number;
  if (typeof numberValue !== "number" || !Number.isInteger(numberValue)) {
    addIssue(issues, `${path}.number`, "Expected integer card number");
  } else if (card.arcana === "major" && (numberValue < 0 || numberValue > 21)) {
    addIssue(issues, `${path}.number`, "Major Arcana number must be 0-21");
  } else if (card.arcana === "minor" && (numberValue < 1 || numberValue > 14)) {
    addIssue(issues, `${path}.number`, "Minor Arcana number must be 1-14");
  }

  if (card.arcana === "major" && "suit" in card) {
    addIssue(issues, `${path}.suit`, "Major Arcana cards must not define suit");
  }
  if (card.arcana === "minor" && (typeof card.suit !== "string" || !SUITS.has(card.suit))) {
    addIssue(issues, `${path}.suit`, "Minor Arcana cards must define a valid suit");
  }

  validateKeywords(card.keywords, `${path}.keywords`, issues);
  validateMeanings(card.meanings, `${path}.meanings`, issues);
  assertStringArray(card.symbolism, `${path}.symbolism`, issues);

  if (typeof card.element !== "string" || !ELEMENTS.has(card.element)) {
    addIssue(issues, `${path}.element`, "Expected a valid element");
  }
  assertString(card.astrology, `${path}.astrology`, issues);
  assertString(card.numerology, `${path}.numerology`, issues);
  assertString(card.description, `${path}.description`, issues);
}

export function parseCardData(data: unknown): TarotCard[] {
  const issues: Issue[] = [];

  if (!isRecord(data)) {
    throw new Error("Invalid tarot card data: root: Expected object");
  }

  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== "cards") {
    throw new Error("Invalid tarot card data: root: Expected only cards field");
  }

  if (!Array.isArray(data.cards)) {
    throw new Error("Invalid tarot card data: cards: Expected array");
  }
  if (data.cards.length !== 78) {
    addIssue(issues, "cards", "Expected exactly 78 cards");
  }

  data.cards.forEach((card, index) => validateCard(card, index, issues));

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  data.cards.forEach((card, index) => {
    const record = card as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : undefined;
    const name = typeof record.name === "string" ? record.name.toLowerCase() : undefined;
    if (id !== undefined) {
      if (seenIds.has(id)) {
        addIssue(issues, `cards[${index}].id`, `Duplicate card id "${id}"`);
      }
      seenIds.add(id);
    }
    if (name !== undefined) {
      if (seenNames.has(name)) {
        addIssue(issues, `cards[${index}].name`, `Duplicate card name "${record.name}"`);
      }
      seenNames.add(name);
    }
  });

  if (issues.length > 0) {
    const details = issues
      .slice(0, 5)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid tarot card data: ${details}`);
  }

  return data.cards as TarotCard[];
}
