import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  DrawError,
} from "../types.js";
import { useDrawSession } from "../useDrawSession.js";

function deck(drawId = "draw_first"): BeginReadingPayload {
  return {
    drawId,
    readingKind: "spread",
    spreadType: "three_card",
    spreadName: "Three Card Spread",
    question: "What next?",
    language: "en",
    requiredCount: 3,
    deckBackImageUri: "data:image/webp;base64,YmFjaw==",
    slots: Array.from({ length: 78 }, (_, index) => ({
      slotId: `opaque-${index + 1}`,
      index,
    })),
  };
}

function confirmed(drawId = "draw_first"): ConfirmedReading {
  return {
    drawId,
    readingId: `reading_${drawId}`,
    spreadType: "three_card",
    spreadName: "Three Card Spread",
    question: "What next?",
    language: "en",
    cards: ["fool", "magician", "world"].map((id, index) => ({
      id,
      name: id,
      displayName: id,
      orientation: "upright" as const,
      position: ["Past", "Present", "Future"][index],
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createClient(target: DrawClient["target"] = "web") {
  let host!: Parameters<NonNullable<DrawClient["subscribeInitial"]>>[0];
  const beginReading = vi.fn<DrawClient["beginReading"]>(async () => deck());
  const confirmReading = vi.fn<DrawClient["confirmReading"]>(async (drawId) =>
    confirmed(drawId),
  );
  const client: DrawClient = {
    target,
    beginReading,
    confirmReading,
    subscribeInitial(handlers) {
      host = handlers;
      return () => undefined;
    },
  };
  return {
    client,
    beginReading,
    confirmReading,
    get host() {
      return host;
    },
  };
}

const input: BeginReadingInput = {
  readingKind: "spread",
  spreadType: "three_card",
  question: "What next?",
  language: "en",
};
const slots = ["opaque-3", "opaque-1", "opaque-2"];

describe("useDrawSession recovery", () => {
  it("locks the existing table and retries the original ordered selection after a lost response", async () => {
    const remote = createClient();
    const response = deferred<ConfirmedReading>();
    remote.confirmReading.mockImplementationOnce(() => response.promise);
    const { result } = renderHook(() => useDrawSession(remote.client));
    act(() => remote.host.onBegin(deck()));
    act(() => result.current.setStage("selecting"));
    const originalDeck = result.current.draw;
    const selected = [...slots];
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.confirm(selected);
    });
    selected.reverse();
    expect(result.current.stage).toBe("confirming");
    expect(result.current.draw).toBe(originalDeck);
    expect(result.current.selectionLocked).toBe(true);
    await act(async () => {
      await result.current.confirm(selected);
      await result.current.retryConfirm();
    });
    expect(remote.confirmReading).toHaveBeenCalledTimes(1);
    await act(async () => {
      response.reject(new TypeError("Connection lost after delivery"));
      await pending;
    });
    expect(result.current.stage).toBe("selecting");
    expect(result.current.draw).toBe(originalDeck);
    expect(result.current.selectionLocked).toBe(true);
    await act(async () => {
      await result.current.confirm(selected);
    });
    expect(remote.confirmReading).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.retryConfirm();
    });
    expect(
      remote.confirmReading.mock.calls.map(([drawId, ordered]) => [
        drawId,
        ordered,
      ]),
    ).toEqual([
      ["draw_first", slots],
      ["draw_first", slots],
    ]);
    expect(result.current.reading?.readingId).toBe("reading_draw_first");
    expect(result.current.stage).toBe("reading");
  });

  it.each(["INVALID_SELECTION_COUNT", "DUPLICATE_SLOT", "INVALID_SLOT"])(
    "allows a corrected selection only after explicit %s rejection",
    async (code) => {
      const remote = createClient();
      remote.confirmReading.mockRejectedValueOnce(
        Object.assign(new Error("Rejected"), { code }),
      );
      const { result } = renderHook(() => useDrawSession(remote.client));
      act(() => remote.host.onBegin(deck()));
      act(() => result.current.setStage("selecting"));
      await act(async () => {
        await result.current.confirm([...slots]);
      });
      expect(result.current.selectionLocked).toBe(false);
      expect(result.current.stage).toBe("selecting");
      await act(async () => {
        await result.current.retryConfirm();
      });
      expect(remote.confirmReading).toHaveBeenCalledTimes(1);
      const corrected = ["opaque-4", "opaque-5", "opaque-6"];
      await act(async () => {
        await result.current.confirm(corrected);
      });
      expect(remote.confirmReading.mock.calls[1].slice(0, 2)).toEqual([
        "draw_first",
        corrected,
      ]);
      expect(result.current.stage).toBe("reading");
    },
  );

  it.each<{ label: string; metadata: Partial<DrawError> }>([
    { label: "uncoded host failure", metadata: {} },
    {
      label: "server failure",
      metadata: { code: "INTERNAL_ERROR", httpStatus: 503 },
    },
    { label: "expired credentials", metadata: { httpStatus: 401 } },
    {
      label: "confirmation already running",
      metadata: { code: "DRAW_ALREADY_CONFIRMING" },
    },
    {
      label: "conflicting confirmation",
      metadata: { code: "DRAW_ALREADY_CONFIRMED" },
    },
    {
      label: "missing draw",
      metadata: { code: "DRAW_NOT_FOUND", httpStatus: 404 },
    },
    {
      label: "expired draw",
      metadata: { code: "DRAW_EXPIRED", httpStatus: 410 },
    },
    {
      label: "unrecognized rejection",
      metadata: { code: "UNKNOWN_REJECTION", httpStatus: 400 },
    },
  ])("does not permit changing cards after $label", async ({ metadata }) => {
    const remote = createClient();
    const failure = Object.assign(new Error("Confirmation failed"), metadata);
    remote.confirmReading.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useDrawSession(remote.client));
    act(() => remote.host.onBegin(deck()));
    act(() => result.current.setStage("selecting"));
    await act(async () => {
      await result.current.confirm([...slots]);
    });
    expect(result.current.error).toBe(failure);
    expect(result.current.selectionLocked).toBe(true);
    await act(async () => {
      await result.current.confirm([...slots].reverse());
    });
    expect(remote.confirmReading).toHaveBeenCalledTimes(1);
    expect(result.current.stage).toBe("selecting");
  });

  it("ignores repeated and superseded host decks without resetting the active table or reading", () => {
    const remote = createClient("mcp");
    const { result } = renderHook(() => useDrawSession(remote.client));
    expect(result.current.stage).toBe("waiting");
    const first = deck();
    act(() => remote.host.onBegin(first));
    act(() => result.current.setStage("selecting"));
    act(() => remote.host.onBegin(deck()));
    expect(result.current.stage).toBe("selecting");
    expect(result.current.draw).toBe(first);
    const newer = confirmed("draw_newer");
    act(() => remote.host.onConfirmed(newer));
    act(() => remote.host.onBegin(first));
    act(() => remote.host.onConfirmed(confirmed()));
    act(() => remote.host.onBegin(deck("draw_newer")));
    act(() => remote.host.onConfirmed(confirmed("draw_newer")));
    expect(result.current.stage).toBe("reading");
    expect(result.current.reading).toBe(newer);
    expect(result.current.draw).toBeUndefined();
  });

  it("aborts an old confirmation when a different host draw arrives and discards its late success", async () => {
    const remote = createClient("mcp");
    const response = deferred<ConfirmedReading>();
    remote.confirmReading.mockImplementationOnce(() => response.promise);
    const { result } = renderHook(() => useDrawSession(remote.client));
    act(() => remote.host.onBegin(deck()));
    act(() => result.current.setStage("selecting"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.confirm([...slots]);
    });
    const next = deck("draw_next");
    act(() => remote.host.onBegin(next));
    expect(remote.confirmReading.mock.calls[0][2]?.signal?.aborted).toBe(true);
    expect(result.current.selectionLocked).toBe(false);
    await act(async () => {
      response.resolve(confirmed());
      await pending;
    });
    expect(result.current.draw).toBe(next);
    expect(result.current.stage).toBe("ritual");
    expect(result.current.reading).toBeUndefined();
    await act(async () => {
      await result.current.retryConfirm();
    });
    expect(remote.confirmReading).toHaveBeenCalledTimes(1);
    act(() => result.current.setStage("selecting"));
    await act(async () => {
      await result.current.confirm([...slots].reverse());
    });
    expect(result.current.reading?.drawId).toBe("draw_next");
  });

  it("discards a deferred begin response when a host reading supersedes it", async () => {
    const remote = createClient();
    const response = deferred<BeginReadingPayload>();
    remote.beginReading.mockImplementationOnce(() => response.promise);
    const { result } = renderHook(() => useDrawSession(remote.client));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.beginReading(input).catch((error) => error);
    });
    const newer = confirmed("draw_newer");
    act(() => remote.host.onConfirmed(newer));
    expect(remote.beginReading.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(result.current.pendingBegin).toBe(false);
    await act(async () => {
      response.resolve(deck());
      await pending;
    });
    expect(result.current.stage).toBe("reading");
    expect(result.current.reading).toBe(newer);
    expect(result.current.error).toBeUndefined();
  });

  it("retains the full begin input and key for retry but allocates a fresh key for a new submission", async () => {
    const remote = createClient();
    remote.beginReading.mockRejectedValueOnce(new Error("Response lost"));
    const { result } = renderHook(() => useDrawSession(remote.client));
    const custom: BeginReadingInput = {
      readingKind: "custom",
      question: "Keep this question",
      language: "en",
      customSpread: {
        name: "Original",
        positions: [{ name: "Focus", meaning: "What matters" }],
      },
    };
    await act(async () => {
      await result.current.beginReading(custom).catch(() => undefined);
    });
    custom.question = "Changed question";
    custom.customSpread.positions[0].name = "Changed position";
    act(() => result.current.retryBegin());
    await waitFor(() => expect(result.current.stage).toBe("ritual"));
    const firstInput = remote.beginReading.mock.calls[0][0];
    expect(firstInput.idempotencyKey).toEqual(expect.any(String));
    expect(remote.beginReading.mock.calls[1][0]).toEqual(firstInput);
    expect(remote.beginReading.mock.calls[1][0]).toMatchObject({
      question: "Keep this question",
      customSpread: { positions: [{ name: "Focus", meaning: "What matters" }] },
    });
    act(() => result.current.restart());
    remote.beginReading.mockResolvedValueOnce(deck("draw_second"));
    await act(async () => {
      await result.current.beginReading(input);
    });
    expect(remote.beginReading.mock.calls[2][0].idempotencyKey).not.toBe(
      firstInput.idempotencyKey,
    );
    expect(result.current.draw?.drawId).toBe("draw_second");
    act(() => result.current.restart());
    remote.beginReading.mockResolvedValueOnce(deck("draw_third"));
    await act(async () => {
      await result.current.beginReading({
        ...input,
        idempotencyKey: "caller-owned-key",
      });
    });
    expect(remote.beginReading.mock.calls[3][0].idempotencyKey).toBe(
      "caller-owned-key",
    );
    expect(result.current.draw?.drawId).toBe("draw_third");
  });

  it("restarts an MCP session into setup and ignores the retired table's notifications", async () => {
    const remote = createClient("mcp");
    remote.confirmReading.mockRejectedValueOnce(new Error("Lost response"));
    const { result } = renderHook(() => useDrawSession(remote.client));
    expect(result.current.stage).toBe("waiting");
    act(() => remote.host.onBegin(deck()));
    act(() => result.current.setStage("selecting"));
    await act(async () => {
      await result.current.confirm([...slots]);
    });
    act(() => result.current.restart());
    act(() => remote.host.onBegin(deck()));
    act(() => remote.host.onConfirmed(confirmed()));
    await act(async () => {
      await result.current.retryConfirm();
    });
    expect(result.current.stage).toBe("setup");
    expect(result.current.selectionLocked).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.draw).toBeUndefined();
    expect(remote.confirmReading).toHaveBeenCalledTimes(1);
    remote.beginReading.mockResolvedValueOnce(deck("draw_restarted"));
    await act(async () => {
      await result.current.beginReading(input);
    });
    expect(result.current.stage).toBe("ritual");
    expect(result.current.draw?.drawId).toBe("draw_restarted");
  });
});
