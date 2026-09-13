import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { RitualStage } from "../RitualStage.js";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

function mount(reducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reducedMotion }),
  });
  const onShuffle = vi.fn();
  const onReady = vi.fn();
  const onSkip = vi.fn();
  const view = render(
    <RitualStage
      total={78}
      spreadName="Three Card Spread"
      language="en"
      onShuffle={onShuffle}
      onReady={onReady}
      onSkip={onSkip}
    />,
  );
  return { ...view, onShuffle, onReady, onSkip };
}

describe("RitualStage", () => {
  it("waits for each shuffle and cut action without stealing existing focus", () => {
    vi.useFakeTimers();
    const { onShuffle, onReady, unmount } = mount(false);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onShuffle).not.toHaveBeenCalled();
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start shuffling" }));
    expect(onShuffle).toHaveBeenCalledOnce();
    const skip = screen.getByRole("button", { name: "Skip remaining ritual" });
    skip.focus();
    act(() => vi.advanceTimersByTime(1500));
    expect(document.activeElement).toBe(skip);
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Shuffle again" }));
    expect(onShuffle).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.click(screen.getByRole("button", { name: "Cut the deck" }));
    expect(document.activeElement).toBe(skip);
    fireEvent.click(screen.getByRole("button", { name: "Cut here" }));
    expect(onReady).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Skip remaining ritual",
      }).disabled,
    ).toBe(true);
    unmount();
    act(() => vi.runOnlyPendingTimers());
    expect(onReady).not.toHaveBeenCalled();
  });

  it("preserves manual stages with reduced motion and gives touch and keyboard the same cut", () => {
    const { onShuffle, onReady } = mount(true);
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start shuffling" }));
    expect(onShuffle).toHaveBeenCalledOnce();
    expect(screen.queryByRole("slider")).toBeNull();
    const enterCut = screen.getByRole("button", { name: "Cut the deck" });
    enterCut.focus();
    fireEvent.click(enterCut);
    const slider = screen.getByRole("slider", { name: "Cut here" });
    expect(document.activeElement).toBe(slider);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider.getAttribute("aria-valuetext")).toBe("Keep the deck uncut");
    for (let n = 0; n < 39; n++) fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(slider.getAttribute("aria-valuenow")).toBe("39");
    const pile = slider.parentElement as HTMLDivElement;
    vi.spyOn(pile, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      bottom: 500,
      right: 200,
      width: 200,
      height: 400,
      toJSON: () => ({}),
    });
    Object.defineProperty(pile, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    fireEvent.pointerDown(pile, {
      pointerId: 7,
      pointerType: "touch",
      clientY: 400,
    });
    fireEvent.pointerMove(pile, {
      pointerId: 7,
      pointerType: "touch",
      clientY: 300,
    });
    fireEvent.pointerUp(pile, { pointerId: 7, pointerType: "touch" });
    expect(slider.getAttribute("aria-valuenow")).toBe("39");
    fireEvent.keyDown(slider, { key: "Enter" });
    expect(onReady).toHaveBeenCalledExactlyOnceWith(39);
    expect(onShuffle).toHaveBeenCalledOnce();
  });
});
