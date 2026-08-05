import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { TAROT_SPREADS } from "../tarot/readings/spreads.js";
import {
  VisualDrawError,
  VisualDrawManager,
  VisualReadingSpec,
} from "../tarot/readings/visual-draw-manager.js";

describe("VisualDrawManager", () => {
  let sessionManager: TarotSessionManager;
  let manager: VisualDrawManager;

  beforeEach(async () => {
    const cardManager = await TarotCardManager.create();
    sessionManager = new TarotSessionManager();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    let sequence = 0;
    manager = new VisualDrawManager(cardManager, readingManager, {
      randomUuid: () => `test-${++sequence}`,
      drawOrientation: () => "upright",
    });
  });

  function spec(
    overrides: Partial<VisualReadingSpec> = {},
  ): VisualReadingSpec {
    return {
      readingKind: "spread",
      question: "What should I focus on?",
      language: "en",
      spreadType: "three_card",
      spread: TAROT_SPREADS.three_card,
      trackSession: true,
      ...overrides,
    };
  }

  it("prepares 78 unique opaque slots without leaking card faces", () => {
    const draw = manager.begin(spec());

    expect(draw.requiredCount).toBe(3);
    expect(draw.slots).toHaveLength(78);
    expect(new Set(draw.slots.map((slot) => slot.slotId)).size).toBe(78);
    expect(draw.slots.map((slot) => slot.order)).toEqual(
      Array.from({ length: 78 }, (_, index) => index),
    );
    for (const slot of draw.slots) {
      expect(Object.keys(slot).sort()).toEqual(["order", "slotId"]);
      expect(slot.slotId).toMatch(/^slot_/);
    }
    expect(draw.deck.size).toBe(78);
    expect(JSON.stringify(draw.deck)).not.toMatch(/cardId|orientation|meaning/);
    expect(sessionManager.getSessionCount()).toBe(0);
  });

  it("validates exact count, uniqueness, and draw membership", async () => {
    const draw = manager.begin(spec());
    const foreign = manager.begin(spec({ question: "A second draw" }));

    await expect(
      manager.confirm(draw.drawId, draw.slots.slice(0, 2).map((slot) => slot.slotId)),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION_COUNT", httpStatus: 400 });
    await expect(
      manager.confirm(draw.drawId, [
        draw.slots[0].slotId,
        draw.slots[0].slotId,
        draw.slots[1].slotId,
      ]),
    ).rejects.toMatchObject({ code: "DUPLICATE_SLOT", httpStatus: 400 });
    await expect(
      manager.confirm(draw.drawId, [
        draw.slots[0].slotId,
        draw.slots[1].slotId,
        foreign.slots[0].slotId,
      ]),
    ).rejects.toMatchObject({ code: "INVALID_SLOT", httpStatus: 400 });
  });

  it("maps selected slot order to spread position order", async () => {
    const draw = manager.begin(spec());
    const selected = [draw.slots[9], draw.slots[2], draw.slots[70]].map(
      (slot) => slot.slotId,
    );
    const confirmed = await manager.confirm(draw.drawId, selected);

    expect(confirmed.reading.cards.map((card) => card.position)).toEqual(
      TAROT_SPREADS.three_card.positions.map((position) => position.name),
    );
    expect(confirmed.reading.cards.map((card) => card.orientation)).toEqual([
      "upright",
      "upright",
      "upright",
    ]);
    expect(
      new Set(confirmed.reading.cards.map((card) => card.cardId)).size,
    ).toBe(3);
  });

  it("makes begin idempotent per key and rejects key reuse with another spec", () => {
    const first = manager.begin(spec(), "request-1");
    const retry = manager.begin(spec(), "request-1");

    expect(retry).toEqual(first);
    expect(() =>
      manager.begin(spec({ question: "Different" }), "request-1"),
    ).toThrowError(
      expect.objectContaining<Partial<VisualDrawError>>({
        code: "IDEMPOTENCY_CONFLICT",
        httpStatus: 409,
      }),
    );
  });

  it("expires abandoned draws without creating sessions", async () => {
    const cardManager = await TarotCardManager.create();
    sessionManager = new TarotSessionManager();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    let now = 1_000;
    let sequence = 0;
    const expiring = new VisualDrawManager(cardManager, readingManager, {
      now: () => now,
      pendingTtlMs: 50,
      randomUuid: () => `expiry-${++sequence}`,
    });
    const draw = expiring.begin(spec());

    now = 1_051;
    await expect(
      expiring.confirm(
        draw.drawId,
        draw.slots.slice(0, 3).map((slot) => slot.slotId),
      ),
    ).rejects.toMatchObject({ code: "DRAW_EXPIRED", httpStatus: 410 });
    expect(sessionManager.getSessionCount()).toBe(0);
  });

  it("returns 503 when the pending-draw capacity is full", async () => {
    const cardManager = await TarotCardManager.create();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    const capacityLimited = new VisualDrawManager(cardManager, readingManager, {
      maxPending: 1,
    });
    capacityLimited.begin(spec());

    expect(() =>
      capacityLimited.begin(spec({ question: "One draw too many" })),
    ).toThrowError(
      expect.objectContaining<Partial<VisualDrawError>>({
        code: "DRAW_CAPACITY_REACHED",
        httpStatus: 503,
      }),
    );
  });

  it("preserves retained results for their TTL and rejects new work at the retained cap", async () => {
    const cardManager = await TarotCardManager.create();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    let now = 20_000;
    const bounded = new VisualDrawManager(cardManager, readingManager, {
      now: () => now,
      retentionTtlMs: 100,
      maxRetained: 1,
    });
    const draw = bounded.begin(
      spec({ spreadType: "single_card", spread: TAROT_SPREADS.single_card }),
    );
    const selected = [draw.slots[0].slotId];
    const confirmed = await bounded.confirm(draw.drawId, selected);

    expect(await bounded.confirm(draw.drawId, selected)).toEqual(confirmed);
    expect(() => bounded.begin(spec({ question: "Queued too soon" }))).toThrowError(
      expect.objectContaining<Partial<VisualDrawError>>({
        code: "DRAW_CAPACITY_REACHED",
        httpStatus: 503,
      }),
    );

    now += 101;
    expect(() => bounded.begin(spec({ question: "Capacity recovered" }))).not.toThrow();
  });

  it("returns 404 for an unknown draw", async () => {
    await expect(
      manager.confirm("draw_unknown", ["slot_unknown"]),
    ).rejects.toMatchObject({ code: "DRAW_NOT_FOUND", httpStatus: 404 });
  });

  it("drops confirmed and expired tombstones after the retention window", async () => {
    const cardManager = await TarotCardManager.create();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    let now = 10_000;
    let sequence = 0;
    const retained = new VisualDrawManager(cardManager, readingManager, {
      now: () => now,
      pendingTtlMs: 50,
      retentionTtlMs: 100,
      randomUuid: () => `retention-${++sequence}`,
    });

    const confirmedDraw = retained.begin(
      spec({ spreadType: "single_card", spread: TAROT_SPREADS.single_card }),
    );
    const confirmedSelection = [confirmedDraw.slots[0].slotId];
    await retained.confirm(confirmedDraw.drawId, confirmedSelection);
    now = 10_101;
    await expect(
      retained.confirm(confirmedDraw.drawId, confirmedSelection),
    ).rejects.toMatchObject({ code: "DRAW_NOT_FOUND", httpStatus: 404 });

    const expiredDraw = retained.begin(spec());
    now = 10_152;
    const expiredSelection = expiredDraw.slots
      .slice(0, 3)
      .map((slot) => slot.slotId);
    await expect(
      retained.confirm(expiredDraw.drawId, expiredSelection),
    ).rejects.toMatchObject({ code: "DRAW_EXPIRED", httpStatus: 410 });
    now = 10_253;
    await expect(
      retained.confirm(expiredDraw.drawId, expiredSelection),
    ).rejects.toMatchObject({ code: "DRAW_NOT_FOUND", httpStatus: 404 });
  });

  it("does not restart an expired tombstone TTL on a much later first access", async () => {
    const cardManager = await TarotCardManager.create();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    let now = 1_000;
    const bounded = new VisualDrawManager(cardManager, readingManager, {
      now: () => now,
      pendingTtlMs: 50,
      retentionTtlMs: 100,
    });
    const draw = bounded.begin(spec());
    const selected = draw.slots.slice(0, 3).map((slot) => slot.slotId);

    now = 1_151;
    await expect(bounded.confirm(draw.drawId, selected)).rejects.toMatchObject({
      code: "DRAW_NOT_FOUND",
      httpStatus: 404,
    });
  });

  it("rejects a different selection while confirmation is in progress", async () => {
    const draw = manager.begin(spec());
    const selected = draw.slots.slice(0, 3).map((slot) => slot.slotId);
    const conflicting = draw.slots.slice(3, 6).map((slot) => slot.slotId);

    const first = manager.confirm(draw.drawId, selected);
    await expect(
      manager.confirm(draw.drawId, conflicting),
    ).rejects.toMatchObject({
      code: "DRAW_ALREADY_CONFIRMING",
      httpStatus: 409,
    });
    await expect(first).resolves.toMatchObject({
      reading: { drawId: draw.drawId },
    });
  });

  it("freezes reversed orientation when the opaque deck is prepared", async () => {
    const cardManager = await TarotCardManager.create();
    const readingManager = new TarotReadingManager(cardManager, sessionManager);
    const reversed = new VisualDrawManager(cardManager, readingManager, {
      drawOrientation: () => "reversed",
    });
    const draw = reversed.begin(
      spec({ spreadType: "single_card", spread: TAROT_SPREADS.single_card }),
    );
    const confirmed = await reversed.confirm(draw.drawId, [draw.slots[0].slotId]);

    expect(confirmed.reading.cards[0].orientation).toBe("reversed");
  });

  it("coalesces concurrent confirmation and caches identical retries exactly once", async () => {
    const draw = manager.begin(spec());
    const selected = draw.slots.slice(0, 3).map((slot) => slot.slotId);

    const [first, concurrent] = await Promise.all([
      manager.confirm(draw.drawId, selected),
      manager.confirm(draw.drawId, selected),
    ]);
    const retry = await manager.confirm(draw.drawId, selected);

    expect(concurrent).toEqual(first);
    expect(retry).toEqual(first);
    expect(first.reading.sessionId).toMatch(/^session_/);
    expect(
      sessionManager.getSessionReadingCount(first.reading.sessionId!),
    ).toBe(1);

    await expect(
      manager.confirm(draw.drawId, [...selected].reverse()),
    ).rejects.toMatchObject({
      code: "DRAW_ALREADY_CONFIRMED",
      httpStatus: 409,
    });
  });
});
