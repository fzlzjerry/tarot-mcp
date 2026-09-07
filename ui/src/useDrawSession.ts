import { useCallback, useEffect, useRef, useState } from "react";
import { assertCompleteVisualDeck } from "./normalize.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  Language,
} from "./types.js";

export type DrawStageName =
  "setup" | "waiting" | "ritual" | "selecting" | "confirming" | "reading";

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** The session owns requests and transitions; card placement and animation stay in the view. */
export function useDrawSession(client: DrawClient) {
  const [language, setLanguage] = useState<Language>(() =>
    navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en",
  );
  const [stage, setStage] = useState<DrawStageName>(
    client.target === "web" && !client.startsWithHandoff?.()
      ? "setup"
      : "waiting",
  );
  const [draw, setDraw] = useState<BeginReadingPayload>();
  const [reading, setReading] = useState<ConfirmedReading>();
  const [error, setError] = useState<Error>();
  const [pendingBegin, setPendingBegin] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const lastInput = useRef<BeginReadingInput | undefined>(undefined);

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

  const startDraw = useCallback((payload: BeginReadingPayload) => {
    assertCompleteVisualDeck(payload);
    setDraw(payload);
    setLanguage(payload.language);
    setReading(undefined);
    setError(undefined);
    setStage("ritual");
  }, []);

  useEffect(
    () =>
      client.subscribeInitial?.({
        onBegin(payload) {
          try {
            startDraw(payload);
          } catch (nextError) {
            setDraw(undefined);
            setError(asError(nextError));
            setStage("waiting");
          }
        },
        onConfirmed(payload) {
          setReading(payload);
          setLanguage(payload.language);
          setError(undefined);
          setStage("reading");
        },
        onError: setError,
      }),
    [client, startDraw],
  );

  const beginReading = useCallback(
    async (input: BeginReadingInput, signal?: AbortSignal) => {
      if (request.current || stage !== "setup") {
        throw new Error(
          "A reading is already in progress. Finish it or start a new reading from the table.",
        );
      }
      signal?.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      request.current = controller;
      lastInput.current = input;
      setPendingBegin(true);
      setError(undefined);
      try {
        const payload = await client.beginReading(input, {
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        startDraw(payload);
        return payload;
      } catch (nextError) {
        if (!controller.signal.aborted) setError(asError(nextError));
        throw nextError;
      } finally {
        signal?.removeEventListener("abort", abort);
        if (request.current === controller) {
          request.current = undefined;
          setPendingBegin(false);
        }
      }
    },
    [client, stage, startDraw],
  );

  const confirm = useCallback(
    async (selected: string[]): Promise<void> => {
      if (request.current || !draw || selected.length !== draw.requiredCount)
        return;
      const controller = new AbortController();
      request.current = controller;
      setStage("confirming");
      setError(undefined);
      try {
        const payload = await client.confirmReading(draw.drawId, selected, {
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        if (payload.cards.length !== draw.requiredCount) {
          throw new Error(
            `Expected ${draw.requiredCount} cards, received ${payload.cards.length}.`,
          );
        }
        setReading(payload);
        setStage("reading");
      } catch (nextError) {
        if (!controller.signal.aborted) {
          setError(asError(nextError));
          setStage("selecting");
        }
      } finally {
        if (request.current === controller) request.current = undefined;
      }
    },
    [client, draw],
  );

  const restart = useCallback(() => {
    request.current?.abort();
    request.current = undefined;
    lastInput.current = undefined;
    client.clearHandoff?.();
    setDraw(undefined);
    setReading(undefined);
    setError(undefined);
    setPendingBegin(false);
    setStage(client.target === "web" ? "setup" : "waiting");
  }, [client]);

  const retryBegin = () => {
    if (lastInput.current)
      void beginReading(lastInput.current).catch(() => undefined);
  };

  return {
    language,
    setLanguage,
    stage,
    setStage,
    draw,
    reading,
    error,
    pendingBegin,
    beginReading,
    confirm,
    restart,
    retryBegin,
  };
}
