import { useEffect, useRef } from "react";
import { CardPlate } from "./CardPlate.js";
import { readInitialDeckEdition } from "./deck-edition.js";
import { t } from "./i18n.js";
import type { DrawClient, Language, ReadingCard } from "./types.js";
import { useCardImage } from "./useCardImage.js";

export function CardDetails({
  card,
  client,
  language,
  onClose,
  onPrevious,
  onNext,
  counter,
}: {
  card: ReadingCard;
  client: DrawClient;
  language: Language;
  onClose(): void;
  onPrevious?(): void;
  onNext?(): void;
  counter?: { current: number; total: number };
}) {
  const [source] = useCardImage(client, card);
  const isShowingV2 =
    client.target === "mcp" || readInitialDeckEdition() === "v2";

  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const navRef = useRef({ onPrevious, onNext });
  navRef.current = { onPrevious, onNext };

  useEffect(() => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButton.current?.focus();
    const handleDialogKeys = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && navRef.current.onPrevious) {
        event.preventDefault();
        navRef.current.onPrevious();
        return;
      }
      if (event.key === "ArrowRight" && navRef.current.onNext) {
        event.preventDefault();
        navRef.current.onNext();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !dialog.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.current?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.removeEventListener("keydown", handleDialogKeys);
      opener.current?.focus();
    };
  }, [onClose]);

  const motifs =
    isShowingV2 && card.editionMotifs?.length
      ? card.editionMotifs
      : card.traditionMotifs;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialog}
        className="card-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-dialog-title"
      >
        <button
          ref={closeButton}
          type="button"
          className="dialog-close"
          onClick={onClose}
          aria-label={t(language, "close")}
        >
          ×
        </button>
        <div className="dialog-art">
          <CardPlate
            source={source}
            name={card.displayName}
            reversed={card.orientation === "reversed"}
          />
        </div>
        <div className="dialog-copy">
          <div className="dialog-meta-row">
            <p className="position-label">{card.position}</p>
            {counter && counter.total > 1 ? (
              <span className="dialog-counter">
                {t(language, "cardCounter", counter)}
              </span>
            ) : null}
          </div>
          <h2 id="card-dialog-title">{card.displayName}</h2>
          <p className="orientation-label">
            {card.orientation === "reversed"
              ? t(language, "reversed")
              : t(language, "upright")}
          </p>
          {card.positionMeaning ? <p>{card.positionMeaning}</p> : null}
          {card.meaning ? <p className="dialog-meaning">{card.meaning}</p> : null}
          {card.keywords?.length ? (
            <ul className="keyword-list">
              {card.keywords.map((keyword) => (
                <li key={keyword}>{keyword}</li>
              ))}
            </ul>
          ) : null}
          {motifs?.length ? (
            <div className="dialog-motifs">
              <h3>{t(language, "symbolismHeading")}</h3>
              <ul>
                {motifs.slice(0, 4).map((motif) => (
                  <li key={motif}>{motif}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {onPrevious || onNext ? (
            <div className="dialog-nav">
              <button
                type="button"
                className="text-action"
                onClick={onPrevious}
                disabled={!onPrevious}
                aria-label={t(language, "previousCard")}
              >
                ← {t(language, "previousCard")}
              </button>
              <button
                type="button"
                className="text-action"
                onClick={onNext}
                disabled={!onNext}
                aria-label={t(language, "nextCard")}
              >
                {t(language, "nextCard")} →
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
