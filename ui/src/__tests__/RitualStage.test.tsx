import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RitualStage } from "../RitualStage.js";

describe("RitualStage", () => {
  it("keeps the user's focus when shuffling finishes", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    vi.useFakeTimers();

    try {
      render(
        <RitualStage
          total={78}
          spreadName="Three Card Spread"
          language="en"
          onReady={vi.fn()}
          onSkip={vi.fn()}
        />,
      );

      const skip = screen.getByRole("button", { name: "Skip and deal" });
      skip.focus();
      act(() => vi.advanceTimersByTime(900));

      expect(screen.getByRole("slider", { name: "Cut here" })).not.toBeNull();
      expect(document.activeElement).toBe(skip);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("maps a touch drag to a cut and passes its travel entropy", async () => {
    const onReady = vi.fn();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    try {
      render(
        <RitualStage
          total={78}
          spreadName="Three Card Spread"
          language="en"
          onReady={onReady}
          onSkip={vi.fn()}
        />,
      );

      const slider = screen.getByRole("slider", { name: "Cut here" });
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
      await userEvent.click(screen.getByRole("button", { name: "Cut here" }));
      expect(onReady).toHaveBeenCalledWith(39, 100);
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });
});
