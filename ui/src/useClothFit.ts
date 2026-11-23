import { useLayoutEffect, useState } from "react";
import { type ClothFit, fitCloth } from "./cloth-fit.js";
import type { LayoutPoint } from "./types.js";

/** A card is also a button, so it never drops below a 44px target. */
const MIN_SLOT = 44;
const MAX_SLOT = 168;
/** The reading card's proportions until one has been measured. */
const CARD_ASPECT = 3.35 / 2;

/**
 * Size the cards of a spread to the cloth they lie on. The cloth is measured
 * rather than assumed, so the same layout fills a phone, a wide table and a
 * host iframe, and re-fits whenever the cloth changes size. `layout` must
 * keep its identity between renders.
 */
export function useClothFit(
  layout: LayoutPoint[],
  enabled: boolean,
): { attach(element: HTMLElement | null): void; fit?: ClothFit } {
  const [cloth, attach] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<ClothFit>();

  useLayoutEffect(() => {
    if (!enabled || !cloth || typeof ResizeObserver === "undefined") {
      setFit(undefined);
      return;
    }
    const measure = (): void => {
      const width = cloth.clientWidth;
      const height = cloth.clientHeight;
      if (width === 0 || height === 0) return;
      const card = cloth.querySelector<HTMLElement>(".reading-card");
      const caption = cloth.querySelector<HTMLElement>(
        ".cloth-slot:not(.cloth-slot--crossing) > .slot-caption",
      );
      const next = fitCloth(layout, {
        width,
        height,
        aspect:
          card && card.offsetWidth > 0
            ? card.offsetHeight / card.offsetWidth
            : CARD_ASPECT,
        // A hidden caption has no height and reserves no room.
        caption:
          caption && caption.offsetHeight > 0
            ? caption.offsetHeight +
              (parseFloat(getComputedStyle(caption).marginTop) || 0)
            : 0,
        min: MIN_SLOT,
        max: MAX_SLOT,
      });
      setFit((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cloth);
    return () => observer.disconnect();
  }, [cloth, enabled, layout]);

  return { attach, fit };
}
