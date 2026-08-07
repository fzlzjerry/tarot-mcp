/**
 * A very small FLIP helper for the deal animation.
 *
 * Cards travel between two separate parts of the tree — the arc and the cloth —
 * so we cannot animate one persistent node. Instead we remember where the card
 * was on screen, then let the newly mounted node start from that offset and
 * transition home.
 *
 * The offset is applied through custom properties rather than by overwriting
 * `transform`, because the destination already carries its own centring and
 * spread rotation. See `.staged-position` in styles.css for the composition.
 */

export interface FlipRect {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
}

export const DEAL_DURATION = 420;
export const DEAL_EASING = "cubic-bezier(0.16, 0.84, 0.28, 1)";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Screen-space box of a node, plus the rotation already baked into it. */
export function measure(node: Element, rotation = 0): FlipRect {
  const box = node.getBoundingClientRect();
  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    rotation,
  };
}

function clearFlip(node: HTMLElement): void {
  node.style.removeProperty("--flip-x");
  node.style.removeProperty("--flip-y");
  node.style.removeProperty("--flip-scale");
  node.style.removeProperty("--flip-rotate");
  node.style.removeProperty("--flight-angle");
  node.style.removeProperty("--flight-distance");
  node.style.removeProperty("transition");
  node.classList.remove("is-dealing");
}

interface FlipOptions {
  duration?: number;
  easing?: string;
  /** Rotation the destination already applies, so we can cancel it out. */
  destinationRotation?: number;
  onFinish?(): void;
}

/**
 * Move `node` back to `from` with no transition, then let it travel home.
 * Returns a cancel function; calling it settles the node immediately.
 */
export function playFlip(
  node: HTMLElement,
  from: FlipRect,
  options: FlipOptions = {},
): () => void {
  const {
    duration = DEAL_DURATION,
    easing = DEAL_EASING,
    destinationRotation = 0,
    onFinish,
  } = options;

  const to = node.getBoundingClientRect();
  if (to.width === 0 || to.height === 0) {
    onFinish?.();
    return () => undefined;
  }

  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  const spin = from.rotation - destinationRotation;

  const negligible =
    Math.abs(dx) < 1 &&
    Math.abs(dy) < 1 &&
    Math.abs(scale - 1) < 0.01 &&
    Math.abs(spin) < 0.5;

  if (negligible || prefersReducedMotion()) {
    onFinish?.();
    return () => undefined;
  }
  const distance = Math.min(Math.hypot(dx, dy), 260);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  node.style.setProperty("--flight-angle", `${angle}deg`);
  node.style.setProperty("--flight-distance", `${distance}px`);
  node.classList.add("is-dealing");

  let finished = false;
  const settle = (): void => {
    if (finished) return;
    finished = true;
    node.removeEventListener("transitionend", onEnd);
    window.clearTimeout(timer);
    clearFlip(node);
    onFinish?.();
  };
  const onEnd = (event: TransitionEvent): void => {
    if (event.target === node && event.propertyName === "transform") settle();
  };

  node.style.transition = "none";
  node.style.setProperty("--flip-x", `${dx}px`);
  node.style.setProperty("--flip-y", `${dy}px`);
  node.style.setProperty("--flip-scale", `${scale}`);
  node.style.setProperty("--flip-rotate", `${spin}deg`);

  // Force the browser to adopt the starting offset before we transition away.
  void node.offsetWidth;

  node.style.transition = `transform ${duration}ms ${easing}`;
  node.style.setProperty("--flip-x", "0px");
  node.style.setProperty("--flip-y", "0px");
  node.style.setProperty("--flip-scale", "1");
  node.style.setProperty("--flip-rotate", "0deg");

  node.addEventListener("transitionend", onEnd);
  // transitionend can be skipped on a hidden tab; never strand the offset.
  const timer = window.setTimeout(settle, duration + 120);

  return settle;
}

/**
 * Send a node from where it is to `to`, then run `onFinish` — the mirror of
 * playFlip, used when a card is taken back off the cloth and returns to the arc.
 */
export function playFlipOut(
  node: HTMLElement,
  to: FlipRect,
  options: FlipOptions = {},
): () => void {
  const {
    duration = Math.round(DEAL_DURATION * 0.8),
    easing = DEAL_EASING,
    destinationRotation = 0,
    onFinish,
  } = options;

  const from = node.getBoundingClientRect();
  if (from.width === 0 || prefersReducedMotion()) {
    onFinish?.();
    return () => undefined;
  }

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / from.width;

  let finished = false;
  const settle = (): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    onFinish?.();
  };

  node.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ease-out`;
  node.style.setProperty("--flip-x", `${dx}px`);
  node.style.setProperty("--flip-y", `${dy}px`);
  node.style.setProperty("--flip-scale", `${scale}`);
  node.style.setProperty(
    "--flip-rotate",
    `${to.rotation - destinationRotation}deg`,
  );
  node.style.opacity = "0";

  const timer = window.setTimeout(settle, duration + 60);
  return settle;
}
