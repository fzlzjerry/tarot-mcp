import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { assertCompleteVisualDeck, extractError } from "./normalize.js";
import { restoreUiSnapshot } from "./ui-state.js";
import { t } from "./i18n.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  DrawError,
  Language,
  PendingConfirmation,
  TarotUiSnapshot,
} from "./types.js";

export type DrawStageName =
  "setup" | "waiting" | "ritual" | "selecting" | "confirming" | "reading";

interface ConfirmationSnapshot extends PendingConfirmation {
  drawId: string;
  requiredCount: number;
}

function asError(error: unknown): DrawError {
  return extractError(error, String(error));
}

/** The session owns requests and transitions; card placement and animation stay in the view. */
export function useDrawSession(client: DrawClient) {
  const [language, setLanguage] = useState<Language>(() =>
    navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en",
  );
  const [stage, updateStage] = useState<DrawStageName>(
    client.target === "web" && !client.startsWithHandoff?.()
      ? "setup"
      : "waiting",
  );
  const stageRef = useRef(stage);
  const setStage = useCallback((next: SetStateAction<DrawStageName>) => {
    const value = typeof next === "function" ? next(stageRef.current) : next;
    stageRef.current = value;
    updateStage(value);
  }, []);
  const [draw, setDraw] = useState<BeginReadingPayload>();
  const currentDraw = useRef<BeginReadingPayload | undefined>(undefined);
  const [reading, setReading] = useState<ConfirmedReading>();
  const [restoredUiSnapshot, setRestoredUiSnapshot] =
    useState<TarotUiSnapshot>();
  const [error, setError] = useState<DrawError>();
  const [pendingBegin, setPendingBegin] = useState(false);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const lastInput = useRef<BeginReadingInput | undefined>(undefined);
  const confirmation = useRef<ConfirmationSnapshot | undefined>(undefined);
  // Keep identities, not past decks/readings, so delayed host replays cannot undo progress.
  const seenDrawIds = useRef(new Set<string>());
  const seenReadingIds = useRef(new Set<string>());
  const activeDrawId = useRef<string | undefined>(undefined);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(
    () => () => {
      request.current?.abort();
      request.current = undefined;
    },
    [],
  );

  const cancelRequest = useCallback(() => {
    request.current?.abort();
    request.current = undefined;
    setPendingBegin(false);
  }, []);

  const clearConfirmation = useCallback(() => {
    confirmation.current = undefined;
    setSelectionLocked(false);
  }, []);

  const startDraw = useCallback(
    (payload: BeginReadingPayload) => {
      assertCompleteVisualDeck(payload);
      const restored = restoreUiSnapshot(client.readUiState?.(), payload);
      seenDrawIds.current.add(payload.drawId);
      activeDrawId.current = payload.drawId;
      currentDraw.current = payload;
      clearConfirmation();
      lastInput.current = undefined;
      setDraw(payload);
      setLanguage(payload.language);
      setRestoredUiSnapshot(restored);
      setReading(restored?.confirmedReading);
      if (restored?.confirmedReading?.readingId) {
        seenReadingIds.current.add(restored.confirmedReading.readingId);
      }
      if (restored?.pendingConfirmation) {
        confirmation.current = {
          ...restored.pendingConfirmation,
          drawId: payload.drawId,
          requiredCount: payload.requiredCount,
        };
        setSelectionLocked(true);
        setError(
          Object.assign(
            new Error(t(payload.language, "confirmationUnknown")),
            restored.pendingConfirmation.failure,
          ),
        );
      } else {
        setError(undefined);
      }
      setStage(
        restored?.confirmedReading
          ? "reading"
          : restored
            ? "selecting"
            : "ritual",
      );
    },
    [client, clearConfirmation, setStage],
  );

  const showReading = useCallback(
    (payload: ConfirmedReading, drawId?: string) => {
      const nextDrawId = payload.drawId ?? drawId;
      const nextReading =
        !payload.drawId && nextDrawId
          ? { ...payload, drawId: nextDrawId }
          : payload;
      if (nextDrawId) seenDrawIds.current.add(nextDrawId);
      if (payload.readingId) seenReadingIds.current.add(payload.readingId);
      if (currentDraw.current?.drawId !== nextDrawId) {
        currentDraw.current = undefined;
        setDraw(undefined);
      }
      activeDrawId.current = nextDrawId;
      lastInput.current = undefined;
      clearConfirmation();
      setRestoredUiSnapshot(
        restoreUiSnapshot(client.readUiState?.(), nextReading),
      );
      setReading(nextReading);
      setLanguage(payload.language);
      setError(undefined);
      setStage("reading");
    },
    [client, clearConfirmation, setStage],
  );

  useEffect(
    () =>
      client.subscribeInitial?.({
        onBegin(payload) {
          if (seenDrawIds.current.has(payload.drawId)) return;
          try {
            assertCompleteVisualDeck(payload);
            cancelRequest();
            startDraw(payload);
          } catch (nextError) {
            setError(asError(nextError));
          }
        },
        onConfirmed(payload) {
          if (
            payload.readingId &&
            seenReadingIds.current.has(payload.readingId)
          )
            return;
          if (
            payload.drawId &&
            seenDrawIds.current.has(payload.drawId) &&
            (payload.drawId !== activeDrawId.current ||
              stageRef.current === "reading")
          )
            return;
          cancelRequest();
          clearConfirmation();
          showReading(payload);
        },
        onError: setError,
      }),
    [client, cancelRequest, clearConfirmation, showReading, startDraw],
  );

  const beginReading = useCallback(
    async (input: BeginReadingInput, signal?: AbortSignal) => {
      if (request.current || stageRef.current !== "setup") {
        throw new Error(
          "A reading is already in progress. Finish it or start a new reading from the table.",
        );
      }
      signal?.throwIfAborted();
      const savedInput: BeginReadingInput = {
        ...structuredClone(input),
        idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
      };
      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      request.current = controller;
      lastInput.current = savedInput;
      setPendingBegin(true);
      setError(undefined);
      try {
        const payload = await client.beginReading(savedInput, {
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        if (
          request.current === controller &&
          !seenDrawIds.current.has(payload.drawId)
        ) {
          startDraw(payload);
        }
        return payload;
      } catch (nextError) {
        if (request.current === controller && !controller.signal.aborted) {
          setError(asError(nextError));
        }
        throw nextError;
      } finally {
        signal?.removeEventListener("abort", abort);
        if (request.current === controller) {
          request.current = undefined;
          setPendingBegin(false);
        }
      }
    },
    [client, startDraw],
  );

  const submitConfirmation = useCallback(
    async (
      snapshot: ConfirmationSnapshot,
      deckOrder?: string[],
    ): Promise<void> => {
      if (request.current || stageRef.current === "reading") return;
      const controller = new AbortController();
      request.current = controller;
      setStage("confirming");
      setError(undefined);
      const activeDraw = currentDraw.current;
      const previous =
        client.writeUiState && deckOrder === undefined && activeDraw
          ? restoreUiSnapshot(client.readUiState?.(), activeDraw)
          : undefined;
      confirmation.current = { ...snapshot, failure: undefined };
      const checkpoint =
        client.writeUiState && activeDraw
          ? restoreUiSnapshot(
              {
                version: 1,
                drawId: snapshot.drawId,
                deckOrder: deckOrder ?? previous?.deckOrder,
                selectedSlotIds: snapshot.selectedSlotIds,
                pendingConfirmation: confirmation.current,
                revealedIndices: [],
                continuationSent: false,
              },
              activeDraw,
            )
          : undefined;
      try {
        // Freeze the submitted slots before the host can discard this iframe.
        if (checkpoint) client.writeUiState?.(checkpoint);
        const payload = await client.confirmReading(
          snapshot.drawId,
          [...snapshot.selectedSlotIds],
          {
            signal: controller.signal,
          },
        );
        controller.signal.throwIfAborted();
        if (request.current !== controller) return;
        if (payload.cards.length !== snapshot.requiredCount) {
          throw new Error(
            `Expected ${snapshot.requiredCount} cards, received ${payload.cards.length}.`,
          );
        }
        showReading(payload, snapshot.drawId);
      } catch (nextError) {
        if (request.current === controller && !controller.signal.aborted) {
          const failure = asError(nextError);
          if (
            failure.httpStatus !== 401 &&
            !(failure.httpStatus !== undefined && failure.httpStatus >= 500) &&
            (failure.code === "INVALID_SELECTION_COUNT" ||
              failure.code === "DUPLICATE_SLOT" ||
              failure.code === "INVALID_SLOT")
          ) {
            clearConfirmation();
          } else {
            confirmation.current = {
              ...snapshot,
              failure: {
                ...(typeof failure.code === "string"
                  ? { code: failure.code }
                  : {}),
                ...(typeof failure.httpStatus === "number"
                  ? { httpStatus: failure.httpStatus }
                  : {}),
              },
            };
          }
          if (checkpoint) {
            client.writeUiState?.({
              ...checkpoint,
              pendingConfirmation: confirmation.current,
            });
          }
          setError(failure);
          setStage("selecting");
        }
      } finally {
        if (request.current === controller) request.current = undefined;
      }
    },
    [client, clearConfirmation, setStage, showReading],
  );

  const confirm = useCallback(
    async (selected: string[], deckOrder?: string[]): Promise<void> => {
      const activeDraw = currentDraw.current;
      if (
        request.current ||
        confirmation.current ||
        stageRef.current !== "selecting" ||
        !activeDraw ||
        selected.length !== activeDraw.requiredCount
      )
        return;
      const snapshot: ConfirmationSnapshot = {
        drawId: activeDraw.drawId,
        selectedSlotIds: [...selected],
        requiredCount: activeDraw.requiredCount,
      };
      confirmation.current = snapshot;
      setSelectionLocked(true);
      await submitConfirmation(snapshot, deckOrder);
    },
    [submitConfirmation],
  );

  const retryConfirm = useCallback(async (): Promise<void> => {
    if (confirmation.current) await submitConfirmation(confirmation.current);
  }, [submitConfirmation]);

  const restart = useCallback(() => {
    cancelRequest();
    clearConfirmation();
    lastInput.current = undefined;
    activeDrawId.current = undefined;
    currentDraw.current = undefined;
    client.clearHandoff?.();
    setDraw(undefined);
    setReading(undefined);
    setRestoredUiSnapshot(undefined);
    setError(undefined);
    setStage("setup");
  }, [client, cancelRequest, clearConfirmation, setStage]);

  const retryBegin = useCallback(() => {
    if (lastInput.current) {
      void beginReading(lastInput.current).catch(() => undefined);
    }
  }, [beginReading]);

  return {
    language,
    setLanguage,
    stage,
    setStage,
    draw,
    reading,
    restoredUiSnapshot,
    error,
    pendingBegin,
    selectionLocked,
    pendingConfirmation: confirmation.current,
    beginReading,
    confirm,
    retryConfirm,
    restart,
    retryBegin,
  };
}
