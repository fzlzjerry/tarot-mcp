import {
  assertCompleteVisualDeck,
  extractError,
  normalizeBeginPayload,
  normalizeConfirmedReading,
  normalizeDeckCatalog,
} from "../normalize.js";

describe("draw error normalization", () => {
  it("preserves error identity and explicit machine metadata across transports", () => {
    const original = Object.assign(new TypeError("Network disconnected"), {
      code: "TRANSPORT_LOST",
    });
    expect(extractError(original, "fallback")).toBe(original);
    expect(
      extractError(
        { code: "DRAW_EXPIRED", error: "Deck unavailable" },
        "fallback",
        410,
      ),
    ).toMatchObject({
      code: "DRAW_EXPIRED",
      httpStatus: 410,
      message: "Deck unavailable",
    });
    expect(
      extractError(
        {
          isError: true,
          content: [{ type: "text", text: "Conflict" }],
          _meta: {
            tarotError: { code: "DRAW_ALREADY_CONFIRMED", httpStatus: 409 },
          },
        },
        "fallback",
      ),
    ).toMatchObject({ code: "DRAW_ALREADY_CONFIRMED", httpStatus: 409 });
    expect(extractError({}, "fallback", 401)).toMatchObject({
      httpStatus: 401,
    });
  });
});

describe("visual draw payload normalization", () => {
  it("combines structured content with the MCP-only visual deck metadata", () => {
    const slots = Array.from({ length: 78 }, (_, order) => ({
      slotId: `opaque-${order}`,
      order,
    }));
    const payload = normalizeBeginPayload(
      {
        structuredContent: {
          drawId: "draw_1",
          readingKind: "spread",
          spreadType: "three_card",
          requiredCardCount: 3,
          spread: {
            positions: [
              { name: "Past" },
              { name: "Present" },
              { name: "Future" },
            ],
          },
        },
        _meta: {
          visualDeck: {
            slots,
            backImage: { mimeType: "image/webp", data: "YmFjaw==" },
          },
        },
      },
      {
        readingKind: "spread",
        spreadType: "three_card",
        question: "What next?",
        language: "en",
      },
    );
    expect(payload.drawId).toBe("draw_1");
    expect(payload.requiredCount).toBe(3);
    expect(payload.slots).toHaveLength(78);
    expect(payload.slots[0].slotId).toBe("opaque-0");
    expect(payload.deckBackImageUri).toBe("data:image/webp;base64,YmFjaw==");
    expect(() => assertCompleteVisualDeck(payload)).not.toThrow();
  });

  it("does not invent selectable slots when MCP metadata is absent", () => {
    const payload = normalizeBeginPayload({
      structuredContent: { drawId: "draw_2" },
    });
    expect(payload.slots).toEqual([]);
    expect(() => assertCompleteVisualDeck(payload)).toThrow(
      /78 opaque card slots/,
    );
  });

  it("normalizes Web imageUri and MCP embedded card images without preferring legacy fields", () => {
    const reading = normalizeConfirmedReading({
      structuredContent: {
        spreadType: "single_card",
        cards: [
          {
            cardId: "fool",
            name: "The Fool",
            displayName: "愚者",
            orientation: "reversed",
            imageUri: "/assets/cards/midnight-art-nouveau-v1/fool.webp",
            imageResourceUri: "tarot://legacy/fool",
          },
        ],
      },
      _meta: {
        backImage: { mimeType: "image/webp", data: "YmFjaw==" },
        cardImages: {
          fool: { mimeType: "image/webp", data: "ZmFjZQ==" },
        },
      },
    });
    expect(reading.cards[0]).toMatchObject({
      id: "fool",
      displayName: "愚者",
      orientation: "reversed",
      imageUri: "/assets/cards/midnight-art-nouveau-v1/fool.webp",
      embeddedImage: { mimeType: "image/webp", data: "ZmFjZQ==" },
    });
    expect(reading.deckBackImageUri).toBe("data:image/webp;base64,YmFjaw==");
  });

  it("keeps the server's reading guide with one prompt per card, in card order", () => {
    const card = { cardId: "fool", name: "The Fool" };
    const reading = normalizeConfirmedReading({
      structuredContent: {
        spreadType: "three_card",
        cards: [card, { ...card, cardId: "world" }],
        guide: {
          version: "guide-v1",
          steps: ["Restate the question.", 2, ""],
          positionPrompts: [
            { positionIndex: 1, positionRole: "present", prompt: "What now?" },
            "malformed",
          ],
          guardrails: ["Describe tendencies, never fixed fates."],
        },
      },
    });
    expect(reading.guide).toEqual({
      steps: ["Restate the question."],
      prompts: ["What now?", ""],
      guardrails: ["Describe tendencies, never fixed fates."],
    });
    expect(
      normalizeConfirmedReading({
        structuredContent: { cards: [card], guide: { steps: [] } },
      }).guide,
    ).toBeUndefined();
  });

  it("keeps each guide prompt with its own card when an earlier card is dropped", () => {
    const reading = normalizeConfirmedReading({
      structuredContent: {
        spreadType: "three_card",
        cards: [
          { cardId: "fool", name: "The Fool", position: "Past" },
          "malformed",
          { cardId: "world", name: "The World", position: "Future" },
        ],
        guide: {
          steps: ["Restate the question."],
          positionPrompts: [
            { positionIndex: 1, prompt: "Ask of the past." },
            { positionIndex: 2, prompt: "Ask of the present." },
            { positionIndex: 3, prompt: "Ask of the future." },
          ],
          guardrails: [],
        },
      },
    });
    expect(reading.cards.map(({ position }) => position)).toEqual([
      "Past",
      "Future",
    ]);
    expect(reading.guide?.prompts).toEqual([
      "Ask of the past.",
      "Ask of the future.",
    ]);
  });
});

describe("deck catalog normalization", () => {
  const star = {
    id: "star",
    name: "The Star",
    displayName: "星星",
    arcana: "major",
    number: 17,
    keywords: { upright: ["希望", "疗愈"], reversed: ["怀疑"] },
  };

  it("reads the same catalog from the REST body and from the tool result", () => {
    const expected = [
      {
        id: "star",
        name: "The Star",
        displayName: "星星",
        arcana: "major",
        number: 17,
        keywords: { upright: ["希望", "疗愈"], reversed: ["怀疑"] },
      },
    ];
    expect(
      normalizeDeckCatalog({
        cards: "# 塔罗牌",
        structured: { cards: [star] },
      }),
    ).toEqual(expected);
    expect(
      normalizeDeckCatalog({
        content: [{ type: "text", text: "# 塔罗牌" }],
        structuredContent: { total: 1, cards: [star] },
      }),
    ).toEqual(expected);
  });

  it("keeps what can be shown and drops rows that cannot be found", () => {
    expect(
      normalizeDeckCatalog({
        cards: [
          { id: "ace_of_cups", name: "Ace of Cups", suit: "cups", number: 1 },
          { id: "odd", name: "Odd", suit: "coins", keywords: { upright: [7] } },
          { name: "No id" },
          { id: "no_name" },
          "fool",
        ],
      }),
    ).toEqual([
      {
        id: "ace_of_cups",
        name: "Ace of Cups",
        displayName: "Ace of Cups",
        arcana: "minor",
        suit: "cups",
        number: 1,
        keywords: { upright: [], reversed: [] },
      },
      {
        id: "odd",
        name: "Odd",
        displayName: "Odd",
        arcana: "minor",
        keywords: { upright: [], reversed: [] },
      },
    ]);
  });

  it("treats a catalog with nothing usable as a failure, not an empty deck", () => {
    expect(() => normalizeDeckCatalog({ cards: [] })).toThrow();
    expect(() => normalizeDeckCatalog({ cards: "# Tarot Cards" })).toThrow();
    expect(() => normalizeDeckCatalog(undefined)).toThrow();
  });
});
