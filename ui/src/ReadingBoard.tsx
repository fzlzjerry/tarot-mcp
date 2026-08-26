import { useCallback, useEffect, useRef, useState } from "react";
import { CardDetails } from "./CardDetails.js";
import { ClothSlot, ReadingCloth } from "./ReadingCloth.js";
import { PositionKey } from "./PositionKey.js";
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

const REVEAL_STAGGER = 90;

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
        <span className="reading-card__face">
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
            <small>
              {card.orientation === "reversed"
                ? t(language, "reversed")
                : t(language, "upright")}
            </small>
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
}: {
  reading: ConfirmedReading;
  client: DrawClient;
  backImageUri?: string;
  language: Language;
  onRestart(): void;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [detailIndex, setDetailIndex] = useState<number>();
  const heading = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);
  const layout = layoutForSpread(reading.spreadType, reading.cards.length);
  const revealedCount = revealed.size;
  const allRevealed = revealedCount === reading.cards.length;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    [],
  );

  const closeDetails = useCallback(() => setDetailIndex(undefined), []);

  const turn = useCallback((index: number) => {
    setRevealed((current) => new Set([...current, index]));
  }, []);

  const revealNext = (): void => {
    const next = reading.cards.findIndex((_, index) => !revealed.has(index));
    if (next >= 0) turn(next);
  };

  const revealAll = (): void => {
    const pending = reading.cards
      .map((_, index) => index)
      .filter((index) => !revealed.has(index));
    if (prefersReducedMotion()) {
      setRevealed(new Set(reading.cards.map((_, index) => index)));
      return;
    }
    pending.forEach((cardIndex, order) => {
      timers.current.push(
        window.setTimeout(() => turn(cardIndex), order * REVEAL_STAGGER),
      );
    });
  };

  return (
    <main className="reading-shell">
      <header className="reading-header">
        <div>
          <p className="spread-label">{reading.spreadName}</p>
          <h1 ref={heading} tabIndex={-1}>
            {t(language, "revealTitle")}
          </h1>
          {reading.question ? <p>{reading.question}</p> : null}
        </div>
        <div className="reading-actions">
          {client.requestFullscreen &&
          (client.canRequestFullscreen?.() ?? true) ? (
            <button
              className="text-action"
              type="button"
              onClick={() => void client.requestFullscreen?.()}
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
        names={reading.cards.map(
          (card, index) => card.position ?? `#${index + 1}`,
        )}
      />

      <div className="reveal-toolbar">
        <span aria-live="polite">
          {revealedCount} / {reading.cards.length}
        </span>
        <div>
          <button
            className="text-action"
            type="button"
            onClick={revealNext}
            disabled={allRevealed}
          >
            {t(language, "revealNext")}
          </button>
          <button
            className="primary-action"
            type="button"
            onClick={revealAll}
            disabled={allRevealed}
          >
            {t(language, "revealAll")}
          </button>
        </div>
      </div>

      {allRevealed ? (
        <section className="interpretation-panel">
          <h2>{t(language, "interpretation")}</h2>
          <p>{reading.interpretation ?? t(language, "noInterpretation")}</p>
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
