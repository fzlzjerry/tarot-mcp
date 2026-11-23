import { vi } from "vitest";
import {
  AUTH_TOKEN_SESSION_KEY,
  HANDOFF_TOKEN_SESSION_KEY,
  createWebClient,
} from "../web-client.js";
import type { ReadingCard } from "../types.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("Web visual-reading client", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/draw/");
    document.documentElement.lang = "en";
    vi.restoreAllMocks();
  });

  it("retains HTTP error status and machine codes for recovery decisions", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: "Unavailable", code: "DRAW_EXPIRED" }, 410),
      )
      .mockResolvedValueOnce(jsonResponse({}, 401));
    const client = createWebClient();
    await expect(
      client.confirmReading("old-draw", ["opaque-1"]),
    ).rejects.toMatchObject({ code: "DRAW_EXPIRED", httpStatus: 410 });
    window.sessionStorage.setItem(HANDOFF_TOKEN_SESSION_KEY, "handoff-token");
    await expect(
      client.confirmReading("old-draw", ["opaque-1"]),
    ).rejects.toMatchObject({ httpStatus: 401 });
    fetchMock.mockRestore();
  });

  it("uses dedicated REST routes and sends the session-only bearer token", async () => {
    const slots = Array.from({ length: 78 }, (_, order) => ({
      slotId: `opaque-${order}`,
      order,
    }));
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          {
            draw: {
              drawId: "draw_1",
              readingKind: "spread",
              spreadType: "single_card",
              spreadName: "Single Card",
              question: "Today?",
              language: "en",
              requiredCount: 1,
              slots,
              deck: {
                backImageUri:
                  "/assets/cards/midnight-art-nouveau-v2-r2/back.webp",
                slots,
              },
            },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          reading: {
            drawId: "draw_1",
            spreadType: "single_card",
            spreadName: "Single Card",
            question: "Today?",
            language: "en",
            cards: [
              {
                cardId: "fool",
                name: "The Fool",
                displayName: "The Fool",
                orientation: "upright",
                imageUri: "/assets/cards/midnight-art-nouveau-v2-r2/fool.webp",
              },
            ],
          },
        }),
      );
    const client = createWebClient();
    client.setSessionToken?.(" TOKEN ");
    expect(window.sessionStorage.getItem(AUTH_TOKEN_SESSION_KEY)).toBe("TOKEN");

    const draw = await client.beginReading({
      readingKind: "spread",
      spreadType: "single_card",
      question: "Today?",
      language: "en",
    });
    const reading = await client.confirmReading(draw.drawId, ["opaque-0"]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/visual-readings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer TOKEN" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/visual-readings/draw_1/confirm",
      expect.objectContaining({
        body: JSON.stringify({ selectedSlotIds: ["opaque-0"] }),
      }),
    );
    expect(reading.cards[0].imageUri).toContain("midnight-art-nouveau-v2-r2");

    client.setSessionToken?.("");
    expect(window.sessionStorage.getItem(AUTH_TOKEN_SESSION_KEY)).toBeNull();
  });

  it("captures a fragment handoff, resolves the hidden draw, and confirms with handoff authorization", async () => {
    const slots = Array.from({ length: 78 }, (_, order) => ({
      slotId: `handoff-slot-${order}`,
      order,
    }));
    window.history.replaceState(
      null,
      "",
      "/draw/?theme=dark#handoff=handoff%20token",
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          draw: {
            drawId: "draw_handoff",
            readingKind: "spread",
            spreadType: "single_card",
            spreadName: "Single Card",
            question: "Open the browser?",
            language: "en",
            requiredCount: 1,
            slots,
            deck: {
              backImageUri:
                "/assets/cards/midnight-art-nouveau-v2-r2/back.webp",
              slots,
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          reading: {
            readingId: "reading_handoff",
            drawId: "draw_handoff",
            spreadType: "single_card",
            spreadName: "Single Card",
            question: "Open the browser?",
            language: "en",
            cards: [
              {
                cardId: "fool",
                name: "The Fool",
                displayName: "The Fool",
                orientation: "upright",
                imageUri: "/assets/cards/midnight-art-nouveau-v2-r2/fool.webp",
              },
            ],
          },
        }),
      );

    const client = createWebClient();
    expect(client.startsWithHandoff?.()).toBe(true);
    expect(window.sessionStorage.getItem(HANDOFF_TOKEN_SESSION_KEY)).toBe(
      "handoff token",
    );
    expect(window.location.pathname).toBe("/draw/");
    expect(window.location.search).toBe("?theme=dark");
    expect(window.location.hash).toBe("");

    const onBegin = vi.fn();
    const onConfirmed = vi.fn();
    const onError = vi.fn();
    const unsubscribe = client.subscribeInitial?.({
      onBegin,
      onConfirmed,
      onError,
    });
    await vi.waitFor(() => expect(onBegin).toHaveBeenCalledOnce());
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/visual-handoff/resolve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Tarot-Handoff handoff token",
        }),
        body: "{}",
      }),
    );

    const reading = await client.confirmReading("draw_handoff", [
      "handoff-slot-0",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/visual-handoff/confirm",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Tarot-Handoff handoff token",
        }),
        body: JSON.stringify({ selectedSlotIds: ["handoff-slot-0"] }),
      }),
    );
    expect(reading.readingId).toBe("reading_handoff");

    unsubscribe?.();
    client.clearHandoff?.();
    expect(client.startsWithHandoff?.()).toBe(false);
    expect(window.sessionStorage.getItem(HANDOFF_TOKEN_SESSION_KEY)).toBeNull();
  });

  it("restores an already-confirmed handoff reading", async () => {
    window.history.replaceState(null, "", "/draw/#handoff=reading-token");
    const slots = Array.from({ length: 78 }, (_, order) => ({
      slotId: `restored-slot-${order}`,
      order,
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        draw: {
          drawId: "draw_restored",
          readingKind: "spread",
          spreadType: "single_card",
          spreadName: "Single Card",
          question: "Already done?",
          language: "en",
          requiredCount: 1,
          slots,
          deck: {
            backImageUri: "/assets/cards/midnight-art-nouveau-v2-r2/back.webp",
            slots,
          },
        },
        reading: {
          readingId: "reading_restored",
          drawId: "draw_restored",
          spreadType: "single_card",
          spreadName: "Single Card",
          question: "Already done?",
          language: "en",
          cards: [
            {
              cardId: "world",
              name: "The World",
              displayName: "The World",
              orientation: "reversed",
            },
          ],
        },
      }),
    );
    const client = createWebClient();
    const onBegin = vi.fn();
    const onConfirmed = vi.fn();
    const onError = vi.fn();

    client.subscribeInitial?.({ onBegin, onConfirmed, onError });

    await vi.waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce());
    expect(onBegin).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onConfirmed.mock.calls[0][0]).toMatchObject({
      readingId: "reading_restored",
      drawId: "draw_restored",
      deckBackImageUri: "/assets/cards/midnight-art-nouveau-v2-r2/back.webp",
      cards: [{ id: "world", orientation: "reversed" }],
    });
  });
});

describe("Web deck gallery client", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/draw/");
    vi.restoreAllMocks();
  });

  it("lists the deck from the catalog route in the reader's language", async () => {
    window.sessionStorage.setItem(AUTH_TOKEN_SESSION_KEY, "session-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        cards: "# 塔罗牌",
        structured: {
          total: 1,
          cards: [
            {
              id: "fool",
              name: "The Fool",
              displayName: "愚者",
              arcana: "major",
              number: 0,
              keywords: { upright: ["新的开始"], reversed: ["鲁莽"] },
            },
          ],
        },
      }),
    );
    const client = createWebClient();
    const controller = new AbortController();

    await expect(
      client.listCards!("zh", { signal: controller.signal }),
    ).resolves.toEqual([
      {
        id: "fool",
        name: "The Fool",
        displayName: "愚者",
        arcana: "major",
        number: 0,
        keywords: { upright: ["新的开始"], reversed: ["鲁莽"] },
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/cards?language=zh", {
      signal: controller.signal,
      headers: { authorization: "Bearer session-token" },
    });
  });

  it("keeps the server's reason when the catalog cannot be read", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    await expect(createWebClient().listCards!("en")).rejects.toMatchObject({
      httpStatus: 401,
      message: "Unauthorized",
    });
  });

  it("offers no gallery on the hand-off page, which has no catalog route", () => {
    window.sessionStorage.setItem(HANDOFF_TOKEN_SESSION_KEY, "handoff-token");
    expect(createWebClient().listCards).toBeUndefined();
  });

  it("points the grid at the small faces of the deck", () => {
    expect(createWebClient().getCardThumbnail!("star")).toMatch(
      /^\/assets\/cards\/midnight-art-nouveau-v2-r\d+\/mcp\/star\.webp$/,
    );
  });

  it("ignores the retired ?deck=v1 parameter", async () => {
    window.history.replaceState(null, "", "/draw/?deck=v1");
    const client = createWebClient();
    expect(client.getCardThumbnail!("star")).toMatch(
      /^\/assets\/cards\/midnight-art-nouveau-v2-r\d+\/mcp\/star\.webp$/,
    );
    await expect(
      client.resolveImage!({ id: "star" } as ReadingCard),
    ).resolves.toMatch(
      /^\/assets\/cards\/midnight-art-nouveau-v2-r\d+\/star\.webp$/,
    );
  });
});
