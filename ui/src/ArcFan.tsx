import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ArcConfig,
  arcCardLeft,
  arcCurve,
  arcStripWidth,
  proximityLift,
} from "./deck-order.js";
import { type FlipRect, measure, prefersReducedMotion } from "./flip.js";
import { t } from "./i18n.js";
import { nextGridIndex } from "./selection.js";
import type { Language } from "./types.js";

/** How far a hover reaches along the spread, and how high it lifts the card. */
const LIFT_RADIUS = 128;
const LIFT_AMOUNT = 26;
const FOCUS_LIFT = 30;
const SELECTED_LIFT = 14;
/** Arrow up/down jumps a handful of cards rather than a row. */
const PAGE_STRIDE = 10;
const SETTLE_RATE = 0.24;
const IDLE_MS = 420;

function configFor(width: number): ArcConfig {
  // The exposed step is the effective hit strip once neighbouring cards overlap.
  if (width < 560) return { step: 44, cardWidth: 72, depth: 56, reach: 300 };
  if (width < 900) return { step: 44, cardWidth: 80, depth: 74, reach: 420 };
  return { step: 48, cardWidth: 92, depth: 104, reach: 620 };
}

export interface ArcFanHandle {
  /** Move keyboard focus to a specific card, e.g. after undoing a placement. */
  focusSlot(slotId: string): void;
  /** Where a card currently sits on screen, for the return flight. */
  rectFor(slotId: string): FlipRect | undefined;
}

interface ArcFanProps {
  slotIds: readonly string[];
  selected: readonly string[];
  requiredCount: number;
  deckBackImageUri?: string;
  language: Language;
  onToggle(slotId: string, origin: FlipRect): void;
  onUndo(): void;
  onConfirm(): void;
}

export const ArcFan = forwardRef<ArcFanHandle, ArcFanProps>(function ArcFan(
  {
    slotIds,
    selected,
    requiredCount,
    deckBackImageUri,
    language,
    onToggle,
    onUndo,
    onConfirm,
  },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const nodes = useRef<Array<HTMLButtonElement | null>>([]);
  const liftCurrent = useRef<Float64Array>(new Float64Array(0));
  const pointerX = useRef<number | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const lastActivity = useRef(0);
  const dragged = useRef(false);
  const dragStart = useRef<{ x: number; scrollLeft: number } | undefined>(
    undefined,
  );
  const [tabStopIndex, setTabStopIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(1200);

  const config = useMemo(() => configFor(width), [width]);
  const total = slotIds.length;
  const stripWidth = arcStripWidth(total, config);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atLimit = selected.length >= requiredCount;

  const indexOfSlot = useCallback(
    (slotId: string) => slotIds.indexOf(slotId),
    [slotIds],
  );

  if (liftCurrent.current.length !== total) {
    liftCurrent.current = new Float64Array(total);
  }

  /** One pass of arc placement. Reads scroll state, writes transforms only. */
  const paint = useCallback((): boolean => {
    const view = scroller.current;
    if (!view) return false;
    const reduced = prefersReducedMotion();
    const scrollLeft = view.scrollLeft;
    const viewWidth = view.clientWidth;
    const apex = scrollLeft + viewWidth / 2;
    const stripPointer =
      pointerX.current === undefined
        ? undefined
        : pointerX.current + scrollLeft;

    const margin = config.step * 6;
    const first = Math.max(
      0,
      Math.floor((scrollLeft - margin) / config.step) - 1,
    );
    const last = Math.min(
      total - 1,
      Math.ceil((scrollLeft + viewWidth + margin) / config.step) + 1,
    );

    let settling = false;
    for (let index = first; index <= last; index += 1) {
      const centre = arcCardLeft(index, config) + config.cardWidth / 2;
      const { y, rotation } = arcCurve(centre - apex, config);

      let target =
        stripPointer === undefined
          ? 0
          : proximityLift(centre - stripPointer, LIFT_RADIUS, LIFT_AMOUNT);
      if (index === focusedIndex) target = Math.max(target, FOCUS_LIFT);
      if (selectedSet.has(slotIds[index]))
        target = Math.max(target, SELECTED_LIFT);

      let lift = liftCurrent.current[index];
      if (reduced) {
        lift = target;
      } else if (Math.abs(target - lift) > 0.05) {
        lift += (target - lift) * SETTLE_RATE;
        settling = true;
      } else {
        lift = target;
      }
      liftCurrent.current[index] = lift;

      const node = nodes.current[index];
      if (!node) continue;
      node.style.transform = `translate3d(0, ${(y - lift).toFixed(2)}px, 0) rotate(${rotation.toFixed(2)}deg)`;
    }
    return settling;
  }, [config, focusedIndex, selectedSet, slotIds, total]);

  const wake = useCallback(() => {
    lastActivity.current =
      typeof performance === "undefined" ? 0 : performance.now();
    if (frame.current !== undefined) return;
    const step = (): void => {
      const settling = paint();
      const now = typeof performance === "undefined" ? 0 : performance.now();
      if (settling || now - lastActivity.current < IDLE_MS) {
        frame.current = requestAnimationFrame(step);
      } else {
        frame.current = undefined;
      }
    };
    frame.current = requestAnimationFrame(step);
  }, [paint]);

  // Track the container width so the arc reshapes rather than overflowing.
  useEffect(() => {
    const view = scroller.current;
    if (!view) return;
    if (view.clientWidth > 0) setWidth(view.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
      wake();
    });
    observer.observe(view);
    return () => observer.disconnect();
  }, [wake]);

  // Place the cards before the browser paints, so the arc never flashes flat.
  useLayoutEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    wake();
  }, [wake]);

  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      focusSlot(slotId) {
        const index = indexOfSlot(slotId);
        if (index < 0) return;
        setTabStopIndex(index);
        nodes.current[index]?.focus();
      },
      rectFor(slotId) {
        const index = indexOfSlot(slotId);
        const node = index < 0 ? undefined : nodes.current[index];
        if (!node) return undefined;
        const centre = arcCardLeft(index, config) + config.cardWidth / 2;
        const view = scroller.current;
        const apex = view ? view.scrollLeft + view.clientWidth / 2 : centre;
        return measure(node, arcCurve(centre - apex, config).rotation);
      },
    }),
    [config, indexOfSlot],
  );

  const bringIntoView = useCallback((index: number) => {
    const node = nodes.current[index];
    const view = scroller.current;
    if (!node || !view) return;
    const cardLeft = node.offsetLeft;
    const cardRight = cardLeft + node.offsetWidth;
    const pad = 96;
    if (cardLeft - pad < view.scrollLeft) {
      view.scrollLeft = Math.max(0, cardLeft - pad);
    } else if (cardRight + pad > view.scrollLeft + view.clientWidth) {
      view.scrollLeft = cardRight + pad - view.clientWidth;
    }
  }, []);

  const moveFocus = (index: number): void => {
    setTabStopIndex(index);
    nodes.current[index]?.focus();
    bringIntoView(index);
    wake();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const current = Number(target.dataset.slotIndex);
    if (Number.isNaN(current)) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      onUndo();
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      selected.length === requiredCount
    ) {
      event.preventDefault();
      onConfirm();
      return;
    }
    const next = nextGridIndex(current, event.key, total, PAGE_STRIDE);
    if (next !== current) {
      event.preventDefault();
      moveFocus(next);
    }
  };

  const pick = (index: number, node: HTMLButtonElement): void => {
    if (dragged.current) return;
    const slotId = slotIds[index];
    if (!selectedSet.has(slotId) && atLimit) return;
    const view = scroller.current;
    const centre = arcCardLeft(index, config) + config.cardWidth / 2;
    const apex = view ? view.scrollLeft + view.clientWidth / 2 : centre;
    onToggle(slotId, measure(node, arcCurve(centre - apex, config).rotation));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const view = scroller.current;
    if (!view) return;
    if (dragStart.current) {
      const delta = event.clientX - dragStart.current.x;
      if (Math.abs(delta) > 6) dragged.current = true;
      if (dragged.current) {
        view.scrollLeft = dragStart.current.scrollLeft - delta;
      }
    }
    pointerX.current = event.clientX - view.getBoundingClientRect().left;
    wake();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragged.current = false;
    if (event.pointerType !== "mouse" || !scroller.current) return;
    dragStart.current = {
      x: event.clientX,
      scrollLeft: scroller.current.scrollLeft,
    };
  };

  const endDrag = (): void => {
    dragStart.current = undefined;
  };

  const onPointerLeave = (): void => {
    pointerX.current = undefined;
    endDrag();
    wake();
  };

  const onBlur = (event: ReactFocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (next && event.currentTarget.contains(next as Node)) return;
    setFocusedIndex(null);
  };

  return (
    <div
      className="arc-fan"
      ref={scroller}
      role="group"
      aria-describedby="deck-help deck-status"
      onKeyDown={onKeyDown}
      onScroll={wake}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={onPointerLeave}
      onBlur={onBlur}
      style={
        {
          "--arc-card-width": `${config.cardWidth}px`,
          "--arc-depth": `${config.depth}px`,
        } as CSSProperties
      }
    >
      <div className="arc-fan__strip" style={{ width: `${stripWidth}px` }}>
        {slotIds.map((slotId, index) => {
          const order = selected.indexOf(slotId);
          const isDrawn = order >= 0;
          return (
            <button
              key={slotId}
              type="button"
              className={`arc-card${isDrawn ? " is-drawn" : ""}`}
              ref={(node) => {
                nodes.current[index] = node;
              }}
              style={
                {
                  left: `${arcCardLeft(index, config)}px`,
                  "--deck-back-image": deckBackImageUri
                    ? `url("${deckBackImageUri.replaceAll('"', "%22")}")`
                    : undefined,
                } as CSSProperties
              }
              data-slot-index={index}
              tabIndex={index === tabStopIndex ? 0 : -1}
              aria-pressed={isDrawn}
              aria-disabled={atLimit && !isDrawn}
              aria-label={
                isDrawn
                  ? `${t(language, "deckCard", { number: index + 1 })}, ${t(language, "selectedOrder", { number: order + 1 })}`
                  : t(language, "deckCard", { number: index + 1 })
              }
              onFocus={() => {
                setTabStopIndex(index);
                setFocusedIndex(index);
                wake();
              }}
              onClick={(event) => pick(index, event.currentTarget)}
            >
              {isDrawn ? (
                <span className="arc-card__order" aria-hidden="true">
                  {order + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
