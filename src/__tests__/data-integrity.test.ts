import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TAROT_SPREADS } from "../tarot/readings/spreads.js";
import { SPREAD_TYPES } from "../tarot/shared/types.js";
import {
  BANNED_LEGACY_KEYWORDS_BY_CARD,
  CANONICAL_CARD_MANIFEST,
  MODERN_RWS_CARD_ANCHORS,
} from "./modern-rws-fixtures.js";

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

const REQUIRED_MEANING_FIELDS = [
  "general",
  "love",
  "career",
  "health",
  "spirituality",
] as const;

function orientationText(card: any, orientation: "upright" | "reversed"): string {
  return [
    ...card.keywords[orientation],
    ...Object.values(card.meanings[orientation]),
  ]
    .join(" ")
    .toLowerCase();
}

describe("tarot card data integrity", () => {
  let cardManager: TarotCardManager;

  beforeAll(async () => {
    cardManager = await TarotCardManager.create();
  });

  it("matches the canonical modern Rider-Waite-Smith deck order", () => {
    const manifest = cardManager.getAllCards().map((card) => ({
      id: card.id,
      name: card.name,
      arcana: card.arcana,
      number: card.number,
      ...(card.suit === undefined ? {} : { suit: card.suit }),
    }));

    expect(manifest).toEqual(CANONICAL_CARD_MANIFEST);
  });

  it("keeps every card schema strict and meaning-rich", () => {
    for (const card of cardManager.getAllCards()) {
      expect(Object.keys(card).sort()).toEqual(
        (card.arcana === "major"
          ? REQUIRED_CARD_KEYS
          : [...REQUIRED_CARD_KEYS, "suit"]
        ).sort(),
      );

      expect(card.id).toMatch(/^[a-z0-9_]+$/);
      expect(card.name.trim()).toBe(card.name);
      expect(card.description.length).toBeGreaterThanOrEqual(80);
      expect(card.symbolism.length).toBeGreaterThanOrEqual(4);

      for (const symbol of card.symbolism) {
        expect(symbol.trim()).toBe(symbol);
        expect(symbol.length).toBeGreaterThan(0);
      }

      for (const orientation of ["upright", "reversed"] as const) {
        expect(card.keywords[orientation].length).toBeGreaterThanOrEqual(5);
        expect(new Set(card.keywords[orientation]).size).toBe(
          card.keywords[orientation].length,
        );
        for (const keyword of card.keywords[orientation]) {
          expect(keyword.trim()).toBe(keyword);
          expect(keyword.length).toBeGreaterThan(0);
        }

        for (const field of REQUIRED_MEANING_FIELDS) {
          expect(card.meanings[orientation][field].length).toBeGreaterThanOrEqual(
            60,
          );
        }
      }
    }
  });

  it("anchors each card in modern RWS meanings within the matching orientation", () => {
    const cardsById = new Map(
      cardManager.getAllCards().map((card) => [card.id, card]),
    );

    expect([...cardsById.keys()].sort()).toEqual(
      Object.keys(MODERN_RWS_CARD_ANCHORS).sort(),
    );

    for (const [cardId, anchorsByOrientation] of Object.entries(
      MODERN_RWS_CARD_ANCHORS,
    )) {
      const card = cardsById.get(cardId);
      expect(card).toBeDefined();

      for (const orientation of ["upright", "reversed"] as const) {
        const text = orientationText(card!, orientation);
        for (const anchor of anchorsByOrientation[orientation]) {
          expect(text).toContain(anchor.toLowerCase());
        }
      }
    }
  });

  it("does not expose legacy Waite-only terms as modern primary keywords", () => {
    const cardsById = new Map(
      cardManager.getAllCards().map((card) => [card.id, card]),
    );

    for (const { id, keyword } of BANNED_LEGACY_KEYWORDS_BY_CARD) {
      const card = cardsById.get(id);
      expect(card).toBeDefined();
      const keywords = [...card!.keywords.upright, ...card!.keywords.reversed]
        .join(" ")
        .toLowerCase();

      expect(keywords).not.toContain(keyword);
    }
  });

  it("keeps selected minor-card iconography grounded in the actual card image", () => {
    const cardsById = new Map(
      cardManager.getAllCards().map((card) => [card.id, card]),
    );

    const twoOfWands = [
      cardsById.get("two_of_wands")!.description,
      ...cardsById.get("two_of_wands")!.symbolism,
    ]
      .join(" ")
      .toLowerCase();
    expect(twoOfWands).toContain("two");
    expect(twoOfWands).toContain("wand");
    expect(twoOfWands).toContain("globe");

    const threeOfPentacles = [
      cardsById.get("three_of_pentacles")!.description,
      ...cardsById.get("three_of_pentacles")!.symbolism,
    ]
      .join(" ")
      .toLowerCase();
    expect(threeOfPentacles).toContain("three");
    expect(threeOfPentacles).toContain("pentacle");
    expect(threeOfPentacles).toContain("arch");

    const fiveOfPentacles = [
      cardsById.get("five_of_pentacles")!.description,
      ...cardsById.get("five_of_pentacles")!.symbolism,
    ]
      .join(" ")
      .toLowerCase();
    expect(fiveOfPentacles).toContain("five");
    expect(fiveOfPentacles).toContain("pentacle");
    expect(fiveOfPentacles).toContain("snow");
  });
});

describe("spread type registry consistency", () => {
  it("keeps SPREAD_TYPES in sync with the TAROT_SPREADS registry", () => {
    expect([...SPREAD_TYPES].sort()).toEqual(Object.keys(TAROT_SPREADS).sort());
  });
});
