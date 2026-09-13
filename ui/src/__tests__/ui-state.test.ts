import type {
  BeginReadingPayload,
  ConfirmedReading,
  TarotUiSnapshot,
} from "../types.js";
import { restoreUiSnapshot } from "../ui-state.js";

function beginPayload(): BeginReadingPayload {
  return {
    drawId: "draw-one",
    readingKind: "spread",
    spreadType: "two_card",
    spreadName: "Two cards",
    question: "What matters now?",
    language: "en",
    requiredCount: 2,
    slots: Array.from({ length: 78 }, (_, index) => ({
      slotId: `slot-${index}`,
      index,
    })),
  };
}

function confirmedReading(): ConfirmedReading {
  return {
    drawId: "draw-one",
    readingId: "reading-one",
    spreadType: "two_card",
    spreadName: "Two cards",
    question: "What matters now?",
    language: "en",
    cards: [
      {
        id: "fool",
        name: "The Fool",
        displayName: "The Fool",
        orientation: "upright",
        position: "Now",
      },
      {
        id: "world",
        name: "The World",
        displayName: "The World",
        orientation: "reversed",
        position: "Next",
      },
    ],
  };
}

function snapshot(): TarotUiSnapshot {
  return {
    version: 1,
    drawId: "draw-one",
    deckOrder: beginPayload()
      .slots.map((slot) => slot.slotId)
      .reverse(),
    selectedSlotIds: ["slot-12", "slot-4"],
    confirmedReading: confirmedReading(),
    revealedIndices: [1],
    continuationSent: false,
  };
}

describe("private UI checkpoint validation", () => {
  it("restores a pending selection only against its exact authoritative deck", () => {
    const pending = {
      ...snapshot(),
      confirmedReading: undefined,
      revealedIndices: [],
    };
    const restored = restoreUiSnapshot(pending, beginPayload());
    expect(restored).toEqual(pending);
    expect(
      restoreUiSnapshot(pending, { ...beginPayload(), drawId: "another-draw" }),
    ).toBeUndefined();
    const foreignDeck = beginPayload();
    foreignDeck.slots[0]!.slotId = "foreign-slot";
    expect(restoreUiSnapshot(pending, foreignDeck)).toBeUndefined();
  });

  it("restores a frozen submission and only its machine-readable failure metadata", () => {
    const pending = {
      ...snapshot(),
      confirmedReading: undefined,
      revealedIndices: [],
      pendingConfirmation: {
        selectedSlotIds: ["slot-12", "slot-4"],
        failure: {
          code: "DRAW_EXPIRED",
          httpStatus: 410,
          message: "private-transport-detail",
          token: "private-token",
        },
      },
    };
    const restored = restoreUiSnapshot(pending, beginPayload());
    expect(restored?.pendingConfirmation).toEqual({
      selectedSlotIds: ["slot-12", "slot-4"],
      failure: { code: "DRAW_EXPIRED", httpStatus: 410 },
    });
    expect(JSON.stringify(restored)).not.toMatch(
      /private-transport-detail|private-token/,
    );
    const confirmed = restoreUiSnapshot(pending, confirmedReading());
    expect(confirmed?.confirmedReading?.readingId).toBe("reading-one");
    expect(confirmed?.pendingConfirmation).toBeUndefined();
  });

  it("rejects frozen selections that differ from the displayed order or required count", () => {
    const pending = {
      ...snapshot(),
      confirmedReading: undefined,
      revealedIndices: [],
    };
    for (const selectedSlotIds of [
      ["slot-12"],
      ["slot-4", "slot-12"],
      ["slot-12", "foreign"],
      ["slot-12", "slot-12"],
    ]) {
      expect(
        restoreUiSnapshot(
          { ...pending, pendingConfirmation: { selectedSlotIds } },
          beginPayload(),
        ),
      ).toBeUndefined();
    }
    expect(
      restoreUiSnapshot(
        {
          ...pending,
          pendingConfirmation: {
            selectedSlotIds: pending.selectedSlotIds,
            failure: { httpStatus: "410" },
          },
        },
        beginPayload(),
      ),
    ).toBeUndefined();
  });

  it.each([
    { name: "unsupported version", patch: { version: 2 } },
    { name: "short deck", patch: { deckOrder: ["slot-0"] } },
    { name: "duplicated deck", patch: { deckOrder: Array(78).fill("slot-0") } },
    {
      name: "non-string slot",
      patch: { deckOrder: [...snapshot().deckOrder.slice(1), 7] },
    },
    {
      name: "duplicate selection",
      patch: { selectedSlotIds: ["slot-0", "slot-0"] },
    },
    {
      name: "foreign selection",
      patch: { selectedSlotIds: ["slot-0", "foreign"] },
    },
    {
      name: "overfull selection",
      patch: { selectedSlotIds: ["slot-0", "slot-1", "slot-2"] },
    },
    { name: "duplicate reveals", patch: { revealedIndices: [0, 0] } },
    { name: "sparse deck", patch: { deckOrder: Array(78) } },
    { name: "sparse reveal", patch: { revealedIndices: Array(1) } },
    { name: "out-of-range reveal", patch: { revealedIndices: [2] } },
    { name: "fractional reveal", patch: { revealedIndices: [0.5] } },
    { name: "unconfirmed reveal", patch: { confirmedReading: undefined } },
    { name: "unrevealed continuation", patch: { continuationSent: true } },
    { name: "nonboolean continuation", patch: { continuationSent: "true" } },
  ])("rejects $name rather than partially restoring it", ({ patch }) => {
    expect(
      restoreUiSnapshot({ ...snapshot(), ...patch }, beginPayload()),
    ).toBeUndefined();
  });

  it("projects semantic reading fields and never retains injected private or artwork fields", () => {
    const saved = snapshot();
    Object.assign(saved, { token: "private-token" });
    Object.assign(saved.confirmedReading!, {
      deckBackImageUri: "data:image/private-back",
      token: "private-token",
      selectedSlotIds: ["hidden-slot"],
    });
    Object.assign(saved.confirmedReading!.cards[0]!, {
      imageUri: "private-art",
      embeddedImage: { mimeType: "image/webp", data: "private-bytes" },
      token: "private-token",
      slotId: "hidden-slot",
    });
    const restored = restoreUiSnapshot(saved, beginPayload())!;
    expect(restored.confirmedReading).toMatchObject(confirmedReading());
    expect(JSON.stringify(restored)).not.toMatch(
      /private-token|private-art|private-bytes|private-back|hidden-slot|imageUri|embeddedImage/,
    );
    expect(restored.selectedSlotIds).toEqual(["slot-12", "slot-4"]);
    expect(restored.revealedIndices).toEqual([1]);
  });

  it("rejects malformed confirmed readings and incomplete confirmed selections", () => {
    const saved = snapshot();
    const reading = confirmedReading();
    const invalidReadings = [
      { ...reading, drawId: "foreign" },
      { ...reading, language: "invalid" },
      { ...reading, spreadName: null },
      { ...reading, cards: reading.cards.slice(1) },
      {
        ...reading,
        cards: [
          { ...reading.cards[0], orientation: "sideways" },
          reading.cards[1],
        ],
      },
      {
        ...reading,
        cards: [{ ...reading.cards[0], id: "" }, reading.cards[1]],
      },
      {
        ...reading,
        cards: [{ ...reading.cards[0], displayName: 42 }, reading.cards[1]],
      },
      {
        ...reading,
        cards: [{ ...reading.cards[0], keywords: [42] }, reading.cards[1]],
      },
    ];
    for (const confirmedReading of invalidReadings) {
      expect(
        restoreUiSnapshot({ ...saved, confirmedReading }, beginPayload()),
      ).toBeUndefined();
    }
    expect(
      restoreUiSnapshot(
        { ...saved, selectedSlotIds: ["slot-12"] },
        beginPayload(),
      ),
    ).toBeUndefined();
  });

  it("prefers authoritative confirmed content but rejects incompatible reading identity or ordering", () => {
    const authoritative = {
      ...confirmedReading(),
      interpretation: "Latest authoritative interpretation",
    };
    const saved = {
      ...snapshot(),
      revealedIndices: [1, 0],
      continuationSent: true,
    };
    const restored = restoreUiSnapshot(saved, authoritative)!;
    expect(restored.confirmedReading?.interpretation).toBe(
      authoritative.interpretation,
    );
    expect(restored.continuationSent).toBe(true);
    expect(
      restoreUiSnapshot(saved, { ...authoritative, readingId: "different" }),
    ).toBeUndefined();
    expect(
      restoreUiSnapshot(saved, {
        ...authoritative,
        cards: [...authoritative.cards].reverse(),
      }),
    ).toBeUndefined();
    expect(
      restoreUiSnapshot(saved, {
        ...authoritative,
        cards: [
          { ...authoritative.cards[0]!, orientation: "reversed" },
          authoritative.cards[1]!,
        ],
      }),
    ).toBeUndefined();
    expect(
      restoreUiSnapshot(saved, {
        ...authoritative,
        cards: [
          { ...authoritative.cards[0]!, position: "Elsewhere" },
          authoritative.cards[1]!,
        ],
      }),
    ).toBeUndefined();
  });

  it("does not throw for absent or hostile host state", () => {
    for (const value of [
      undefined,
      null,
      [],
      "bad-state",
      {
        get version() {
          throw new Error("host state unavailable");
        },
      },
    ]) {
      expect(restoreUiSnapshot(value, beginPayload())).toBeUndefined();
    }
  });
});
