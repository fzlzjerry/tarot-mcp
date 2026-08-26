import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ArcFanHandle } from "./ArcFan.js";
import { DrawStage } from "./DrawStage.js";
import { ReadingBoard } from "./ReadingBoard.js";
import { RitualStage } from "./RitualStage.js";
import { SetupForm } from "./SetupForm.js";
import { ritualOrder } from "./deck-order.js";
import { type FlipRect, prefersReducedMotion } from "./flip.js";
import { t } from "./i18n.js";
import { assertCompleteVisualDeck } from "./normalize.js";
import { toggleSelection, undoSelection } from "./selection.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  Language,
} from "./types.js";

interface DrawAppProps {
  client: DrawClient;
}

type Stage =
  "setup" | "waiting" | "ritual" | "selecting" | "confirming" | "reading";

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function DrawApp({ client }: DrawAppProps) {
  const [language, setLanguage] = useState<Language>(() =>
    navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en",
  );
  const [stage, setStage] = useState<Stage>(
    client.target === "web" && !client.startsWithHandoff?.()
      ? "setup"
      : "waiting",
  );
  const [draw, setDraw] = useState<BeginReadingPayload>();
  const [deckOrder, setDeckOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [origins, setOrigins] = useState<Record<string, FlipRect>>({});
  const [returning, setReturning] = useState<{
    slotId: string;
    target: FlipRect;
  }>();
  const [reading, setReading] = useState<ConfirmedReading>();
  const [error, setError] = useState<Error>();
  const [pendingBegin, setPendingBegin] = useState(false);
  const arcRef = useRef<ArcFanHandle | null>(null);

  const baseOrder = useMemo(
    () => draw?.slots.map((slot) => slot.slotId) ?? [],
    [draw],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const startDraw = useCallback((payload: BeginReadingPayload): void => {
    setDraw(payload);
    setLanguage(payload.language);
    setDeckOrder(payload.slots.map((slot) => slot.slotId));
    setSelected([]);
    setOrigins({});
    setReturning(undefined);
    setReading(undefined);
    setError(undefined);
    setStage("ritual");
  }, []);

  useEffect(() => {
    return client.subscribeInitial?.({
      onBegin(payload) {
        try {
          assertCompleteVisualDeck(payload);
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
      onError(nextError) {
        setError(nextError);
      },
    });
  }, [client, startDraw]);

  const beginReading = async (input: BeginReadingInput): Promise<void> => {
    setPendingBegin(true);
    setError(undefined);
    try {
      const payload = await client.beginReading(input);
      assertCompleteVisualDeck(payload);
      startDraw(payload);
    } catch (nextError) {
      setError(asError(nextError));
    } finally {
      setPendingBegin(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (!draw || selected.length !== draw.requiredCount) return;
    setStage("confirming");
    setError(undefined);
    try {
      const payload = await client.confirmReading(draw.drawId, selected);
      if (payload.cards.length !== draw.requiredCount) {
        throw new Error(
          `Expected ${draw.requiredCount} cards, received ${payload.cards.length}.`,
        );
      }
      setReading(payload);
      setStage("reading");
    } catch (nextError) {
      setError(asError(nextError));
      setStage("selecting");
    }
  };

  const restart = (): void => {
    client.clearHandoff?.();
    setDraw(undefined);
    setDeckOrder([]);
    setReading(undefined);
    setSelected([]);
    setOrigins({});
    setReturning(undefined);
    setError(undefined);
    setStage(client.target === "web" ? "setup" : "waiting");
  };

  const commitRemove = useCallback((slotId: string) => {
    setSelected((current) => current.filter((id) => id !== slotId));
    setOrigins(({ [slotId]: _removed, ...rest }) => rest);
    setReturning(undefined);
    arcRef.current?.focusSlot(slotId);
  }, []);

  /** Send a placed card back to the spread, flying it home when we can. */
  const removeCard = useCallback(
    (slotId: string) => {
      const target = arcRef.current?.rectFor(slotId);
      if (!target || prefersReducedMotion()) {
        commitRemove(slotId);
        return;
      }
      setReturning({ slotId, target });
    },
    [commitRemove],
  );

  const toggleCard = useCallback(
    (slotId: string, origin: FlipRect) => {
      if (!draw) return;
      if (selected.includes(slotId)) {
        removeCard(slotId);
        return;
      }
      if (selected.length >= draw.requiredCount) return;
      setOrigins((current) => ({ ...current, [slotId]: origin }));
      setSelected((current) =>
        toggleSelection(current, slotId, draw.requiredCount),
      );
    },
    [draw, removeCard, selected],
  );

  const forgetOrigin = useCallback((slotId: string) => {
    setOrigins(({ [slotId]: _consumed, ...rest }) => rest);
  }, []);

  const undo = useCallback(() => {
    const last = selected[selected.length - 1];
    if (last) removeCard(last);
    else setSelected((current) => undoSelection(current));
  }, [removeCard, selected]);

  const clearAll = useCallback(() => {
    setSelected([]);
    setOrigins({});
    setReturning(undefined);
  }, []);

  if (stage === "setup") {
    return (
      <>
        <SetupForm
          language={language}
          client={client}
          onLanguageChange={setLanguage}
          onSubmit={(input) => void beginReading(input)}
          isPending={pendingBegin}
        />
        {error ? (
          <ErrorBanner error={error} language={language} onRetry={restart} />
        ) : null}
      </>
    );
  }

  if (stage === "waiting") {
    return (
      <>
        <main className="waiting-shell" aria-live="polite">
          <span className="waiting-symbol">✦</span>
          <p>{t(language, "waiting")}</p>
        </main>
        {error ? (
          <ErrorBanner error={error} language={language} onRetry={restart} />
        ) : null}
      </>
    );
  }

  if (stage === "confirming") {
    return (
      <main
        className="waiting-shell confirming-shell"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="confirming-sigil" aria-hidden="true">
          <span className="confirming-sigil__orbit confirming-sigil__orbit--outer" />
          <span className="confirming-sigil__orbit confirming-sigil__orbit--inner" />
          <span className="confirming-sigil__star">✦</span>
        </span>
        <p>{t(language, "confirming")}</p>
      </main>
    );
  }

  if (stage === "reading" && reading) {
    return (
      <ReadingBoard
        reading={reading}
        client={client}
        backImageUri={reading.deckBackImageUri ?? draw?.deckBackImageUri}
        language={language}
        onRestart={restart}
      />
    );
  }

  if (!draw) {
    return (
      <ErrorBanner
        error={error ?? new Error("Missing draw data")}
        language={language}
        onRetry={restart}
      />
    );
  }

  if (stage === "ritual") {
    return (
      <>
        <RitualStage
          total={baseOrder.length}
          spreadName={draw.spreadName}
          deckBackImageUri={draw.deckBackImageUri}
          language={language}
          onReady={(cutIndex, entropy) => {
            setDeckOrder(ritualOrder(baseOrder, cutIndex, entropy));
            setStage("selecting");
          }}
          onSkip={() => {
            setDeckOrder(baseOrder);
            setStage("selecting");
          }}
        />
        {error ? (
          <ErrorBanner error={error} language={language} onRetry={restart} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <DrawStage
        draw={draw}
        deckOrder={deckOrder}
        selected={selected}
        origins={origins}
        returning={returning}
        arcRef={arcRef}
        onToggle={toggleCard}
        onRemove={removeCard}
        onOriginConsumed={forgetOrigin}
        onDeparted={commitRemove}
        onUndo={undo}
        onClear={clearAll}
        onConfirm={() => void confirm()}
        language={language}
      />
      {error ? (
        <ErrorBanner
          error={error}
          language={language}
          onRetry={() => void confirm()}
        />
      ) : null}
    </>
  );
}

function ErrorBanner({
  error,
  language,
  onRetry,
}: {
  error: Error;
  language: Language;
  onRetry(): void;
}) {
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>{t(language, "error")}</strong>
        <span>{error.message}</span>
      </div>
      <button type="button" onClick={onRetry}>
        {t(language, "tryAgain")}
      </button>
    </div>
  );
}
