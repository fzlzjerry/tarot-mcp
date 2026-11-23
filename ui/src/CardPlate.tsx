import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./flip.js";

/**
 * A whole card plate, shown large. Under a mouse or pen it leans toward the
 * pointer and a lamp-coloured highlight follows across the gilding; touch and
 * reduced-motion readers get the plate at rest. The lean is written straight
 * to custom properties, so tracking the pointer never re-renders.
 */
export function CardPlate({
  source,
  name,
  reversed = false,
  className,
}: {
  source: string | undefined;
  name: string;
  reversed?: boolean;
  className?: string;
}) {
  const plate = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [source]);

  useEffect(() => {
    const element = plate.current;
    if (!element) return;
    let frame = 0;
    const rest = (): void => {
      cancelAnimationFrame(frame);
      delete element.dataset.tilting;
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    };
    const lean = (event: PointerEvent): void => {
      if (event.pointerType === "touch") return;
      // Asked on every move, so a preference changed mid-session is honoured.
      if (prefersReducedMotion()) {
        rest();
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        element.dataset.tilting = "";
        element.style.setProperty(
          "--tilt-x",
          ((event.clientX - box.left) / box.width - 0.5).toFixed(3),
        );
        element.style.setProperty(
          "--tilt-y",
          ((event.clientY - box.top) / box.height - 0.5).toFixed(3),
        );
      });
    };
    element.addEventListener("pointermove", lean);
    element.addEventListener("pointerleave", rest);
    return () => {
      element.removeEventListener("pointermove", lean);
      element.removeEventListener("pointerleave", rest);
      rest();
    };
  }, []);

  return (
    <div
      ref={plate}
      className={`card-plate${className ? ` ${className}` : ""}`}
    >
      <div className="card-plate__frame">
        {source && !failed ? (
          <img
            src={source}
            alt={name}
            className={reversed ? "is-reversed" : ""}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="card-art-fallback">{name}</div>
        )}
        <span className="card-plate__glare" aria-hidden="true" />
      </div>
    </div>
  );
}
