import { type RefObject, useEffect, useRef } from "react";
import { ArcFan, type ArcFanHandle } from "./ArcFan.js";
import { ClothSlot, ReadingCloth } from "./ReadingCloth.js";
import { PositionKey } from "./PositionKey.js";
import { cardBackStyle } from "./card-style.js";
import { t } from "./i18n.js";
import { layoutForSpread } from "./spreads.js";
import type { FlipRect } from "./flip.js";
import type { BeginReadingPayload, Language } from "./types.js";

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
                <div
                  className="staged-card staged-card--empty"
                  aria-hidden="true"
                >
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

export function DrawStage({
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
  arcRef: RefObject<ArcFanHandle | null>;
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
