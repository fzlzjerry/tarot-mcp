import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { DrawApp } from "../DrawApp.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  TarotUiSnapshot,
} from "../types.js";

function createClient() {
  const beginReading = vi.fn(
    async (input: BeginReadingInput): Promise<BeginReadingPayload> => ({
      drawId: "draw_test",
      readingKind: input.readingKind,
      spreadType:
        input.readingKind === "spread" ? input.spreadType : input.readingKind,
      spreadName: "Three Card Spread",
      question: input.question ?? "",
      language: input.language,
      requiredCount: 3,
      slots: Array.from({ length: 78 }, (_, index) => ({
        slotId: `opaque-${index + 1}`,
        index,
      })),
      deckBackImageUri: "data:image/webp;base64,YmFjaw==",
      positions: [{ name: "Past" }, { name: "Present" }, { name: "Future" }],
    }),
  );
  const confirmReading = vi.fn(async (): Promise<ConfirmedReading> => ({
    readingId: "reading_test",
    spreadType: "three_card",
    spreadName: "Three Card Spread",
    question: "What next?",
    language: "en" as const,
    cards: [
      {
        id: "fool",
        name: "The Fool",
        displayName: "The Fool",
        orientation: "upright" as const,
        position: "Past",
      },
      {
        id: "magician",
        name: "The Magician",
        displayName: "The Magician",
        orientation: "reversed" as const,
        position: "Present",
      },
      {
        id: "world",
        name: "The World",
        displayName: "The World",
        orientation: "upright" as const,
        position: "Future",
      },
    ],
  }));
  const client: DrawClient = {
    target: "web",
    beginReading,
    confirmReading,
    resolveImage: async () => undefined,
  };
  return { client, beginReading, confirmReading };
}

function persistentWidget(
  client: DrawClient,
  store: { snapshot?: TarotUiSnapshot },
) {
  let host!: Parameters<NonNullable<DrawClient["subscribeInitial"]>>[0];
  return {
    client: {
      ...client,
      target: "mcp" as const,
      readUiState: () => store.snapshot,
      writeUiState: (snapshot: TarotUiSnapshot) => {
        store.snapshot = structuredClone(snapshot);
      },
      subscribeInitial(handlers: typeof host) {
        host = handlers;
        return () => undefined;
      },
    },
    get host() {
      return host;
    },
  };
}

describe("DrawApp widget state recovery", () => {
  it("preserves restart-only recovery for a frozen confirmation already known to be expired", async () => {
    const remote = createClient();
    const draw = await remote.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What next?",
      language: "en",
    });
    const selectedSlotIds = ["opaque-3", "opaque-1", "opaque-2"];
    const widget = persistentWidget(remote.client, {
      snapshot: {
        version: 1,
        drawId: draw.drawId,
        deckOrder: draw.slots.map((slot) => slot.slotId),
        selectedSlotIds,
        pendingConfirmation: {
          selectedSlotIds,
          failure: { code: "DRAW_EXPIRED", httpStatus: 410 },
        },
        revealedIndices: [],
        continuationSent: false,
      },
    });
    render(<DrawApp client={widget.client} />);
    act(() => widget.host.onBegin(draw));
    const notice = within(screen.getByRole("alert"));
    expect(notice.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(notice.getByRole("button", { name: "New reading" })).not.toBeNull();
    expect(remote.confirmReading).not.toHaveBeenCalled();
  });

  it("keeps a lost confirmation frozen after remount and retries only the original ordered slots", async () => {
    const user = userEvent.setup();
    const remote = createClient();
    const draw = await remote.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What next?",
      language: "en",
    });
    const result = { ...(await remote.confirmReading()), drawId: draw.drawId };
    const store: { snapshot?: TarotUiSnapshot } = {};
    const ordered = ["opaque-3", "opaque-1", "opaque-2"];
    let delivered = false;
    const confirmReading = vi.fn<DrawClient["confirmReading"]>(
      async (_drawId, slots) => {
        expect(store.snapshot?.pendingConfirmation?.selectedSlotIds).toEqual(
          ordered,
        );
        expect(slots).toEqual(ordered);
        if (!delivered) {
          delivered = true;
          throw Object.assign(
            new Error("Successful confirmation response was lost"),
            { code: -32000 },
          );
        }
        return result;
      },
    );
    const client = { ...remote.client, confirmReading };
    const first = persistentWidget(client, store);
    const mounted = render(
      <StrictMode>
        <DrawApp client={first.client} />
      </StrictMode>,
    );
    act(() => first.host.onBegin(draw));
    await user.click(
      screen.getByRole("button", { name: "Skip remaining ritual" }),
    );
    for (const n of [3, 1, 2])
      await user.click(screen.getByRole("button", { name: `Card back ${n}` }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));
    await screen.findByRole("alert");
    expect(confirmReading).toHaveBeenCalledOnce();
    mounted.unmount();

    const second = persistentWidget(client, store);
    render(
      <StrictMode>
        <DrawApp client={second.client} />
      </StrictMode>,
    );
    act(() => second.host.onBegin(draw));
    expect(
      screen.getByRole("heading", { name: "Select the cards" }),
    ).not.toBeNull();
    const positions = within(
      screen.getByRole("list", { name: "Spread positions" }),
    );
    for (const button of positions.getAllByRole<HTMLButtonElement>("button")) {
      expect(button.disabled).toBe(true);
      await user.click(button);
    }
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    await user.click(screen.getByRole("button", { name: "Undo last" }));
    await user.click(screen.getByRole("button", { name: "Card back 4" }));
    screen.getByRole("button", { name: /^Card back 1\b/ }).focus();
    await user.keyboard("[Backspace][Space]{Control>}[Enter]{/Control}");
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Confirm selection",
      }).disabled,
    ).toBe(true);
    expect(store.snapshot?.selectedSlotIds).toEqual(ordered);
    expect(confirmReading).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Your reading" });
    expect(confirmReading.mock.calls.map(([id, slots]) => [id, slots])).toEqual(
      [
        [draw.drawId, ordered],
        [draw.drawId, ordered],
      ],
    );
    expect(store.snapshot?.pendingConfirmation).toBeUndefined();
    expect(store.snapshot?.confirmedReading?.readingId).toBe(result.readingId);
  });

  it("removes a restored lock only after an explicit input rejection and preserves that correction state", async () => {
    const user = userEvent.setup();
    const remote = createClient();
    const draw = await remote.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What next?",
      language: "en",
    });
    const store: { snapshot?: TarotUiSnapshot } = {
      snapshot: {
        version: 1,
        drawId: draw.drawId,
        deckOrder: draw.slots.map((slot) => slot.slotId),
        selectedSlotIds: ["opaque-3", "opaque-1", "opaque-2"],
        pendingConfirmation: {
          selectedSlotIds: ["opaque-3", "opaque-1", "opaque-2"],
        },
        revealedIndices: [],
        continuationSent: false,
      },
    };
    const confirmReading = vi
      .fn<DrawClient["confirmReading"]>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Invalid selection"), {
          code: "INVALID_SLOT",
          httpStatus: 400,
        }),
      );
    const client = { ...remote.client, confirmReading };
    const first = persistentWidget(client, store);
    const mounted = render(<DrawApp client={first.client} />);
    act(() => first.host.onBegin(draw));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(store.snapshot?.pendingConfirmation).toBeUndefined(),
    );
    const remove = within(
      screen.getByRole("list", { name: "Spread positions" }),
    ).getByRole("button", { name: "Remove selection 1 from Past" });
    await user.click(remove);
    expect(store.snapshot?.selectedSlotIds).toEqual(["opaque-1", "opaque-2"]);
    mounted.unmount();
    const second = persistentWidget(client, store);
    render(<DrawApp client={second.client} />);
    act(() => second.host.onBegin(draw));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      within(screen.getByRole("list", { name: "Spread positions" }))
        .getAllByRole<HTMLButtonElement>("button")
        .every((button) => !button.disabled),
    ).toBe(true);
    expect(confirmReading).toHaveBeenCalledOnce();
  });

  it("keeps the revealed result when sending immediately unmounts the widget and the host replays its original pending draw", async () => {
    const user = userEvent.setup();
    const remote = createClient();
    const draw = await remote.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What next?",
      language: "en",
    });
    const store: { snapshot?: TarotUiSnapshot } = {};
    const first = persistentWidget(remote.client, store);
    let resolveSend!: (result: "sent") => void;
    const continueReading = vi.fn(() => {
      expect(store.snapshot?.confirmedReading?.cards).toHaveLength(3);
      expect(store.snapshot?.revealedIndices).toEqual([0, 1, 2]);
      mounted.unmount();
      return new Promise<"sent">((resolve) => {
        resolveSend = resolve;
      });
    });
    const mounted = render(
      <StrictMode>
        <DrawApp client={{ ...first.client, continueReading }} />
      </StrictMode>,
    );
    act(() => first.host.onBegin(draw));
    await user.click(
      screen.getByRole("button", { name: "Skip remaining ritual" }),
    );
    for (const n of [1, 2, 3])
      await user.click(screen.getByRole("button", { name: `Card back ${n}` }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));
    await screen.findByRole("heading", { name: "Your reading" });
    for (let n = 0; n < 3; n++)
      await user.click(screen.getByRole("button", { name: "Turn next card" }));
    await user.click(
      screen.getByRole("button", { name: "Interpret in ChatGPT" }),
    );

    const second = persistentWidget(
      { ...remote.client, continueReading },
      store,
    );
    render(
      <StrictMode>
        <DrawApp client={second.client} />
      </StrictMode>,
    );
    expect(screen.queryByRole("heading", { name: "Your reading" })).toBeNull();
    expect(
      screen.getByText("Waiting for the reading to begin…"),
    ).not.toBeNull();
    act(() => second.host.onBegin(draw));
    expect(
      await screen.findByRole("heading", { name: "Your reading" }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Shuffle and cut" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Turn next card" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "The Fool. View card details" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "The Magician. View card details" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "The World. View card details" }),
    ).not.toBeNull();
    expect(continueReading).toHaveBeenCalledOnce();
    expect(remote.beginReading).toHaveBeenCalledOnce();
    expect(remote.confirmReading).toHaveBeenCalledOnce();

    act(() => second.host.onBegin({ ...draw, drawId: "draw_other" }));
    await user.click(
      screen.getByRole("button", { name: "Skip remaining ritual" }),
    );
    expect(store.snapshot?.drawId).toBe("draw_other");
    await act(async () => {
      resolveSend("sent");
    });
    expect(store.snapshot?.drawId).toBe("draw_other");
    expect(store.snapshot?.confirmedReading).toBeUndefined();
    expect(
      screen.getByRole("heading", { name: "Select the cards" }),
    ).not.toBeNull();
  });

  it("restores acknowledged continuation without automatically sending it again", async () => {
    const user = userEvent.setup();
    const remote = createClient();
    const draw = await remote.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What next?",
      language: "en",
    });
    const reading = { ...(await remote.confirmReading()), drawId: draw.drawId };
    const store = {
      snapshot: {
        version: 1 as const,
        drawId: draw.drawId,
        deckOrder: draw.slots.map((slot) => slot.slotId),
        selectedSlotIds: ["opaque-3", "opaque-1", "opaque-2"],
        confirmedReading: reading,
        revealedIndices: [0, 1, 2],
        continuationSent: false,
      },
    };
    const continueReading = vi.fn(async () => "sent" as const);
    const first = persistentWidget(
      { ...remote.client, continueReading },
      store,
    );
    const mounted = render(<DrawApp client={first.client} />);
    act(() => first.host.onBegin(draw));
    await user.click(
      screen.getByRole("button", { name: "Interpret in ChatGPT" }),
    );
    await waitFor(() => expect(store.snapshot.continuationSent).toBe(true));
    mounted.unmount();
    const second = persistentWidget(
      { ...remote.client, continueReading },
      store,
    );
    render(<DrawApp client={second.client} />);
    act(() => second.host.onBegin(draw));
    expect(
      screen.getByRole("heading", { name: "Your reading" }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Interpret in ChatGPT" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "The World. View card details" }),
    ).not.toBeNull();
    expect(continueReading).toHaveBeenCalledOnce();
  });

  it("restores the pending opaque order and selection but still requires manual confirmation", async () => {
    const user = userEvent.setup();
    const remote = createClient();
    const draw = await remote.beginReading({
      readingKind: "spread",
      spreadType: "three_card",
      question: "What next?",
      language: "en",
    });
    const store = {
      snapshot: {
        version: 1 as const,
        drawId: draw.drawId,
        deckOrder: draw.slots.map((slot) => slot.slotId).reverse(),
        selectedSlotIds: ["opaque-78", "opaque-77"],
        revealedIndices: [],
        continuationSent: false,
      },
    };
    const widget = persistentWidget(remote.client, store);
    render(<DrawApp client={widget.client} />);
    act(() => widget.host.onBegin(draw));
    expect(
      screen.getByRole("heading", { name: "Select the cards" }),
    ).not.toBeNull();
    expect(remote.confirmReading).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Card back 3" }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));
    await screen.findByRole("heading", { name: "Your reading" });
    expect(remote.confirmReading).toHaveBeenCalledExactlyOnceWith(
      draw.drawId,
      ["opaque-78", "opaque-77", "opaque-76"],
      expect.anything(),
    );
  });
});

describe("DrawApp", () => {
  it("retries preparing the same question after a network failure", async () => {
    const user = userEvent.setup();
    const { client, beginReading } = createClient();
    beginReading.mockRejectedValueOnce(new TypeError("Connection interrupted"));
    render(<DrawApp client={client} />);
    await user.type(
      screen.getByLabelText("Question or focus"),
      "Keep this question",
    );
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Shuffle and cut" });
    expect(beginReading).toHaveBeenCalledTimes(2);
    expect(beginReading.mock.calls[1][0]).toEqual(
      beginReading.mock.calls[0][0],
    );
  });

  it("focuses the invalid field and allows daily guidance without a question", async () => {
    const user = userEvent.setup();
    const { client, beginReading } = createClient();
    render(<DrawApp client={client} />);
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    const question = screen.getByLabelText("Question or focus");
    expect(question.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(question);
    expect(beginReading).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Daily guidance" }));
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    await screen.findByRole("heading", { name: "Shuffle and cut" });
    expect(beginReading.mock.calls[0][0]).toMatchObject({
      readingKind: "daily",
      language: "en",
    });
  });

  it("applies the chosen cut to the cards later confirmed", async () => {
    const user = userEvent.setup();
    const { client, confirmReading } = createClient();
    const random = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((array) => {
        (array as Uint32Array)[0] = 12345;
        return array;
      });
    render(<DrawApp client={client} />);

    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    await user.click(
      await screen.findByRole("button", { name: "Start shuffling" }),
    );
    await user.click(
      await screen.findByRole(
        "button",
        { name: "Cut the deck" },
        { timeout: 3000 },
      ),
    );

    const cut = await screen.findByRole(
      "slider",
      { name: "Cut here" },
      { timeout: 3_000 },
    );
    await waitFor(() => expect(document.activeElement).toBe(cut));
    await user.keyboard("[Home][ArrowUp][ArrowUp][ArrowUp]");
    expect(cut.getAttribute("aria-valuenow")).toBe("3");
    await user.click(screen.getByRole("button", { name: "Cut here" }));

    await screen.findAllByRole("button", { name: /^Card back/ });
    await user.click(screen.getByRole("button", { name: "Card back 1" }));
    await user.click(screen.getByRole("button", { name: "Card back 2" }));
    await user.click(screen.getByRole("button", { name: "Card back 3" }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));

    const expected = ["opaque-54", "opaque-9", "opaque-18"];
    expect(random).toHaveBeenCalledOnce();
    random.mockRestore();
    await waitFor(() =>
      expect(confirmReading).toHaveBeenCalledWith(
        "draw_test",
        expected,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it("runs setup, ordered selection, undo, confirmation, reveal, and details", async () => {
    const user = userEvent.setup();
    const { client, confirmReading } = createClient();
    render(<DrawApp client={client} />);

    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    // Explicitly skipping before a shuffle preserves the server's order.
    await user.click(
      await screen.findByRole("button", { name: "Skip remaining ritual" }),
    );
    expect(
      await screen.findAllByRole("button", { name: /^Card back/ }),
    ).toHaveLength(78);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Select the cards" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Card back 1" }));
    const removeFirst = within(
      screen.getByRole("list", { name: "Spread positions" }),
    ).getByRole("button", {
      name: "Remove selection 1 from Past",
    });
    expect(removeFirst).not.toBeNull();
    await user.click(removeFirst);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Card back 1" }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Card back 1" }));
    await user.click(screen.getByRole("button", { name: "Card back 2" }));
    await user.click(screen.getByRole("button", { name: "Undo last" }));
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Confirm selection",
      }).disabled,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Card back 2" }));
    await user.click(screen.getByRole("button", { name: "Card back 3" }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));

    await waitFor(() =>
      expect(confirmReading).toHaveBeenCalledWith(
        "draw_test",
        ["opaque-1", "opaque-2", "opaque-3"],
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Your reading" }),
    ).not.toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Your reading" }),
      ),
    );
    // Face-down cards stay reachable so they can be turned by keyboard or tap.
    const faceDownCards = screen
      .getAllByRole("button", { hidden: true })
      .filter((button) => button.classList.contains("reading-card"));
    expect(faceDownCards).toHaveLength(3);
    for (const card of faceDownCards) {
      expect((card as HTMLButtonElement).disabled).toBe(false);
    }
    expect(screen.getByRole("button", { name: "Turn card 2" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Turn card 3" }));
    expect(
      screen.getByRole("button", { name: "The World. View card details" }),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Turn next card" }));
    const foolCard = screen.getByRole("button", {
      name: "The Fool. View card details",
    });
    expect((foolCard as HTMLButtonElement).disabled).toBe(false);
    await user.click(foolCard);
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "The Fool" })).not.toBeNull();
    const close = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(close);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(foolCard);
  });

  it("switches the setup experience between English and Chinese", async () => {
    const user = userEvent.setup();
    const { client } = createClient();
    render(<DrawApp client={client} />);
    await user.selectOptions(screen.getByLabelText("Language"), "zh");
    expect(screen.getByRole("heading", { name: "选择你的牌" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "进入抽牌仪式" })).not.toBeNull();
    await waitFor(() => expect(document.documentElement.lang).toBe("zh"));
  });

  it("retries confirmation with the same selection after a transient failure", async () => {
    const user = userEvent.setup();
    const { client, confirmReading } = createClient();
    confirmReading.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<DrawApp client={client} />);

    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    await user.click(
      await screen.findByRole("button", { name: "Skip remaining ritual" }),
    );
    await screen.findAllByRole("button", { name: /^Card back/ });
    await user.click(screen.getByRole("button", { name: "Card back 1" }));
    await user.click(screen.getByRole("button", { name: "Card back 2" }));
    await user.click(screen.getByRole("button", { name: "Card back 3" }));
    const table = screen.getByRole("heading", { name: "Select the cards" });
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(confirmReading).toHaveBeenCalledTimes(1);
    const firstBack = screen.getByRole("button", { name: /^Card back 1\b/ });
    await user.click(firstBack);
    await user.click(screen.getByRole("button", { name: "Undo last" }));
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getByRole("heading", { name: "Select the cards" })).toBe(
      table,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Your reading" }),
    ).not.toBeNull();
    expect(confirmReading).toHaveBeenCalledTimes(2);
    expect(confirmReading).toHaveBeenLastCalledWith(
      "draw_test",
      ["opaque-1", "opaque-2", "opaque-3"],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("offers only a new reading when the selected deck expires", async () => {
    const user = userEvent.setup();
    const { client, beginReading, confirmReading } = createClient();
    confirmReading.mockRejectedValueOnce(
      Object.assign(new Error("Unavailable"), {
        code: "DRAW_EXPIRED",
        httpStatus: 410,
      }),
    );
    render(<DrawApp client={client} />);
    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Begin the ritual" }));
    await user.click(
      await screen.findByRole("button", { name: "Skip remaining ritual" }),
    );
    for (const n of [1, 2, 3])
      await user.click(screen.getByRole("button", { name: `Card back ${n}` }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Card back/ })).toHaveLength(
      78,
    );
    expect(beginReading).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "New reading" }));
    expect(screen.getByLabelText("Question or focus")).not.toBeNull();
    expect(beginReading).toHaveBeenCalledOnce();
  });

  it("preserves reveals on host replay and resets them for a different reading", async () => {
    const user = userEvent.setup();
    const { client: webClient } = createClient();
    const client: DrawClient = { ...webClient, target: "mcp" };
    let host!: Parameters<NonNullable<DrawClient["subscribeInitial"]>>[0];
    client.subscribeInitial = (handlers) => {
      host = handlers;
      return () => undefined;
    };
    const first: ConfirmedReading = {
      drawId: "draw_one",
      readingId: "reading_one",
      language: "en",
      spreadType: "single_card",
      spreadName: "Single Card",
      question: "Today?",
      cards: [
        {
          id: "fool",
          name: "The Fool",
          displayName: "The Fool",
          orientation: "upright",
          position: "Focus",
        },
      ],
    };
    render(<DrawApp client={client} />);
    act(() => host.onConfirmed(first));
    await user.click(screen.getByRole("button", { name: "Turn next card" }));
    act(() => host.onConfirmed({ ...first }));
    expect(
      screen.getByRole("button", { name: "The Fool. View card details" }),
    ).not.toBeNull();
    act(() =>
      host.onConfirmed({
        ...first,
        drawId: "draw_two",
        readingId: "reading_two",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "The Fool. View card details" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Turn next card" }),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "New reading" }));
    expect(screen.getByLabelText("Question or focus")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Tarot" })).toBeNull();
    expect(document.querySelectorAll(".deck-preview img")).toHaveLength(0);
  });

  it("waits for a browser handoff and clears it before starting a new reading", async () => {
    const user = userEvent.setup();
    const { client } = createClient();
    const clearHandoff = vi.fn();
    let initialHandlers:
      Parameters<NonNullable<DrawClient["subscribeInitial"]>>[0] | undefined;
    client.startsWithHandoff = () => true;
    client.clearHandoff = clearHandoff;
    client.subscribeInitial = (handlers) => {
      initialHandlers = handlers;
      return () => undefined;
    };

    render(<DrawApp client={client} />);
    expect(
      screen.getByText("Waiting for the reading to begin…"),
    ).not.toBeNull();

    act(() => {
      initialHandlers?.onConfirmed({
        readingId: "reading_handoff",
        drawId: "draw_handoff",
        spreadType: "single_card",
        spreadName: "Single Card",
        question: "Browser handoff",
        language: "en",
        cards: [
          {
            id: "fool",
            name: "The Fool",
            displayName: "The Fool",
            orientation: "upright",
          },
        ],
      });
    });

    expect(
      await screen.findByRole("heading", { name: "Your reading" }),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "New reading" }));

    expect(clearHandoff).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "Choose your cards" }),
    ).not.toBeNull();
  });
});
