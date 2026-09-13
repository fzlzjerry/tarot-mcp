import {
  act,
  fireEvent,
  isInaccessible,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ReadingBoard } from "../ReadingBoard.js";
import { t } from "../i18n.js";
import type { ConfirmedReading, DrawClient, ReadingCard } from "../types.js";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

function reading(interpretation?: string): ConfirmedReading {
  return {
    readingId: "reading_test",
    drawId: "draw_test",
    spreadType: "three_card",
    spreadName: "Three Card Spread",
    question: "What next?",
    language: "en",
    cards: [
      {
        id: "fool",
        name: "The Fool",
        displayName: "The Fool",
        orientation: "upright",
        position: "Past",
      },
      {
        id: "magician",
        name: "The Magician",
        displayName: "The Magician",
        orientation: "reversed",
        position: "Present",
      },
      {
        id: "world",
        name: "The World",
        displayName: "The World",
        orientation: "upright",
        position: "Future",
      },
    ],
    interpretation,
  };
}

/** Ten cards whose first two share one spot on the cloth, so the list is the reliable target. */
function celticReading(): ConfirmedReading {
  const names = [
    "The Fool",
    "The Magician",
    "The High Priestess",
    "The Empress",
    "The Emperor",
    "The Hierophant",
    "The Lovers",
    "The Chariot",
    "Strength",
    "The Hermit",
  ];
  const positions = [
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
  ];
  const cards: ReadingCard[] = names.map((name, index) => ({
    id: name.toLowerCase().replaceAll(" ", "_"),
    name,
    displayName: name,
    orientation: index % 2 === 0 ? "upright" : "reversed",
    position: positions[index],
  }));
  return {
    readingId: "reading_celtic",
    drawId: "draw_celtic",
    spreadType: "celtic_cross",
    spreadName: "Celtic Cross",
    question: "What next?",
    language: "en",
    cards,
  };
}

function createClient(
  target: DrawClient["target"],
  overrides: Partial<DrawClient> = {},
) {
  const confirmReading = vi.fn<DrawClient["confirmReading"]>();
  const client: DrawClient = {
    target,
    beginReading: vi.fn<DrawClient["beginReading"]>(),
    confirmReading,
    ...overrides,
  };
  return { client, confirmReading };
}

function mount(client: DrawClient, current: ConfirmedReading = reading()) {
  const onRestart = vi.fn();
  const view = render(
    <ReadingBoard
      reading={current}
      client={client}
      language="en"
      onRestart={onRestart}
    />,
  );
  return { ...view, onRestart };
}

const label = (
  key: Parameters<typeof t>[1],
  values?: Record<string, string | number>,
) => t("en", key, values);
const next = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: label("revealNext") });
const all = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: label("revealAll") });
const interpret = () =>
  screen.queryByRole("button", { name: label("interpretInChatGPT") });
const interpretationHeading = () =>
  screen.queryByRole("heading", { name: label("interpretation") });
const revealedCard = (name: string) =>
  screen.queryByRole("button", { name: `${name}. ${label("details")}` });
const positionList = () =>
  screen.getByRole("list", { name: label("spreadPositions") });
/** Card names and orientations render twice (art fallback and caption); every copy must hide together. */
const hiddenFromAssistiveTech = (text: string) =>
  screen.getAllByText(text).every(isInaccessible);

describe("ReadingBoard restored presentation", () => {
  it("restores partial reveals without automatically revealing or sending", async () => {
    const user = userEvent.setup();
    const continueReading = vi.fn(async () => "sent" as const);
    const { client } = createClient("mcp", { continueReading });
    const checkpoints = vi.fn();
    render(
      <ReadingBoard
        reading={reading()}
        client={client}
        language="en"
        onRestart={vi.fn()}
        initialRevealedIndices={[1]}
        onUiCheckpoint={checkpoints}
      />,
    );
    expect(revealedCard("The Magician")).not.toBeNull();
    expect(revealedCard("The Fool")).toBeNull();
    expect(interpretationHeading()).toBeNull();
    expect(continueReading).not.toHaveBeenCalled();
    await user.click(next());
    expect(revealedCard("The Fool")).not.toBeNull();
    expect(checkpoints).toHaveBeenLastCalledWith([1, 0], false);
  });

  it("shows an acknowledged restored result without another interpretation request", () => {
    const continueReading = vi.fn(async () => "sent" as const);
    const { client } = createClient("mcp", { continueReading });
    render(
      <ReadingBoard
        reading={reading("Saved local interpretation")}
        client={client}
        language="en"
        onRestart={vi.fn()}
        initialRevealedIndices={[0, 1, 2]}
        initialContinuationSent
      />,
    );
    expect(interpretationHeading()).not.toBeNull();
    expect(screen.getByText("Saved local interpretation")).not.toBeNull();
    expect(revealedCard("The World")).not.toBeNull();
    expect(interpret()).toBeNull();
    expect(continueReading).not.toHaveBeenCalled();
  });
});

describe("ReadingBoard reveal", () => {
  it("keeps face-down names and the interpretation out of reach until the user turns every card", async () => {
    const user = userEvent.setup();
    const { client } = createClient("web");
    mount(client, reading("Local reading text"));

    expect(screen.getByRole("status").textContent).toBe("");
    expect(revealedCard("The Fool")).toBeNull();
    expect(hiddenFromAssistiveTech("The Fool")).toBe(true);
    expect(hiddenFromAssistiveTech(label("reversed"))).toBe(true);
    expect(interpretationHeading()).toBeNull();
    expect(screen.queryByText("Local reading text")).toBeNull();

    await user.click(next());
    expect(hiddenFromAssistiveTech("The Fool")).toBe(false);
    expect(revealedCard("The Fool")).not.toBeNull();
    const first = screen.getByRole("status").textContent ?? "";
    expect(first).toContain("Past");
    expect(first).toContain(
      label("revealedCard", {
        number: 1,
        name: "The Fool",
        orientation: label("upright"),
      }),
    );
    expect(first).not.toContain(label("allRevealed"));
    expect(hiddenFromAssistiveTech("The Magician")).toBe(true);
    expect(interpretationHeading()).toBeNull();

    // A revealed card opens its details even while the others stay face down.
    await user.click(revealedCard("The Fool")!);
    expect(screen.getByRole("dialog")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: label("close") }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: label("turnCard", { number: 3 }) }),
    );
    expect(revealedCard("The World")).not.toBeNull();
    expect(interpretationHeading()).toBeNull();

    await user.click(next());
    expect(revealedCard("The Magician")).not.toBeNull();
    expect(hiddenFromAssistiveTech(label("reversed"))).toBe(false);
    const finished = screen.getByRole("status").textContent ?? "";
    expect(finished).toContain(
      label("revealedCard", {
        number: 2,
        name: "The Magician",
        orientation: label("reversed"),
      }),
    );
    expect(finished).toContain(label("allRevealed"));
    expect(interpretationHeading()).not.toBeNull();
    expect(screen.getByText("Local reading text")).not.toBeNull();
    expect(document.activeElement).toBe(interpretationHeading());
    expect(
      screen.queryByRole("button", { name: label("revealNext") }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: label("revealAll") }),
    ).toBeNull();
    expect(interpret()).toBeNull();
  });

  it("turns the remaining cards once per batch and drops pending timers on unmount", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    const { client } = createClient("web");
    const { unmount } = mount(client);

    fireEvent.click(
      screen.getByRole("button", { name: label("turnCard", { number: 2 }) }),
    );
    const before = vi.getTimerCount();
    fireEvent.click(all());
    fireEvent.click(all());
    fireEvent.click(next());
    expect(vi.getTimerCount() - before).toBe(2);
    expect(next().disabled).toBe(true);
    expect(all().disabled).toBe(true);

    act(() => vi.advanceTimersByTime(0));
    expect(revealedCard("The Fool")).not.toBeNull();
    expect(revealedCard("The World")).toBeNull();
    expect(interpretationHeading()).toBeNull();
    act(() => vi.advanceTimersByTime(90));
    expect(revealedCard("The World")).not.toBeNull();
    expect(interpretationHeading()).not.toBeNull();
    unmount();

    const second = mount(client);
    const idle = vi.getTimerCount();
    fireEvent.click(all());
    expect(vi.getTimerCount() - idle).toBe(3);
    second.unmount();
    expect(vi.getTimerCount()).toBe(idle);
  });

  it("turns and opens overlapping cards through the position list without leaking hidden names", async () => {
    const user = userEvent.setup();
    const { client } = createClient("web");
    mount(client, celticReading());

    const list = positionList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    const turnFromList = within(list).getAllByRole("button");
    expect(turnFromList).toHaveLength(10);
    expect(turnFromList[1].getAttribute("aria-label")).toContain("Challenge");
    expect(turnFromList[1].getAttribute("aria-label")).toContain(
      label("turnCard", { number: 2 }),
    );
    expect(within(list).queryByText(/The Magician/)).toBeNull();
    expect(within(list).queryByText(/The Fool/)).toBeNull();

    await user.click(turnFromList[1]);
    expect(revealedCard("The Magician")).not.toBeNull();
    expect(within(list).getByText(/The Magician/).textContent).toContain(
      label("reversed"),
    );
    expect(within(list).queryByText(/The Fool/)).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Challenge");

    const opened = within(list).getAllByRole("button")[1];
    expect(opened.getAttribute("aria-label")).toContain("Challenge");
    expect(opened.getAttribute("aria-label")).toContain("The Magician");
    expect(opened.getAttribute("aria-label")).toContain(label("details"));
    await user.click(opened);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "The Magician" }),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: label("close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opened);

    // The card on the cloth and the list stay in step: turning from the cloth updates the list.
    await user.click(
      screen.getByRole("button", { name: label("turnCard", { number: 1 }) }),
    );
    expect(within(list).getByText(/The Fool/).textContent).toContain(
      label("upright"),
    );
    expect(
      within(list).getAllByRole("button")[0].getAttribute("aria-label"),
    ).toContain("Present");
    expect(interpretationHeading()).toBeNull();
  });

  it("reports a rejected full screen request without touching the revealed cards", async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Display mode not permitted"))
      .mockResolvedValueOnce(undefined);
    const { client } = createClient("mcp", {
      canRequestFullscreen: () => true,
      requestFullscreen,
    });
    mount(client);

    await user.click(next());
    const fullscreen = screen.getByRole<HTMLButtonElement>("button", {
      name: label("fullscreen"),
    });
    await user.click(fullscreen);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(label("fullscreenFailed"));
    expect(alert.textContent).toContain("Display mode not permitted");
    expect(revealedCard("The Fool")).not.toBeNull();
    expect(hiddenFromAssistiveTech("The Magician")).toBe(true);
    expect(fullscreen.disabled).toBe(false);

    await user.click(fullscreen);
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
    expect(revealedCard("The Fool")).not.toBeNull();
  });

  it("hides the full screen action when the host has no such display mode", () => {
    const { client } = createClient("mcp", {
      canRequestFullscreen: () => false,
      requestFullscreen: vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    });
    mount(client);
    expect(
      screen.queryByRole("button", { name: label("fullscreen") }),
    ).toBeNull();
  });
});

describe("ReadingBoard host continuation", () => {
  it("sends only on request and retries a failed send without confirming again", async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    const continueReading = vi
      .fn<NonNullable<DrawClient["continueReading"]>>()
      .mockReturnValueOnce(
        new Promise<"sent" | "unsupported">((_, fail) => {
          reject = fail;
        }),
      )
      .mockResolvedValueOnce("sent");
    const { client, confirmReading } = createClient("mcp", { continueReading });
    const current = reading();
    mount(client, current);

    expect(interpret()).toBeNull();
    await user.click(next());
    await user.click(next());
    await user.click(next());
    expect(interpretationHeading()).not.toBeNull();
    expect(continueReading).not.toHaveBeenCalled();
    expect(screen.getByText(label("noInterpretation"))).not.toBeNull();

    await user.click(interpret()!);
    await user.click(interpret()!);
    expect(continueReading).toHaveBeenCalledExactlyOnceWith(current);
    expect(screen.getByText(label("interpretationSending"))).not.toBeNull();
    expect((interpret() as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      reject(new Error("The host rejected the interpretation request."));
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(label("interpretationFailed"));
    expect(alert.textContent).toContain(
      "The host rejected the interpretation request.",
    );
    expect(interpret()).toBeNull();
    expect(revealedCard("The Fool")).not.toBeNull();
    expect(revealedCard("The World")).not.toBeNull();
    expect(confirmReading).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: label("tryAgain") }));
    expect(await screen.findByText(label("interpretationSent"))).not.toBeNull();
    expect(continueReading).toHaveBeenCalledTimes(2);
    expect(continueReading).toHaveBeenLastCalledWith(current);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByRole("button", { name: label("tryAgain") }),
    ).toBeNull();
    expect(interpret()).toBeNull();
    expect(confirmReading).not.toHaveBeenCalled();
  });

  it("reports a host that cannot continue while keeping the local interpretation", async () => {
    const user = userEvent.setup();
    const continueReading = vi
      .fn<NonNullable<DrawClient["continueReading"]>>()
      .mockResolvedValue("unsupported");
    const { client } = createClient("mcp", { continueReading });
    mount(client, reading("Local reading text"));

    await user.click(next());
    await user.click(next());
    await user.click(next());
    await user.click(interpret()!);
    expect(
      await screen.findByText(label("interpretationUnsupported")),
    ).not.toBeNull();
    expect(screen.getByText("Local reading text")).not.toBeNull();
    expect(interpret()).toBeNull();
    expect(
      screen.queryByRole("button", { name: label("tryAgain") }),
    ).toBeNull();
    expect(continueReading).toHaveBeenCalledOnce();
  });
});
