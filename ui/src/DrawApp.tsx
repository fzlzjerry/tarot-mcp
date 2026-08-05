import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArcFan, type ArcFanHandle } from "./ArcFan.js";
import { ClothSlot, ReadingCloth } from "./ReadingCloth.js";
import { RitualStage } from "./RitualStage.js";
import { ritualOrder } from "./deck-order.js";
import { type FlipRect, prefersReducedMotion } from "./flip.js";
import { t } from "./i18n.js";
import { assertCompleteVisualDeck } from "./normalize.js";
import { toggleSelection, undoSelection } from "./selection.js";
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

type Stage = "setup" | "waiting" | "ritual" | "selecting" | "confirming" | "reading";

/** Gap between cards as the spread turns itself over. */
const REVEAL_STAGGER = 90;

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function parseCustomPositions(value: string): string[] {
  return value
    .split("\n")
    .map((position) => position.trim())
    .filter(Boolean);
}

function cardBackStyle(uri: string | undefined): CSSProperties | undefined {
  return uri
    ? ({
        "--deck-back-image": `url("${uri.replaceAll('"', "%22")}")`,
      } as CSSProperties)
    : undefined;
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

function PositionKey({
  language,
  names,
}: {
  language: Language;
  names: string[];
}) {
  return (
    <ol className="mobile-position-key" aria-label={t(language, "spreadPositions")}>
      {names.map((name, index) => (
        <li key={`${name}-${index}`}>
          <strong>{index + 1}</strong>
          <span>{name}</span>
        </li>
      ))}
    </ol>
  );
}

function SelectionStaging({
  draw,
  selected,
  origins,
  returning,
  onRemove,
  onOriginConsumed,
  onDeparted,
  language,
}: {
  draw: BeginReadingPayload;
  selected: string[];
  origins: Record<string, FlipRect>;
  returning?: { slotId: string; target: FlipRect };
  onRemove(slotId: string): void;
  onOriginConsumed(slotId: string): void;
  onDeparted(slotId: string): void;
  language: Language;
}) {
  const layout = layoutForSpread(draw.spreadType, draw.requiredCount);
  const names = Array.from(
    { length: draw.requiredCount },
    (_, index) => draw.positions?.[index]?.name ?? `#${index + 1}`,
  );
  return (
    <div className="staging">
      <div className="staging__header">
        <h2 id="staging-title">{t(language, "spreadPositions")}</h2>
        <p>{t(language, "stagingHint")}</p>
      </div>
      <ReadingCloth label={t(language, "spreadPositions")} size="compact">
        {names.map((positionName, index) => {
          const slotId = selected[index];
          return (
            <ClothSlot
              key={`${positionName}-${index}`}
              point={layout[index]}
              index={index}
              origin={slotId ? origins[slotId] : undefined}
              onOriginConsumed={
                slotId ? () => onOriginConsumed(slotId) : undefined
              }
              departingTo={
                slotId && returning?.slotId === slotId
                  ? returning.target
                  : undefined
              }
              onDeparted={slotId ? () => onDeparted(slotId) : undefined}
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
                <div className="staged-card staged-card--empty" aria-hidden="true">
                  <span>{index + 1}</span>
                </div>
              )}
              <span className="slot-caption">{positionName}</span>
            </ClothSlot>
          );
        })}
      </ReadingCloth>
      <PositionKey language={language} names={names} />
    </div>
  );
}

function DrawStage({
  draw,
  deckOrder,
  selected,
  origins,
  returning,
  arcRef,
  onToggle,
  onRemove,
  onOriginConsumed,
  onDeparted,
  onUndo,
  onClear,
  onConfirm,
  language,
}: {
  draw: BeginReadingPayload;
  deckOrder: string[];
  selected: string[];
  origins: Record<string, FlipRect>;
  returning?: { slotId: string; target: FlipRect };
  arcRef: React.RefObject<ArcFanHandle | null>;
  onToggle(slotId: string, origin: FlipRect): void;
  onRemove(slotId: string): void;
  onOriginConsumed(slotId: string): void;
  onDeparted(slotId: string): void;
  onUndo(): void;
  onClear(): void;
  onConfirm(): void;
  language: Language;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const remaining = draw.requiredCount - selected.length;
  const complete = remaining === 0;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, []);

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
        origins={origins}
        returning={returning}
        onRemove={onRemove}
        onOriginConsumed={onOriginConsumed}
        onDeparted={onDeparted}
        language={language}
      />

      <section className="deck-section" aria-labelledby="deck-title">
        <div className="deck-section__header">
          <h2 id="deck-title">{t(language, "deckTitle")}</h2>
          <p>{t(language, "arcHint")}</p>
        </div>
        <p className="sr-only" id="deck-help">
          {t(language, "keyboardHint")}
        </p>
        <ArcFan
          ref={arcRef}
          slotIds={deckOrder}
          selected={selected}
          requiredCount={draw.requiredCount}
          deckBackImageUri={draw.deckBackImageUri}
          language={language}
          onToggle={onToggle}
          onUndo={onUndo}
          onConfirm={onConfirm}
        />
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

      <ReadingCloth label={reading.spreadName}>
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
