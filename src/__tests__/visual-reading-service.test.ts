import { TOOL_NAMES } from "../mcp/public-api.js";
import { TarotServer } from "../mcp/tarot-service.js";

describe("visual reading service contract", () => {
  let server: TarotServer;

  beforeEach(async () => {
    server = await TarotServer.create();
  });

  it("requires readingKind and rejects fields from another reading kind", async () => {
    const missingKind = await server.executeTool(TOOL_NAMES.beginVisualReading, {
      spreadType: "single_card",
      question: "Missing discriminator",
    });
    expect(missingKind.ok).toBe(false);
    if (!missingKind.ok) {
      expect(missingKind.error).toContain("readingKind");
    }

    const dailyWithSpread = await server.executeTool(
      TOOL_NAMES.beginVisualReading,
      {
        readingKind: "daily",
        spreadType: "single_card",
      },
    );
    expect(dailyWithSpread).toMatchObject({ ok: false });
    if (!dailyWithSpread.ok) {
      expect(dailyWithSpread.error).toContain("Unsupported parameter(s): spreadType");
    }

    const moonWithSession = await server.executeTool(
      TOOL_NAMES.beginVisualReading,
      {
        readingKind: "moon",
        sessionId: "session_not_allowed",
      },
    );
    expect(moonWithSession).toMatchObject({ ok: false });
    if (!moonWithSession.ok) {
      expect(moonWithSession.error).toContain("Unsupported parameter(s): sessionId");
    }

    const customWithFlatFields = await server.executeTool(
      TOOL_NAMES.beginVisualReading,
      {
        readingKind: "custom",
        question: "Custom?",
        spreadName: "Flat custom",
        positions: [{ name: "Message" }],
      },
    );
    expect(customWithFlatFields).toMatchObject({ ok: false });
  });

  it("keeps daily and moon visual readings one-shot", async () => {
    const baseline = server.getSessionCount();

    for (const args of [
      { readingKind: "daily", language: "en" },
      { readingKind: "moon", customDate: "2026-08-05", language: "zh" },
    ]) {
      const begin = await server.executeTool(
        TOOL_NAMES.beginVisualReading,
        args,
      );
      expect(begin.ok).toBe(true);
      if (!begin.ok) continue;
      const draw = begin.structured as {
        drawId: string;
        requiredCount: number;
        slots: Array<{ slotId: string }>;
      };
      const confirm = await server.executeTool(
        TOOL_NAMES.confirmVisualReading,
        {
          drawId: draw.drawId,
          selectedSlotIds: draw.slots
            .slice(0, draw.requiredCount)
            .map((slot) => slot.slotId),
        },
      );
      expect(confirm.ok).toBe(true);
      if (confirm.ok) {
        expect(confirm.structured).not.toHaveProperty("sessionId");
      }
    }

    expect(server.getSessionCount()).toBe(baseline);
  });

  it("keeps an implicit moon date idempotent across UTC midnight", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-05T23:59:59.000Z"));
      const first = await server.executeTool(TOOL_NAMES.beginVisualReading, {
        readingKind: "moon",
        language: "en",
        idempotencyKey: "moon-midnight-idempotency",
      });
      expect(first.ok).toBe(true);

      vi.setSystemTime(new Date("2026-08-06T00:00:01.000Z"));
      const retry = await server.executeTool(TOOL_NAMES.beginVisualReading, {
        readingKind: "moon",
        language: "en",
        idempotencyKey: "moon-midnight-idempotency",
      });

      expect(retry).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves stale continuation-session errors at begin", async () => {
    const baseline = server.getSessionCount();
    const result = await server.executeTool(TOOL_NAMES.beginVisualReading, {
      readingKind: "spread",
      spreadType: "single_card",
      question: "Continue the earlier reading?",
      sessionId: "session_stale_visual_fixture",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        'Session "session_stale_visual_fixture" not found',
      );
      expect(result.error).toContain('pass "new" to start a new session');
    }
    expect(server.getSessionCount()).toBe(baseline);
  });

  it("supports a strict nested custom spread and idempotent confirmation", async () => {
    const begin = await server.executeTool(TOOL_NAMES.beginVisualReading, {
      readingKind: "custom",
      question: "What are my next two steps?",
      customSpread: {
        name: "Two Steps",
        positions: [{ name: "Now" }, { name: "Next", meaning: "Next move" }],
      },
      idempotencyKey: "custom-two-steps",
    });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;
    const draw = begin.structured as {
      drawId: string;
      slots: Array<{ slotId: string }>;
    };
    const selectedSlotIds = draw.slots.slice(0, 2).map((slot) => slot.slotId);

    const first = await server.executeTool(TOOL_NAMES.confirmVisualReading, {
      drawId: draw.drawId,
      selectedSlotIds,
    });
    const retry = await server.executeTool(TOOL_NAMES.confirmVisualReading, {
      drawId: draw.drawId,
      selectedSlotIds,
    });

    expect(first).toEqual(retry);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.structured).toMatchObject({
        drawId: draw.drawId,
        spreadName: "Two Steps",
        cards: [
          { position: "Now" },
          { position: "Next", positionMeaning: "Next move" },
        ],
      });
    }
  });
});
