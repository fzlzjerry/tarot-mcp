import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { t } from "./i18n.js";
import { assertCompleteVisualDeck } from "./normalize.js";
import { nextGridIndex, toggleSelection, undoSelection } from "./selection.js";
import { SPREAD_TEMPLATES, layoutForSpread } from "./spreads.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  Language,
  ReadingCard,
  ReadingKind,
} from "./types.js";

interface DrawAppProps {
  client: DrawClient;
}

type Stage = "setup" | "waiting" | "selecting" | "confirming" | "reading";

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function parseCustomPositions(value: string): string[] {
  return value
    .split("\n")
    .map((position) => position.trim())
    .filter(Boolean);
}

function SetupForm({
  language,
  client,
  onLanguageChange,
  onSubmit,
  isPending,
}: {
  language: Language;
  client: DrawClient;
  onLanguageChange(language: Language): void;
  onSubmit(input: BeginReadingInput): void;
  isPending: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [readingKind, setReadingKind] = useState<ReadingKind>("spread");
  const [spreadType, setSpreadType] = useState("three_card");
  const [customDate, setCustomDate] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPositions, setCustomPositions] = useState("");
  const [authToken, setAuthToken] = useState(
    () => client.getSessionToken?.() ?? "",
  );
  const [validation, setValidation] = useState<string | undefined>();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (readingKind !== "daily" && !question.trim()) {
      setValidation(t(language, "required"));
      return;
    }
    const positions = parseCustomPositions(customPositions);
    if (
      readingKind === "custom" &&
      (positions.length < 1 || positions.length > 15)
    ) {
      setValidation(t(language, "positionRange"));
      return;
    }
    setValidation(undefined);
    const normalizedQuestion = question.trim();
    if (readingKind === "daily") {
      onSubmit({
        readingKind,
        language,
        ...(normalizedQuestion ? { question: normalizedQuestion } : {}),
      });
    } else if (readingKind === "moon") {
      onSubmit({
        readingKind,
        question: normalizedQuestion,
        language,
        ...(customDate ? { customDate } : {}),
      });
    } else if (readingKind === "custom") {
      onSubmit({
        readingKind,
        question: normalizedQuestion,
        language,
        customSpread: {
          name: customName.trim() || t(language, "custom"),
          positions: positions.map((name) => ({ name, meaning: "" })),
        },
      });
    } else {
      onSubmit({
        readingKind,
        spreadType,
        question: normalizedQuestion,
        language,
      });
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="brand-mark" aria-hidden="true">
          ✦
        </div>
        <h1 id="setup-title">{t(language, "title")}</h1>
        <p className="setup-subtitle">{t(language, "subtitle")}</p>
        <form className="setup-form" onSubmit={submit} noValidate>
          <label className="field field--wide">
            <span>{t(language, "question")}</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t(language, "questionPlaceholder")}
              rows={3}
              maxLength={2000}
              autoFocus
              required={readingKind !== "daily"}
            />
          </label>
          <label className="field">
            <span>{t(language, "readingKind")}</span>
            <select
              value={readingKind}
              onChange={(event) =>
                setReadingKind(event.target.value as ReadingKind)
              }
            >
              <option value="spread">{t(language, "kindSpread")}</option>
              <option value="daily">{t(language, "kindDaily")}</option>
              <option value="moon">{t(language, "kindMoon")}</option>
              <option value="custom">{t(language, "kindCustom")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t(language, "language")}</span>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as Language)
              }
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {readingKind === "spread" ? (
            <label className="field field--wide">
              <span>{t(language, "spread")}</span>
              <select
                value={spreadType}
                onChange={(event) => setSpreadType(event.target.value)}
              >
                {SPREAD_TEMPLATES.map((spread) => (
                  <option key={spread.id} value={spread.id}>
                    {spread.name[language]} · {spread.positions.length}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {readingKind === "moon" ? (
            <label className="field field--wide">
              <span>{t(language, "moonDate")}</span>
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
            </label>
          ) : null}
          {readingKind === "custom" ? (
            <>
              <label className="field field--wide">
                <span>{t(language, "customName")}</span>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder={t(language, "customNamePlaceholder")}
                  maxLength={100}
                />
              </label>
              <label className="field field--wide">
                <span>{t(language, "customPositions")}</span>
                <textarea
                  value={customPositions}
                  onChange={(event) => setCustomPositions(event.target.value)}
                  placeholder={t(language, "customPositionsPlaceholder")}
                  rows={6}
                />
              </label>
            </>
          ) : null}
          {client.target === "web" && client.setSessionToken ? (
            <details className="settings-panel field--wide">
              <summary>{t(language, "connectionSettings")}</summary>
              <label className="field">
                <span>{t(language, "bearerToken")}</span>
                <input
                  type="password"
                  value={authToken}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t(language, "bearerTokenPlaceholder")}
                  onChange={(event) => {
                    const token = event.target.value;
                    setAuthToken(token);
                    client.setSessionToken?.(token);
                  }}
                />
                <small>{t(language, "sessionOnly")}</small>
              </label>
            </details>
          ) : null}
          {validation ? (
            <p className="form-error" role="alert">
              {validation}
            </p>
          ) : null}
          <button
            className="primary-action field--wide"
            type="submit"
            disabled={isPending}
          >
            {isPending ? t(language, "beginning") : t(language, "begin")}
          </button>
        </form>
      </section>
    </main>
  );
}

const FAN_ROW_SIZE = 22;
const FAN_CARD_STEP = 56;

function cardBackStyle(uri: string | undefined): CSSProperties | undefined {
  return uri
    ? ({
        "--deck-back-image": `url("${uri.replaceAll('"', "%22")}")`,
      } as CSSProperties)
    : undefined;
}

function SelectionStaging({
  draw,
  selected,
  onRemove,
  language,
}: {
  draw: BeginReadingPayload;
  selected: string[];
  onRemove(slotId: string): void;
  language: Language;
}) {
  const layout = layoutForSpread(draw.spreadType, draw.requiredCount);
  return (
    <section className="selection-staging" aria-labelledby="staging-title">
      <div className="selection-staging__header">
        <h2 id="staging-title">{t(language, "spreadPositions")}</h2>
        <p>{t(language, "stagingHint")}</p>
      </div>
      <div className="selection-staging__board">
        {Array.from({ length: draw.requiredCount }, (_, index) => {
          const point = layout[index];
          const slotId = selected[index];
          const positionName = draw.positions?.[index]?.name ?? `#${index + 1}`;
          const style = {
            "--card-x": `${point?.x ?? 50}%`,
            "--card-y": `${point?.y ?? 50}%`,
            "--card-rotation": `${point?.rotation ?? 0}deg`,
            "--card-layer": point?.layer ?? index,
          } as CSSProperties;
          return (
            <div
              className="staged-position"
              style={style}
              key={`${positionName}-${index}`}
            >
              {slotId ? (
                <button
                  type="button"
                  className="staged-card"
                  style={cardBackStyle(draw.deckBackImageUri)}
                  onClick={() => onRemove(slotId)}
                  aria-label={t(language, "removeFromPosition", {
                    number: index + 1,
                    position: positionName,
                  })}
                >
                  <span>{index + 1}</span>
                </button>
              ) : (
                <div
                  className="staged-card staged-card--empty"
                  aria-hidden="true"
                >
                  <span>{index + 1}</span>
                </div>
              )}
              <span className="staged-position__label">{positionName}</span>
            </div>
          );
        })}
      </div>
      <ol
        className="mobile-position-key"
        aria-label={t(language, "spreadPositions")}
      >
        {Array.from({ length: draw.requiredCount }, (_, index) => (
          <li key={`${draw.positions?.[index]?.name ?? "position"}-${index}`}>
            <strong>{index + 1}</strong>
            <span>{draw.positions?.[index]?.name ?? `#${index + 1}`}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Deck({
  draw,
  selected,
  onToggle,
  onUndo,
  onClear,
  onConfirm,
  language,
}: {
  draw: BeginReadingPayload;
  selected: string[];
  onToggle(slotId: string): void;
  onUndo(): void;
  onClear(): void;
  onConfirm(): void;
  language: Language;
}) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const deckButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusIndex = useRef<number | undefined>(undefined);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const remaining = draw.requiredCount - selected.length;
  const complete = remaining === 0;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const index = restoreFocusIndex.current;
    if (index === undefined) return;
    restoreFocusIndex.current = undefined;
    setFocusedIndex(index);
    deckButtons.current[index]?.focus();
  }, [selected]);

  const removeStagedCard = (slotId: string): void => {
    const index = draw.slots.findIndex((slot) => slot.slotId === slotId);
    if (index >= 0) restoreFocusIndex.current = index;
    onToggle(slotId);
  };

  const onFanKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const current = Number(target.dataset.slotIndex);
    if (Number.isNaN(current)) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      onUndo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && complete) {
      event.preventDefault();
      onConfirm();
      return;
    }
    const next = nextGridIndex(
      current,
      event.key,
      draw.slots.length,
      FAN_ROW_SIZE,
    );
    if (next !== current) {
      event.preventDefault();
      setFocusedIndex(next);
      deckButtons.current[next]?.focus();
    }
  };

  const rows = Array.from(
    { length: Math.ceil(draw.slots.length / FAN_ROW_SIZE) },
    (_, rowIndex) =>
      draw.slots.slice(rowIndex * FAN_ROW_SIZE, (rowIndex + 1) * FAN_ROW_SIZE),
  );

  return (
    <main className="draw-shell">
      <header className="draw-header">
        <div>
          <p className="spread-label">{draw.spreadName}</p>
          <h1 ref={heading} tabIndex={-1}>
            {t(language, "selectTitle")}
          </h1>
          <p>{t(language, "chooseExactly", { count: draw.requiredCount })}</p>
        </div>
        <div
          className="selection-meter"
          aria-label={`${selected.length} / ${draw.requiredCount}`}
        >
          <strong>{selected.length}</strong>
          <span>
            / {draw.requiredCount} {t(language, "selected")}
          </span>
        </div>
      </header>

      <SelectionStaging
        draw={draw}
        selected={selected}
        onRemove={removeStagedCard}
        language={language}
      />

      <section className="deck-section" aria-labelledby="deck-title">
        <div className="deck-section__header">
          <h2 id="deck-title">{t(language, "deckTitle")}</h2>
          <p>{t(language, "fanHint")}</p>
        </div>
        <p className="sr-only" id="deck-help">
          {t(language, "keyboardHint")}
        </p>
        <div
          className="deck-fan"
          role="group"
          aria-describedby="deck-help deck-status"
          onKeyDown={onFanKeyDown}
        >
          {rows.map((row, rowIndex) => (
            <div
              className="deck-fan__row"
              key={rowIndex}
              style={{
                width: `${Math.max(0, row.length - 1) * FAN_CARD_STEP + 88}px`,
              }}
              aria-hidden={row.length === 0}
            >
              {row.map((slot, columnIndex) => {
                const index = rowIndex * FAN_ROW_SIZE + columnIndex;
                const center = Math.max(1, (row.length - 1) / 2);
                const normalized = (columnIndex - center) / center;
                const order = selected.indexOf(slot.slotId);
                const isSelected = selectedSet.has(slot.slotId);
                const atLimit =
                  selected.length >= draw.requiredCount && !isSelected;
                const style = {
                  ...cardBackStyle(draw.deckBackImageUri),
                  "--fan-left": `${columnIndex * FAN_CARD_STEP}px`,
                  "--fan-y": `${Math.pow(Math.abs(normalized), 1.6) * 28}px`,
                  "--fan-rotation": `${normalized * 4}deg`,
                  "--fan-layer": isSelected ? 100 : columnIndex,
                } as CSSProperties;
                return (
                  <button
                    className={`deck-card${isSelected ? " is-selected" : ""}`}
                    key={slot.slotId}
                    type="button"
                    ref={(element) => {
                      deckButtons.current[index] = element;
                    }}
                    style={style}
                    data-slot-index={index}
                    tabIndex={index === focusedIndex ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-disabled={atLimit}
                    aria-label={
                      isSelected
                        ? `${t(language, "deckCard", { number: index + 1 })}, ${t(language, "selectedOrder", { number: order + 1 })}`
                        : t(language, "deckCard", { number: index + 1 })
                    }
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => !atLimit && onToggle(slot.slotId)}
                  >
                    {isSelected ? (
                      <span className="selection-order" aria-hidden="true">
                        {order + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <div className="draw-toolbar">
        <p
          id="deck-status"
          className={complete ? "status-complete" : ""}
          aria-live="polite"
        >
          {complete
            ? t(language, "selectionComplete")
            : t(language, "selectionRemaining", { count: remaining })}
        </p>
        <div className="toolbar-actions">
          <button
            type="button"
            className="text-action"
            onClick={onUndo}
            disabled={selected.length === 0}
          >
            {t(language, "undo")}
          </button>
          <button
            type="button"
            className="text-action"
            onClick={onClear}
            disabled={selected.length === 0}
          >
            {t(language, "reset")}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={onConfirm}
            disabled={!complete}
          >
            {t(language, "confirm")}
          </button>
        </div>
      </div>
    </main>
  );
}

function useCardImage(
  client: DrawClient,
  card: ReadingCard,
): [string | undefined, boolean] {
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void client
      .resolveImage?.(card)
      .then((value) => {
        if (active) setSource(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [card, client]);
  return [source, failed];
}

function ReadingCardView({
  card,
  client,
  cardIndex,
  backImageUri,
  revealed,
  onOpen,
  language,
}: {
  card: ReadingCard;
  client: DrawClient;
  cardIndex: number;
  backImageUri?: string;
  revealed: boolean;
  onOpen(): void;
  language: Language;
}) {
  const [source, failed] = useCardImage(client, card);
  const [imageFailed, setImageFailed] = useState(false);
  const showFallback = failed || imageFailed || !source;
  return (
    <button
      type="button"
      className={`reading-card${revealed ? " is-revealed" : ""}`}
      onClick={() => revealed && onOpen()}
      disabled={!revealed}
      tabIndex={revealed ? 0 : -1}
      aria-label={
        revealed
          ? `${card.displayName}. ${t(language, "details")}`
          : t(language, "deckCard", { number: cardIndex + 1 })
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

function CardDetails({
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
          <p className="spread-label">{card.position}</p>
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

function ReadingBoard({
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
  const layout = layoutForSpread(reading.spreadType, reading.cards.length);
  const revealedCount = revealed.size;
  const allRevealed = revealedCount === reading.cards.length;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, []);

  const closeDetails = useCallback(() => setDetailIndex(undefined), []);

  const revealNext = (): void => {
    const next = reading.cards.findIndex((_, index) => !revealed.has(index));
    if (next >= 0) setRevealed((current) => new Set([...current, next]));
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

      <section className="spread-board" aria-label={reading.spreadName}>
        {reading.cards.map((card, index) => {
          const position = layout[index];
          const style = {
            "--card-x": `${position?.x ?? 50}%`,
            "--card-y": `${position?.y ?? 50}%`,
            "--card-rotation": `${position?.rotation ?? 0}deg`,
            "--card-layer": position?.layer ?? index,
          } as CSSProperties;
          return (
            <div
              className="spread-card"
              style={style}
              key={`${card.id}-${index}`}
            >
              <ReadingCardView
                card={card}
                client={client}
                cardIndex={index}
                backImageUri={backImageUri}
                revealed={revealed.has(index)}
                onOpen={() => setDetailIndex(index)}
                language={language}
              />
              <span className="position-caption">
                {card.position ?? `#${index + 1}`}
              </span>
            </div>
          );
        })}
      </section>
      <ol
        className="mobile-position-key"
        aria-label={t(language, "spreadPositions")}
      >
        {reading.cards.map((card, index) => (
          <li key={`${card.id}-${index}`}>
            <strong>{index + 1}</strong>
            <span>{card.position ?? `#${index + 1}`}</span>
          </li>
        ))}
      </ol>

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
            onClick={() =>
              setRevealed(new Set(reading.cards.map((_, index) => index)))
            }
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
  const [selected, setSelected] = useState<string[]>([]);
  const [reading, setReading] = useState<ConfirmedReading>();
  const [error, setError] = useState<Error>();
  const [pendingBegin, setPendingBegin] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    return client.subscribeInitial?.({
      onBegin(payload) {
        try {
          assertCompleteVisualDeck(payload);
          setDraw(payload);
          setLanguage(payload.language);
          setSelected([]);
          setReading(undefined);
          setError(undefined);
          setStage("selecting");
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
  }, [client]);

  const beginReading = async (input: BeginReadingInput): Promise<void> => {
    setPendingBegin(true);
    setError(undefined);
    try {
      const payload = await client.beginReading(input);
      assertCompleteVisualDeck(payload);
      setDraw(payload);
      setLanguage(payload.language);
      setSelected([]);
      setReading(undefined);
      setStage("selecting");
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
    setReading(undefined);
    setSelected([]);
    setError(undefined);
    setStage(client.target === "web" ? "setup" : "waiting");
  };

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
      <main className="waiting-shell" aria-live="polite">
        <span className="waiting-symbol is-spinning">✦</span>
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

  return (
    <>
      <Deck
        draw={draw}
        selected={selected}
        onToggle={(slotId) =>
          setSelected((current) =>
            toggleSelection(current, slotId, draw.requiredCount),
          )
        }
        onUndo={() => setSelected((current) => undoSelection(current))}
        onClear={() => setSelected([])}
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
