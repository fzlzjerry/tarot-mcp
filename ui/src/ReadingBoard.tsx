import { useCallback, useEffect, useRef, useState } from "react";
import { CardDetails } from "./CardDetails.js";
import { ClothSlot, ReadingCloth } from "./ReadingCloth.js";
import { PositionKey } from "./PositionKey.js";
import { ReadingInterpretation } from "./ReadingInterpretation.js";
import { RitualProgress } from "./RitualProgress.js";
import { cardBackStyle } from "./card-style.js";
import { prefersReducedMotion } from "./flip.js";
import { t } from "./i18n.js";
import { layoutForSpread } from "./spreads.js";
import type {
  ConfirmedReading,
  DrawClient,
  Language,
  ReadingCard,
} from "./types.js";
import { useCardImage } from "./useCardImage.js";
import { FullscreenNotice, useFullscreen } from "./useFullscreen.js";

const REVEAL_STAGGER = 90;

interface RevealState {
  revealed: Set<number>;
  /** The card most recently turned, for the live announcement. */
  announced?: number;
}

/**
 * Local outcome of handing the finished reading back to the host. A lost
 * response cannot prove the message was not delivered, so "failed" keeps the
 * cards and asks the user to check the conversation before retrying.
 */
type Continuation =
  | { status: "idle" | "sending" | "sent" | "queued" | "unsupported" }
  | { status: "failed"; detail: string };

function orientationLabel(language: Language, card: ReadingCard): string {
  return t(language, card.orientation === "reversed" ? "reversed" : "upright");
}

function ReadingCardView({
  card,
  client,
  cardIndex,
  backImageUri,
  revealed,
  onOpen,
  onTurn,
  language,
}: {
  card: ReadingCard;
  client: DrawClient;
  cardIndex: number;
  backImageUri?: string;
  revealed: boolean;
  onOpen(): void;
  onTurn(): void;
  language: Language;
}) {
  const [source, failed] = useCardImage(client, card);
  const [imageFailed, setImageFailed] = useState(false);
  const showFallback = failed || imageFailed || !source;
  return (
    <button
      type="button"
      className={`reading-card${revealed ? " is-revealed" : ""}`}
      onClick={() => (revealed ? onOpen() : onTurn())}
      aria-label={
        revealed
          ? `${card.displayName}. ${t(language, "details")}`
          : t(language, "turnCard", { number: cardIndex + 1 })
      }
    >
      <span className="reading-card__index" aria-hidden="true">
        {cardIndex + 1}
      </span>
      <span className="reading-card__inner">
        <span
          className="reading-card__back"
          style={cardBackStyle(backImageUri)}
          aria-hidden="true"
        />
        {/* The face stays out of the accessibility tree until it is turned. */}
        <span className="reading-card__face" aria-hidden={!revealed}>
          {showFallback ? (
            <span className="card-art-fallback">{card.displayName}</span>
          ) : (
            <img
              src={source}
              alt=""
              className={card.orientation === "reversed" ? "is-reversed" : ""}
              onError={() => setImageFailed(true)}
            />
          )}
          <span className="reading-card__caption">
            <strong>{card.displayName}</strong>
            <small>{orientationLabel(language, card)}</small>
          </span>
        </span>
      </span>
    </button>
  );
}

export function ReadingBoard({
  reading,
  client,
  backImageUri,
  language,
  onRestart,
  initialRevealedIndices,
  initialContinuationSent = false,
  onUiCheckpoint,
}: {
  reading: ConfirmedReading;
  client: DrawClient;
  backImageUri?: string;
  language: Language;
  onRestart(): void;
  initialRevealedIndices?: number[];
  initialContinuationSent?: boolean;
  onUiCheckpoint?(revealedIndices: number[], continuationSent: boolean): void;
}) {
  const [{ revealed, announced }, setReveal] = useState<RevealState>(() => ({
    revealed: new Set(initialRevealedIndices),
  }));
  const [revealingAll, setRevealingAll] = useState(false);
  const [continuation, setContinuation] = useState<Continuation>(() => ({
    status: initialContinuationSent ? "sent" : "idle",
  }));
  const [detailIndex, setDetailIndex] = useState<number>();
  const heading = useRef<HTMLHeadingElement>(null);
  const fullscreen = useFullscreen(client);
  const interpretationHeading = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);
  const batchActive = useRef(false);
  const sendInFlight = useRef(false);
  const mounted = useRef(true);
  const layout = layoutForSpread(reading.spreadType, reading.cards.length);
  const revealedCount = revealed.size;
  const allRevealed = revealedCount === reading.cards.length;
  const continueReading = client.continueReading;
  const checkpoint = useRef(onUiCheckpoint);
  checkpoint.current = onUiCheckpoint;
  const continuationSent = continuation.status === "sent";

  useEffect(() => {
    try {
      checkpoint.current?.([...revealed], continuationSent);
    } catch (error) {
      setContinuation({
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }, [revealed, continuationSent]);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
      batchActive.current = false;
    };
  }, []);

  // When the control the user just pressed leaves the page, park focus on the
  // interpretation heading instead of letting it drop to the body. A user who
  // has already moved to a control that still exists keeps that focus.
  useEffect(() => {
    if (!allRevealed) return;
    if (continuation.status === "sending") return;
    const active = document.activeElement;
    if (!active || active === document.body) {
      interpretationHeading.current?.focus();
    }
  }, [allRevealed, continuation.status]);

  const closeDetails = useCallback(() => setDetailIndex(undefined), []);

  const turn = useCallback((index: number) => {
    setReveal((current) =>
      current.revealed.has(index)
        ? current
        : { revealed: new Set([...current.revealed, index]), announced: index },
    );
  }, []);

  const revealNext = (): void => {
    if (batchActive.current) return;
    const next = reading.cards.findIndex((_, index) => !revealed.has(index));
    if (next >= 0) turn(next);
  };

  const revealAll = (): void => {
    if (batchActive.current) return;
    const pending = reading.cards
      .map((_, index) => index)
      .filter((index) => !revealed.has(index));
    if (pending.length === 0) return;
    if (prefersReducedMotion()) {
      setReveal({ revealed: new Set(reading.cards.map((_, index) => index)) });
      return;
    }
    batchActive.current = true;
    setRevealingAll(true);
    pending.forEach((cardIndex, order) => {
      timers.current.push(
        window.setTimeout(() => {
          turn(cardIndex);
          if (order === pending.length - 1) {
            timers.current = [];
            batchActive.current = false;
            setRevealingAll(false);
          }
        }, order * REVEAL_STAGGER),
      );
    });
  };

  const requestInterpretation = (): void => {
    if (
      !continueReading ||
      !allRevealed ||
      continuationSent ||
      sendInFlight.current
    )
      return;
    sendInFlight.current = true;
    setContinuation({ status: "sending" });
    void (async () => {
      try {
        // Persist the result before either host bridge can remount the iframe.
        const revealedIndices = [...revealed];
        checkpoint.current?.(revealedIndices, false);
        const outcome = await continueReading.call(client, reading);
        if (outcome === "sent") checkpoint.current?.(revealedIndices, true);
        if (mounted.current) setContinuation({ status: outcome });
      } catch (error) {
        if (mounted.current) {
          setContinuation({
            status: "failed",
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        sendInFlight.current = false;
      }
    })();
  };

  const describeTurn = (index: number): string => {
    const card = reading.cards[index];
    const sentence = t(language, "revealedCard", {
      number: index + 1,
      name: card.displayName,
      orientation: orientationLabel(language, card),
    });
    return card.position ? `${card.position}. ${sentence}` : sentence;
  };
  const turnAnnouncement =
    announced === undefined ? undefined : describeTurn(announced);
  const announcement = allRevealed
    ? [turnAnnouncement, t(language, "allRevealed")].filter(Boolean).join(" ")
    : (turnAnnouncement ?? "");

  // The position list beneath the cloth carries every card at a full-size
  // target: it turns a face-down card and opens a turned one, and it is the
  // only place a narrow screen shows the name and orientation. Its labels
  // lead with the position so they read apart from the cards on the cloth.
  const positions = reading.cards.map((card, index) => {
    if (revealed.has(index)) {
      return {
        name: card.position ?? `#${index + 1}`,
        value: `${card.displayName} · ${orientationLabel(language, card)}`,
        action: {
          label: `${describeTurn(index)} ${t(language, "details")}`,
          onActivate: () => setDetailIndex(index),
        },
      };
    }
    const turnLabel = t(language, "turnCard", { number: index + 1 });
    return {
      name: card.position ?? `#${index + 1}`,
      value: undefined,
      action: {
        label: card.position ? `${card.position}. ${turnLabel}` : turnLabel,
        onActivate: () => turn(index),
      },
    };
  });

  const continuationMessage =
    continuation.status === "sending"
      ? t(language, "interpretationSending")
      : continuation.status === "sent"
        ? t(language, "interpretationSent")
        : continuation.status === "queued"
          ? t(language, "interpretationQueued")
          : continuation.status === "unsupported"
            ? t(language, "interpretationUnsupported")
            : undefined;
  // The outcome messages already say where the interpretation lives; only the
  // idle and sending states still need the generic pointer to the conversation.
  const showInterpretationFallback =
    !reading.interpretation &&
    (!continueReading ||
      continuation.status === "idle" ||
      continuation.status === "sending");

  return (
    <main className="reading-shell">
      <RitualProgress
        current={allRevealed ? "interpret" : "reveal"}
        language={language}
      />
      <header className="reading-header">
        <div>
          <p className="spread-label">{reading.spreadName}</p>
          <h1 ref={heading} tabIndex={-1}>
            {t(language, "revealTitle")}
          </h1>
          {reading.question ? <p>{reading.question}</p> : null}
        </div>
        <div className="reading-actions">
          {fullscreen.available ? (
            <button
              className="text-action"
              type="button"
              onClick={fullscreen.request}
              disabled={fullscreen.requesting}
            >
              {t(language, "fullscreen")}
            </button>
          ) : null}
          <button className="text-action" type="button" onClick={onRestart}>
            {t(language, "restart")}
          </button>
        </div>
      </header>

      <ReadingCloth label={reading.spreadName} cardCount={reading.cards.length}>
        {reading.cards.map((card, index) => (
          <ClothSlot
            key={`${card.id}-${index}`}
            point={layout[index]}
            index={index}
          >
            <ReadingCardView
              card={card}
              client={client}
              cardIndex={index}
              backImageUri={backImageUri}
              revealed={revealed.has(index)}
              onOpen={() => setDetailIndex(index)}
              onTurn={() => turn(index)}
              language={language}
            />
            <span className="slot-caption">
              {card.position ?? `#${index + 1}`}
            </span>
          </ClothSlot>
        ))}
      </ReadingCloth>
      <PositionKey
        language={language}
        names={positions.map(({ name }) => name)}
        values={positions.map(({ value }) => value)}
        actions={positions.map(({ action }) => action)}
      />

      <p className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </p>
      {fullscreen.failure !== undefined ? (
        <FullscreenNotice detail={fullscreen.failure} language={language} />
      ) : null}
      {!allRevealed ? (
        <div className="reveal-toolbar" aria-busy={revealingAll}>
          <span>{`${revealedCount} / ${reading.cards.length}`}</span>
          <div>
            <button
              className="primary-action"
              type="button"
              onClick={revealNext}
              disabled={revealingAll}
            >
              {t(language, "revealNext")}
            </button>
            <button
              className="text-action"
              type="button"
              onClick={revealAll}
              disabled={revealingAll}
            >
              {t(language, "revealAll")}
            </button>
          </div>
        </div>
      ) : null}

      {allRevealed ? (
        <section
          className="interpretation-panel"
          aria-labelledby="interpretation-title"
        >
          <h2
            id="interpretation-title"
            ref={interpretationHeading}
            tabIndex={-1}
          >
            {t(language, "interpretation")}
          </h2>
          <p>{t(language, "allRevealed")}</p>
          {continueReading ? (
            <>
              <div role="status">
                {continuationMessage ? <p>{continuationMessage}</p> : null}
              </div>
              {continuation.status === "idle" ||
              continuation.status === "sending" ||
              continuation.status === "queued" ? (
                <p>
                  <button
                    className="primary-action"
                    type="button"
                    onClick={requestInterpretation}
                    disabled={continuation.status === "sending"}
                    aria-busy={continuation.status === "sending"}
                  >
                    {t(
                      language,
                      continuation.status === "queued"
                        ? "interpretAgain"
                        : "interpretInChat",
                    )}
                  </button>
                </p>
              ) : null}
              {continuation.status === "failed" ? (
                <div className="error-banner" role="alert">
                  <div>
                    <strong>{t(language, "interpretationFailed")}</strong>
                    {continuation.detail ? (
                      <span>{continuation.detail}</span>
                    ) : null}
                  </div>
                  <div className="error-banner__actions">
                    <button type="button" onClick={requestInterpretation}>
                      {t(language, "tryAgain")}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {reading.interpretation ? (
            <ReadingInterpretation text={reading.interpretation} />
          ) : showInterpretationFallback ? (
            <p>
              {t(
                language,
                client.target === "web"
                  ? "noWebInterpretation"
                  : "noInterpretation",
              )}
            </p>
          ) : null}
        </section>
      ) : null}

      {detailIndex !== undefined ? (
        <CardDetails
          card={reading.cards[detailIndex]}
          client={client}
          language={language}
          onClose={closeDetails}
        />
      ) : null}
    </main>
  );
}
