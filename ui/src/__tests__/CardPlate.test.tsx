import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CardPlate } from "../CardPlate.js";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

/** A 200 x 300 plate at the page origin, drawn on the frame it is asked for. */
function mountPlate(reducedMotion = false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reducedMotion }),
  });
  vi.stubGlobal("requestAnimationFrame", (draw: FrameRequestCallback) => {
    draw(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  const { container } = render(
    <CardPlate source="/plates/star.webp" name="The Star" />,
  );
  const plate = container.querySelector<HTMLElement>(".card-plate")!;
  vi.spyOn(plate, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 200,
    bottom: 300,
    width: 200,
    height: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return plate;
}

describe("card plate", () => {
  it("leans toward a mouse and comes back to rest when it leaves", () => {
    const plate = mountPlate();

    fireEvent.pointerMove(plate, {
      pointerType: "mouse",
      clientX: 150,
      clientY: 75,
    });
    expect(plate.hasAttribute("data-tilting")).toBe(true);
    expect(plate.style.getPropertyValue("--tilt-x")).toBe("0.250");
    expect(plate.style.getPropertyValue("--tilt-y")).toBe("-0.250");

    fireEvent.pointerLeave(plate, { pointerType: "mouse" });
    expect(plate.hasAttribute("data-tilting")).toBe(false);
    expect(plate.style.getPropertyValue("--tilt-x")).toBe("");
    expect(plate.style.getPropertyValue("--tilt-y")).toBe("");
  });

  it("stays at rest under a finger", () => {
    const plate = mountPlate();
    fireEvent.pointerMove(plate, {
      pointerType: "touch",
      clientX: 150,
      clientY: 75,
    });
    expect(plate.hasAttribute("data-tilting")).toBe(false);
    expect(plate.style.getPropertyValue("--tilt-x")).toBe("");
  });

  it("stays at rest for a reader who asked for less motion", () => {
    const plate = mountPlate(true);
    fireEvent.pointerMove(plate, {
      pointerType: "mouse",
      clientX: 150,
      clientY: 75,
    });
    expect(plate.hasAttribute("data-tilting")).toBe(false);
  });

  it("turns a reversed card and names the card when its art will not load", () => {
    const { rerender } = render(
      <CardPlate source="/plates/tower.webp" name="The Tower" reversed />,
    );
    const art = screen.getByRole("img", { name: "The Tower" });
    expect(art.classList.contains("is-reversed")).toBe(true);

    fireEvent.error(art);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("The Tower")).not.toBeNull();

    // A different card gets a fresh attempt at its own art.
    rerender(<CardPlate source="/plates/sun.webp" name="The Sun" />);
    expect(screen.getByRole("img", { name: "The Sun" })).not.toBeNull();
  });
});
