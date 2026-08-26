import { useEffect, useRef } from "react";
import { t } from "./i18n.js";
import type { DrawClient, Language, ReadingCard } from "./types.js";
import { useCardImage } from "./useCardImage.js";

export function CardDetails({
  card,
  client,
  language,
  onClose,
}: {
  card: ReadingCard;
  client: DrawClient;
  language: Language;
  onClose(): void;
}) {
  const [source] = useCardImage(client, card);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
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
          {source ? (
            <img
              src={source}
              alt={card.displayName}
              className={card.orientation === "reversed" ? "is-reversed" : ""}
            />
          ) : (
            <div className="card-art-fallback">{card.displayName}</div>
          )}
        </div>
        <div className="dialog-copy">
          <p className="position-label">{card.position}</p>
          <h2 id="card-dialog-title">{card.displayName}</h2>
          <p className="orientation-label">
            {card.orientation === "reversed"
              ? t(language, "reversed")
              : t(language, "upright")}
          </p>
          {card.positionMeaning ? <p>{card.positionMeaning}</p> : null}
          {card.meaning ? <p>{card.meaning}</p> : null}
          {card.keywords?.length ? (
            <ul className="keyword-list">
              {card.keywords.map((keyword) => (
                <li key={keyword}>{keyword}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
