import { vi } from "vitest";
import {
  AUTH_TOKEN_SESSION_KEY,
  HANDOFF_TOKEN_SESSION_KEY,
  createWebClient,
} from "../web-client.js";

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

  it.each([
    [
      "en",
      "The local MCP connection has closed. Return to the MCP client, start a new draw, and keep the connection open.",
    ],
    ["zh", "本地 MCP 连接已关闭。请回到 MCP 客户端重新发起抽牌并保持连接。"],
  ] as const)(
    "turns a rejected handoff fetch into a clear %s disconnect message",
    async (language, expectedMessage) => {
      document.documentElement.lang = language;
      window.sessionStorage.setItem(HANDOFF_TOKEN_SESSION_KEY, "handoff-token");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new TypeError("Failed to fetch"),
      );

      const client = createWebClient();

      await expect(
        client.confirmReading("draw_disconnected", ["opaque-1"]),
      ).rejects.toThrow(expectedMessage);
    },
  );

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
                backImageUri: "/assets/cards/midnight-art-nouveau-v1/back.webp",
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
                imageUri: "/assets/cards/midnight-art-nouveau-v1/fool.webp",
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
    expect(reading.cards[0].imageUri).toContain("midnight-art-nouveau-v1");

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
              backImageUri: "/assets/cards/midnight-art-nouveau-v1/back.webp",
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
                imageUri: "/assets/cards/midnight-art-nouveau-v1/fool.webp",
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
            backImageUri: "/assets/cards/midnight-art-nouveau-v1/back.webp",
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
      deckBackImageUri: "/assets/cards/midnight-art-nouveau-v1/back.webp",
      cards: [{ id: "world", orientation: "reversed" }],
    });
  });
});
