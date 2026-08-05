import {
  assertCompleteVisualDeck,
  normalizeBeginPayload,
  normalizeConfirmedReading,
} from "../normalize.js";

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
});
