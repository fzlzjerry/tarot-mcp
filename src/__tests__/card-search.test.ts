import { TarotCardSearch } from "../tarot/cards/card-search.js";
import { validateSearchParams } from "../tarot/shared/validation.js";
import type { TarotCard } from "../tarot/shared/types.js";

function createCard(
  id: string,
  name: string,
  overrides: Partial<TarotCard> = {},
): TarotCard {
  return {
    id,
    name,
    arcana: "minor",
    suit: "wands",
    number: 1,
    keywords: {
      upright: ["focus"],
      reversed: ["delay"],
    },
    meanings: {
      upright: {
        general: "General upright meaning",
        love: "Love upright meaning",
        career: "Career upright meaning",
        health: "Health upright meaning",
        spirituality: "Spiritual upright meaning",
      },
      reversed: {
        general: "General reversed meaning",
        love: "Love reversed meaning",
        career: "Career reversed meaning",
        health: "Health reversed meaning",
        spirituality: "Spiritual reversed meaning",
      },
    },
    symbolism: ["symbol"],
    element: "fire",
    description: "A test tarot card",
    ...overrides,
  };
}

function createSearch(): TarotCardSearch {
  const cards: TarotCard[] = [
    createCard("the_fool", "The Fool", {
      arcana: "major",
      suit: undefined,
      number: 0,
      element: "air",
    }),
    ...Array.from({ length: 14 }, (_, index) =>
      createCard(`wand_${index + 1}`, `Wand ${index + 1}`, {
        number: index + 1,
      }),
    ),
    createCard("cup_1", "Cup 1", {
      suit: "cups",
      number: 1,
      element: "water",
    }),
  ];

  return new TarotCardSearch(cards);
}

describe("TarotCardSearch random draws", () => {
  let cardSearch: TarotCardSearch;

  beforeEach(() => {
    cardSearch = createSearch();
  });

  it("applies multiple random-card filters as an intersection", () => {
    const cards = cardSearch.getRandomCards(1, {
      arcana: "major",
      suit: "wands",
    });

    expect(cards).toHaveLength(0);
  });

  it("throws when requested cards exceed the filtered card pool", () => {
    expect(() => {
      cardSearch.getRandomCards(15, { suit: "wands" });
    }).toThrow("Cannot draw 15 cards from 14 matching cards");
  });

  it("uses the filtered intersection when checking draw limits", () => {
    expect(() => {
      cardSearch.getRandomCards(15, {
        arcana: "minor",
        suit: "wands",
      });
    }).toThrow("Cannot draw 15 cards from 14 matching cards");
  });
});

describe("search parameter validation", () => {
  it("allows card number 0 for The Fool", () => {
    const result = validateSearchParams({ number: 0 });

    expect(result.success).toBe(true);
    expect(result.data?.number).toBe(0);
  });
});

describe("TarotCardSearch search", () => {
  let cardSearch: TarotCardSearch;

  beforeEach(() => {
    cardSearch = createSearch();
  });

  it("finds The Fool by card number 0", () => {
    const results = cardSearch.search({ number: 0 });

    expect(results.map((result) => result.card.name)).toContain("The Fool");
  });
});
