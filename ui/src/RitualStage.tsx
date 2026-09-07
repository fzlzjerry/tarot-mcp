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

/**
 * Cards drawn in the pile. Visual depth only — the deck is still 78. Even,
 * because a riffle needs two packets of the same thickness.
 */
const PILE = 22;

/**
 * One riffle shuffle. Published to CSS as `--shuffle-duration`; styles/ritual.css
 * writes every beat as a fraction of it, so the whole choreography — split,
 * riffle, bridge — retimes from this single number.
 *
 * At 1500ms: split 0–450ms, riffle 480–1035ms, bridge 1050–1478ms, still.
 */
const SHUFFLE_MS = 1500;

/** Completing the cut and spreading the settled deck into the arc. */
const OPENING_MS = 620;

/**
 * Static geometry per card, in settled-deck order.
 *
 * A riffle interleaves, so a card's packet is simply its parity, and its depth
 * within that packet is half its layer: strip the even cards left and the odd
 * cards right, push them back together, and you rebuild exactly this stack.
 * That is what lets one keyframe run the shuffle forwards and land every card
 * back on its own resting slot.
 *
 * `u` runs -1 → 1 through the deck's thickness. It shapes the bridge's arch
 * (1 - u²) and the arc the deck opens into; `dip` is u², precomputed so CSS
 * never has to square a signed value.
 */
const LAYERS = Array.from({ length: PILE }, (_, layer) => {
  const u = (layer / (PILE - 1)) * 2 - 1;
  return {
    layer,
    rank: Math.floor(layer / 2),
    side: layer % 2 === 0 ? -1 : 1,
    u: Number(u.toFixed(4)),
    dip: Number((u * u).toFixed(4)),
  };
});

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
  const [phase, setPhase] = useState<"shuffling" | "cut" | "opening">(() =>
    prefersReducedMotion() ? "cut" : "shuffling",
  );
  const [ratio, setRatio] = useState(0.5);
  const pile = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cutHandle = useRef<HTMLDivElement>(null);
  const travel = useRef(0);
  const lastPointer = useRef<number | undefined>(undefined);
  const openingTimer = useRef<number | undefined>(undefined);
  const opening = useRef(false);
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
    if (phase !== "cut") return;
    const active = document.activeElement;
    const shouldMoveFocus =
      active === document.body ||
      active === heading.current ||
      (active !== null && pile.current?.contains(active));
    if (shouldMoveFocus) cutHandle.current?.focus({ preventScroll: true });
  }, [phase]);

  /* The slider unmounts with the cut, so hand its focus back to the heading
     rather than dropping the reader on <body> until the next stage mounts. */
  useEffect(() => {
    if (phase !== "opening") return;
    const active = document.activeElement;
    if (
      active === document.body ||
      (active !== null && pile.current?.contains(active))
    ) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  useEffect(
    () => () => {
      if (openingTimer.current !== undefined) {
        window.clearTimeout(openingTimer.current);
      }
    },
    [],
  );

  const cutIndex = Math.round(ratio * (total - 1));

  const commitCut = (): void => {
    if (phase !== "cut" || opening.current) return;
    const entropy = Math.round(travel.current);
    if (prefersReducedMotion()) {
      onReady(cutIndex, entropy);
      return;
    }
    opening.current = true;
    setPhase("opening");
    openingTimer.current = window.setTimeout(
      () => onReady(cutIndex, entropy),
      OPENING_MS,
    );
  };

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
        commitCut();
        break;
      default:
        break;
    }
  };

  /*
   * How much of the deck the hand has taken off the top — the same quantity
   * the label reports, so raising the cut both deepens the count and thickens
   * the packet that lifts. Held through the opening so the deal can start from
   * the pose the reader left the deck in.
   */
  const liftedCount =
    phase === "shuffling" ? 0 : Math.round(ratio * (PILE - 1));
  /** Lowest card of the lifted packet; PILE while the deck is still whole. */
  const cutFace = PILE - liftedCount;

  return (
    <main
      className={`ritual-shell ritual-shell--${phase}`}
      aria-busy={phase === "opening"}
    >
      <header className="ritual-header">
        <p className="spread-label">{spreadName}</p>
        <h1 ref={heading} tabIndex={-1}>
          {t(language, "shuffleTitle")}
        </h1>
        <p>
          {phase === "shuffling"
            ? t(language, "shuffling")
            : phase === "opening"
              ? t(language, "openingDeck")
              : t(language, "cutHint")}
        </p>
      </header>

      <div
        className={`ritual-pile is-${phase}`}
        ref={pile}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={
          {
            "--cut-ratio": ratio,
            "--shuffle-duration": `${SHUFFLE_MS}ms`,
            "--open-duration": `${OPENING_MS}ms`,
            "--deck-back-image": deckBackImageUri
              ? `url("${deckBackImageUri.replaceAll('"', "%22")}")`
              : undefined,
          } as CSSProperties
        }
      >
        <div className="ritual-aura" aria-hidden="true">
          <span className="ritual-aura__ring ritual-aura__ring--outer" />
          <span className="ritual-aura__ring ritual-aura__ring--inner" />
          <span className="ritual-aura__star ritual-aura__star--north">✦</span>
          <span className="ritual-aura__star ritual-aura__star--east">✦</span>
          <span className="ritual-aura__star ritual-aura__star--south">✦</span>
          <span className="ritual-aura__star ritual-aura__star--west">✦</span>
        </div>
        <span
          className="ritual-shade"
          aria-hidden="true"
          style={{ "--side": -1 } as CSSProperties}
        />
        <span
          className="ritual-shade"
          aria-hidden="true"
          style={{ "--side": 1 } as CSSProperties}
        />
        {LAYERS.map(({ layer, rank, side, u, dip }) => (
          <div
            className={`ritual-pile__card${
              layer >= cutFace ? " is-lifted" : ""
            }${liftedCount > 0 && layer === cutFace ? " is-cut-face" : ""}`}
            key={layer}
            aria-hidden="true"
            style={
              {
                "--layer": layer,
                "--rank": rank,
                "--side": side,
                "--u": u,
                "--dip": dip,
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
          : phase === "opening"
            ? t(language, "openingDeck")
            : t(language, "cutDepth", { count: cutIndex })}
      </p>

      <div className="ritual-actions">
        <button
          type="button"
          className="text-action"
          disabled={phase === "opening"}
          onClick={onSkip}
        >
          {t(language, "skipShuffle")}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={phase !== "cut"}
          onClick={commitCut}
        >
          {t(language, "cutAction")}
        </button>
      </div>
    </main>
  );
}
