import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { vi } from "vitest";
import type { ArcFanHandle } from "../ArcFan.js";
import { DrawStage } from "../DrawStage.js";
import { t } from "../i18n.js";
import type { BeginReadingPayload, DrawClient } from "../types.js";

const slots = Array.from({ length: 78 }, (_, index) => ({
  slotId: `opaque-${index + 1}`,
  index,
}));
const draw: BeginReadingPayload = {
  drawId: "draw_test",
  readingKind: "spread",
  spreadType: "three_card",
  spreadName: "Three Card Spread",
  question: "What next?",
  language: "en",
  requiredCount: 3,
  slots,
  positions: [{ name: "Past" }, { name: "Present" }, { name: "Future" }],
};
const deckOrder = slots.map((slot) => slot.slotId);

/** Ten positions whose first two cards lie on top of each other on the cloth. */
const celticCross: BeginReadingPayload = {
  ...draw,
  spreadType: "celtic_cross",
  spreadName: "Celtic Cross",
  requiredCount: 10,
  positions: [
    "Present",
    "Challenge",
    "Foundation",
    "Past",
    "Crown",
    "Near future",
    "Self",
    "Environment",
    "Hopes and fears",
    "Outcome",
  ].map((name) => ({ name })),
};

function createClient(overrides: Partial<DrawClient> = {}): DrawClient {
  return {
    target: "web",
    beginReading: vi.fn<DrawClient["beginReading"]>(),
    confirmReading: vi.fn<DrawClient["confirmReading"]>(),
    ...overrides,
  };
}

function mount(
  props: Partial<Parameters<typeof DrawStage>[0]> & { selected: string[] },
) {
  const handlers = {
    onToggle: vi.fn(),
    onRemove: vi.fn(),
    onOriginConsumed: vi.fn(),
    onDeparted: vi.fn(),
    onUndo: vi.fn(),
    onClear: vi.fn(),
    onConfirm: vi.fn(),
  };
  const base = {
    draw,
    client: createClient(),
    deckOrder,
    origins: {},
    arcRef: createRef<ArcFanHandle>(),
    isConfirming: false,
    selectionLocked: false,
    language: "en" as const,
    ...handlers,
  };
  const view = render(<DrawStage {...base} {...props} />);
  return {
    ...handlers,
    unmount: view.unmount,
    rerender: (next: Partial<Parameters<typeof DrawStage>[0]>) =>
      view.rerender(<DrawStage {...base} {...props} {...next} />),
  };
}

function card(number: number): HTMLButtonElement {
  return screen.getByRole("button", {
    name: new RegExp(`^Card back ${number}\\b`),
  });
}

const positionList = () =>
  screen.getByRole("list", { name: t("en", "spreadPositions") });
/** The staged card on the cloth and its entry in the position list share one action. */
const removeButtons = (number: number, position: string) =>
  screen.getAllByRole<HTMLButtonElement>("button", {
    name: t("en", "removeFromPosition", { number, position }),
  });

describe("DrawStage post-drag activation", () => {
  it("suppresses the drag click but permits keyboard and assistive selection without another pointerdown", async () => {
    const user = userEvent.setup();
    const { onToggle, rerender } = mount({ selected: [] });
    const fan = screen.getByRole("group");
    const first = card(1);
    fireEvent.pointerDown(fan, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 300,
    });
    fireEvent.pointerMove(fan, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 180,
    });
    fireEvent.pointerUp(fan, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 180,
    });
    expect(fan.scrollLeft).toBeGreaterThan(0);
    fireEvent.click(first, { detail: 1 });
    expect(onToggle).not.toHaveBeenCalled();

    first.focus();
    await user.keyboard("[Space]");
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(
      "opaque-1",
      expect.anything(),
    );
    rerender({ selected: ["opaque-1"] });
    expect(card(1)).toBe(first);
    await user.keyboard("[Enter]");
    fireEvent.click(card(2), { detail: 0 });
    expect(onToggle.mock.calls.map(([slotId]) => slotId)).toEqual([
      "opaque-1",
      "opaque-1",
      "opaque-2",
    ]);
    expect(screen.getByRole("group")).toBe(fan);

    fireEvent.click(card(3), { detail: 1 });
    expect(onToggle).toHaveBeenCalledTimes(3);
    await user.click(card(3));
    expect(onToggle).toHaveBeenLastCalledWith("opaque-3", expect.anything());
    expect(onToggle).toHaveBeenCalledTimes(4);
  });
});

describe("DrawStage selection lock", () => {
  it("freezes pick, undo, remove and confirm while confirming but keeps the deck browsable", async () => {
    const user = userEvent.setup();
    const { onToggle, onUndo, onConfirm, onRemove, onClear, rerender } = mount({
      selected: ["opaque-1", "opaque-2"],
    });

    card(3).focus();
    await user.keyboard("[Space]");
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(
      "opaque-3",
      expect.anything(),
    );
    await user.keyboard("[Backspace]");
    expect(onUndo).toHaveBeenCalledOnce();

    rerender({ selected: ["opaque-1", "opaque-2", "opaque-3"] });
    await user.keyboard("{Control>}[Enter]{/Control}");
    expect(onConfirm).toHaveBeenCalledOnce();

    rerender({
      selected: ["opaque-1", "opaque-2", "opaque-3"],
      isConfirming: true,
      selectionLocked: true,
      notice: <div role="alert">Confirmation pending</div>,
    });
    expect(document.activeElement).toBe(card(3));
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    const confirming = screen.getByRole<HTMLButtonElement>("button", {
      name: "Confirming selection…",
    });
    expect(confirming.disabled).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Confirm selection" }),
    ).toBeNull();
    const notice = screen.getByRole("alert");
    const status = screen.getByText("Confirming selection…", { selector: "p" });
    expect(
      notice.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.keyboard("{Control>}[Enter]{/Control}");
    await user.keyboard("[Backspace]");
    await user.keyboard("[Space]");
    await user.click(card(4));
    await user.click(card(1));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledOnce();

    card(3).focus();
    await user.keyboard("[ArrowRight]");
    expect(document.activeElement).toBe(card(4));
    await user.keyboard("[Home]");
    expect(document.activeElement).toBe(card(1));

    const removes = removeButtons(1, "Past");
    expect(removes).toHaveLength(2);
    for (const remove of removes) {
      expect(remove.disabled).toBe(true);
      await user.click(remove);
    }
    expect(onRemove).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Undo last" })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Clear selection" })
        .disabled,
    ).toBe(true);
    expect(onClear).not.toHaveBeenCalled();
  });

  it("locks the selection without a busy state while a card returns or the outcome is unknown", async () => {
    const user = userEvent.setup();
    const { onToggle, onRemove, onConfirm } = mount({
      selected: ["opaque-1", "opaque-2", "opaque-3"],
      selectionLocked: true,
    });

    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("false");
    const confirm = screen.getByRole<HTMLButtonElement>("button", {
      name: "Confirm selection",
    });
    expect(confirm.disabled).toBe(true);
    await user.click(confirm);
    await user.click(card(5));
    for (const remove of removeButtons(2, "Present")) await user.click(remove);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe("DrawStage position list", () => {
  it("removes a staged card through the position list when the cards overlap on the cloth", async () => {
    const user = userEvent.setup();
    const { onRemove, rerender } = mount({
      draw: celticCross,
      selected: ["opaque-1", "opaque-2", "opaque-3"],
    });

    const list = positionList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    const listButtons = within(list).getAllByRole("button");
    expect(
      listButtons.map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      t("en", "removeFromPosition", { number: 1, position: "Present" }),
      t("en", "removeFromPosition", { number: 2, position: "Challenge" }),
      t("en", "removeFromPosition", { number: 3, position: "Foundation" }),
    ]);
    expect(within(list).getByText("Outcome")).not.toBeNull();

    await user.click(listButtons[1]);
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("opaque-2");

    rerender({
      selected: ["opaque-1", "opaque-2", "opaque-3"],
      selectionLocked: true,
    });
    for (const button of within(positionList()).getAllByRole<HTMLButtonElement>(
      "button",
    )) {
      expect(button.disabled).toBe(true);
      await user.click(button);
    }
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("DrawStage full screen", () => {
  it("hides the action when the host cannot go full screen", () => {
    const clients = [
      createClient(),
      createClient({
        canRequestFullscreen: () => false,
        requestFullscreen: vi
          .fn<() => Promise<void>>()
          .mockResolvedValue(undefined),
      }),
    ];
    for (const client of clients) {
      const { unmount } = mount({ selected: [], client });
      expect(
        screen.queryByRole("button", { name: t("en", "fullscreen") }),
      ).toBeNull();
      unmount();
    }
  });

  it("reports a rejected request in the notice area and keeps the selection", async () => {
    const user = userEvent.setup();
    let settle!: { resolve(): void; reject(error: Error): void };
    const requestFullscreen = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = { resolve, reject };
        }),
    );
    const { onRemove, onClear } = mount({
      selected: ["opaque-1", "opaque-2"],
      client: createClient({
        canRequestFullscreen: () => true,
        requestFullscreen,
      }),
    });

    const fullscreen = screen.getByRole<HTMLButtonElement>("button", {
      name: t("en", "fullscreen"),
    });
    await user.click(fullscreen);
    await user.click(fullscreen);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(fullscreen.disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => {
      settle.reject(new Error("Display mode not permitted"));
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(t("en", "fullscreenFailed"));
    expect(alert.textContent).toContain("Display mode not permitted");
    expect(fullscreen.disabled).toBe(false);
    expect(removeButtons(2, "Present")).toHaveLength(2);
    expect(screen.getByLabelText("2 / 3")).not.toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();

    await user.click(fullscreen);
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
    await act(async () => {
      settle.resolve();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fullscreen.disabled).toBe(false);
  });
});
