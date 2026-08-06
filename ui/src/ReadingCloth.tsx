import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { type FlipRect, playFlip, playFlipOut } from "./flip.js";
import type { LayoutPoint } from "./types.js";

/**
 * The table the reading happens on. The same surface carries the empty
 * positions while cards are being drawn and the finished spread afterwards,
 * so cards never jump between two different boxes.
 */
export function ReadingCloth({
  label,
  size = "full",
  cardCount,
  children,
}: {
  label: string;
  size?: "compact" | "full";
  cardCount?: number;
  children: ReactNode;
}) {
  const sparse = size === "full" && cardCount !== undefined && cardCount <= 3;
  return (
    <section
      className={`reading-cloth reading-cloth--${size}${sparse ? " reading-cloth--sparse" : ""}`}
      aria-label={label}
    >
      <div className="reading-cloth__lamp" aria-hidden="true" />
      {children}
    </section>
  );
}

interface ClothSlotProps {
  point: LayoutPoint | undefined;
  index: number;
  className?: string;
  children: ReactNode;
  /** Where this card flew in from. Consumed once, on the frame it mounts. */
  origin?: FlipRect;
  onOriginConsumed?(): void;
  /** When set, the card leaves for this rect and then calls onDeparted. */
  departingTo?: FlipRect;
  onDeparted?(): void;
}

export function ClothSlot({
  point,
  index,
  className,
  children,
  origin,
  onOriginConsumed,
  departingTo,
  onDeparted,
}: ClothSlotProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const played = useRef<FlipRect | undefined>(undefined);
  const rotation = point?.rotation ?? 0;

  const attach = useCallback((element: HTMLDivElement | null) => {
    node.current = element;
  }, []);

  useEffect(() => {
    const element = node.current;
    if (!element || !origin || played.current === origin) return;
    played.current = origin;
    const cancel = playFlip(element, origin, {
      destinationRotation: rotation,
      onFinish: onOriginConsumed,
    });
    return cancel;
  }, [origin, onOriginConsumed, rotation]);

  useEffect(() => {
    const element = node.current;
    if (!element || !departingTo) return;
    const cancel = playFlipOut(element, departingTo, {
      destinationRotation: rotation,
      onFinish: onDeparted,
    });
    return cancel;
  }, [departingTo, onDeparted, rotation]);

  return (
    <div
      className={`cloth-slot${className ? ` ${className}` : ""}`}
      ref={attach}
      style={
        {
          "--card-x": `${point?.x ?? 50}%`,
          "--card-y": `${point?.y ?? 50}%`,
          "--card-rotation": `${rotation}deg`,
          "--card-layer": point?.layer ?? index,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
