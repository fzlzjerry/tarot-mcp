import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { ArcFan, type ArcFanHandle } from "./ArcFan.js";
import { ClothSlot, ReadingCloth } from "./ReadingCloth.js";
import { PositionKey } from "./PositionKey.js";
import { RitualProgress } from "./RitualProgress.js";
import { cardBackStyle } from "./card-style.js";
import { t } from "./i18n.js";
import { layoutForSpread } from "./spreads.js";
import { FullscreenNotice, useFullscreen } from "./useFullscreen.js";
import type { FlipRect } from "./flip.js";
import type { BeginReadingPayload, DrawClient, Language } from "./types.js";

function SelectionStaging({
  draw,
  selected,
  origins,
  returning,
  locked,
  onRemove,
  onOriginConsumed,
  onDeparted,
  language,
}: {
  draw: BeginReadingPayload;
  selected: string[];
  origins: Record<string, FlipRect>;
  returning?: { slotId: string; target: FlipRect };
  locked: boolean;
  onRemove(slotId: string): void;
  onOriginConsumed(slotId: string): void;
  onDeparted(slotId: string): void;
  language: Language;
}) {
  const layout = layoutForSpread(draw.spreadType, draw.requiredCount);
  let verticalInset = 50;
  for (const point of layout) {
    verticalInset = Math.min(verticalInset, point.y, 100 - point.y);
  }
  // A card is 1.5 times as tall as it is wide. Clear half its height at
  // the nearest rim without moving any of the canonical percentage positions.
  const compactHeightRatio = 75 / Math.max(1, verticalInset) + 0.1;
  const names = Array.from(
    { length: draw.requiredCount },
    (_, index) => draw.positions?.[index]?.name ?? `#${index + 1}`,
  );
  const remove = (slotId: string): void => {
    if (locked) return;
    onRemove(slotId);
  };
  // The visual card and the list beneath the cloth share one action per
  // staged position, so a card that is tiny or overlapped is never the only
  // way back to the deck.
  const positions = names.map((name, index) => {
    const slotId = selected[index];
    const action = slotId
      ? {
          label: t(language, "removeFromPosition", {
            number: index + 1,
            position: name,
          }),
          onActivate: () => remove(slotId),
          disabled: locked,
        }
      : undefined;
    return { name, slotId, action };
  });
  return (
    <div
      className="staging"
      style={{ "--compact-height-ratio": compactHeightRatio } as CSSProperties}
    >
      <div className="staging__header">
        <h2 id="staging-title">{t(language, "spreadPositions")}</h2>
        <p>{t(language, "stagingHint")}</p>
      </div>
      <ReadingCloth
        label={t(language, "spreadPositions")}
        size="compact"
        cardCount={draw.requiredCount}
      >
        {positions.map(({ name, slotId, action }, index) => (
          <ClothSlot
            key={`${name}-${index}`}
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
            {action ? (
              <button
                type="button"
                className="staged-card"
                style={cardBackStyle(draw.deckBackImageUri)}
                disabled={action.disabled}
                onClick={action.onActivate}
                aria-label={action.label}
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
            <span className="slot-caption">{name}</span>
          </ClothSlot>
        ))}
      </ReadingCloth>
      <PositionKey
        language={language}
        names={names}
        actions={positions.map(({ action }) => action)}
      />
    </div>
  );
}

export function DrawStage({
  draw,
  client,
  deckOrder,
  selected,
  origins,
  returning,
  arcRef,
  isConfirming,
  selectionLocked,
  notice,
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
  client: DrawClient;
  deckOrder: string[];
  selected: string[];
  origins: Record<string, FlipRect>;
  returning?: { slotId: string; target: FlipRect };
  arcRef: RefObject<ArcFanHandle | null>;
  /** A confirmation request is in flight: the table waits, nothing moves. */
  isConfirming: boolean;
  /**
   * The selection must not change: a confirmation is pending or its outcome
   * is unknown, or a card is still returning to the deck. Browsing stays open.
   */
  selectionLocked: boolean;
  /** Recovery or error notice, shown above the toolbar in document flow. */
  notice?: ReactNode;
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
  const fullscreen = useFullscreen(client);
  const remaining = draw.requiredCount - selected.length;
  const complete = remaining === 0;
  const locked = selectionLocked || isConfirming;

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, []);

  const toggle = (slotId: string, origin: FlipRect): void => {
    if (locked) return;
    onToggle(slotId, origin);
  };
  const undo = (): void => {
    if (locked) return;
    onUndo();
  };
  const clear = (): void => {
    if (locked) return;
    onClear();
  };
  const confirm = (): void => {
    if (locked || !complete) return;
    onConfirm();
  };

  return (
    <main className="draw-shell" aria-busy={isConfirming}>
      <RitualProgress current="select" language={language} />
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
        {fullscreen.available ? (
          <div className="reading-actions">
            <button
              className="text-action"
              type="button"
              onClick={fullscreen.request}
              disabled={fullscreen.requesting}
            >
              {t(language, "fullscreen")}
            </button>
          </div>
        ) : null}
      </header>

      <SelectionStaging
        draw={draw}
        selected={selected}
        origins={origins}
        returning={returning}
        locked={locked}
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
          disabled={locked}
          onToggle={toggle}
          onUndo={undo}
          onConfirm={confirm}
        />
      </section>

      {notice}
      {fullscreen.failure !== undefined ? (
        <FullscreenNotice detail={fullscreen.failure} language={language} />
      ) : null}

      <div className="draw-toolbar">
        <p
          id="deck-status"
          className={complete ? "status-complete" : ""}
          aria-live="polite"
        >
          {isConfirming
            ? t(language, "confirming")
            : complete
              ? t(language, "selectionComplete")
              : t(language, "selectionRemaining", { count: remaining })}
        </p>
        {/* The primary action leads in DOM and on screen; narrow layouts span
            it across both columns without reordering focus. */}
        <div className="toolbar-actions">
          <button
            type="button"
            className="primary-action"
            onClick={confirm}
            disabled={locked || !complete}
          >
            {isConfirming ? t(language, "confirming") : t(language, "confirm")}
          </button>
          <button
            type="button"
            className="text-action"
            onClick={undo}
            disabled={locked || selected.length === 0}
          >
            {t(language, "undo")}
          </button>
          <button
            type="button"
            className="text-action"
            onClick={clear}
            disabled={locked || selected.length === 0}
          >
            {t(language, "reset")}
          </button>
        </div>
      </div>
    </main>
  );
}
