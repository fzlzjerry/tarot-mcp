import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { clamp } from "./deck-order.js";
import { prefersReducedMotion } from "./flip.js";
import { t } from "./i18n.js";
import type { Language } from "./types.js";

/** Cards drawn in the pile. Visual depth only — the deck is still 78. */
const PILE = 22;
const SHUFFLE_MS = 900;

interface RitualStageProps {
  total: number;
  spreadName: string;
  deckBackImageUri?: string;
  language: Language;
  /** Cut the deck at `cutIndex`, seeded with how far the hand travelled. */
  onReady(cutIndex: number, entropy: number): void;
  /** Leave the deck exactly as the server dealt it. */
  onSkip(): void;
}

export function RitualStage({
  total,
  spreadName,
  deckBackImageUri,
  language,
  onReady,
  onSkip,
}: RitualStageProps) {
  const [phase, setPhase] = useState<"shuffling" | "cut">(() =>
    prefersReducedMotion() ? "cut" : "shuffling",
  );
  const [ratio, setRatio] = useState(0.5);
  const pile = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cutHandle = useRef<HTMLDivElement>(null);
  const travel = useRef(0);
  const lastPointer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (phase !== "shuffling") return;
    const timer = window.setTimeout(() => setPhase("cut"), SHUFFLE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "cut") cutHandle.current?.focus({ preventScroll: true });
  }, [phase]);

  const cutIndex = Math.round(ratio * (total - 1));

  const setFromPointer = (clientY: number): void => {
    const box = pile.current?.getBoundingClientRect();
    if (!box || box.height === 0) return;
    if (lastPointer.current !== undefined) {
      travel.current += Math.abs(clientY - lastPointer.current);
    }
    lastPointer.current = clientY;
    setRatio(clamp(1 - (clientY - box.top) / box.height, 0, 1));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (phase !== "cut") return;
    dragging.current = true;
    lastPointer.current = undefined;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event.clientY);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragging.current) return;
    setFromPointer(event.clientY);
  };

  const endDrag = (): void => {
    dragging.current = false;
    lastPointer.current = undefined;
  };

  const nudge = (delta: number): void => {
    travel.current += 37;
    setRatio((current) => clamp(current + delta, 0, 1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const stride = 1 / Math.max(1, total - 1);
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        event.preventDefault();
        nudge(stride);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        event.preventDefault();
        nudge(-stride);
        break;
      case "PageUp":
        event.preventDefault();
        nudge(stride * 10);
        break;
      case "PageDown":
        event.preventDefault();
        nudge(-stride * 10);
        break;
      case "Home":
        event.preventDefault();
        travel.current += 37;
        setRatio(0);
        break;
      case "End":
        event.preventDefault();
        travel.current += 37;
        setRatio(1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onReady(cutIndex, Math.round(travel.current));
        break;
      default:
        break;
    }
  };

  const lifted = Math.round(ratio * (PILE - 1));

  return (
    <main className="ritual-shell">
      <header className="ritual-header">
        <p className="spread-label">{spreadName}</p>
        <h1 ref={heading} tabIndex={-1}>
          {t(language, "shuffleTitle")}
        </h1>
        <p>
          {phase === "shuffling"
            ? t(language, "shuffling")
            : t(language, "cutHint")}
        </p>
      </header>

      <div
        className={`ritual-pile${phase === "shuffling" ? " is-shuffling" : ""}`}
        ref={pile}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {Array.from({ length: PILE }, (_, layer) => (
          <div
            className={`ritual-pile__card${
              phase === "cut" && layer > lifted ? " is-lifted" : ""
            }`}
            key={layer}
            aria-hidden="true"
            style={
              {
                "--layer": layer,
                "--layer-from-top": PILE - 1 - layer,
                "--deck-back-image": deckBackImageUri
                  ? `url("${deckBackImageUri.replaceAll('"', "%22")}")`
                  : undefined,
              } as CSSProperties
            }
          />
        ))}
        {phase === "cut" ? (
          <div
            className="ritual-cut"
            ref={cutHandle}
            role="slider"
            tabIndex={0}
            aria-label={t(language, "cutAction")}
            aria-valuemin={0}
            aria-valuemax={total - 1}
            aria-valuenow={cutIndex}
            aria-valuetext={t(language, "cutDepth", { count: cutIndex })}
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            style={{ "--cut-ratio": ratio } as CSSProperties}
          >
            <span className="ritual-cut__rule" aria-hidden="true" />
            <span className="ritual-cut__value" aria-hidden="true">
              {cutIndex}
            </span>
          </div>
        ) : null}
      </div>

      <p className="ritual-status" aria-live="polite">
        {phase === "shuffling"
          ? t(language, "shuffling")
          : t(language, "cutDepth", { count: cutIndex })}
      </p>

      <div className="ritual-actions">
        <button type="button" className="text-action" onClick={onSkip}>
          {t(language, "skipShuffle")}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={phase !== "cut"}
          onClick={() => onReady(cutIndex, Math.round(travel.current))}
        >
          {t(language, "cutAction")}
        </button>
      </div>
    </main>
  );
}
