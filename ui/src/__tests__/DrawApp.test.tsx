import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DrawApp } from "../DrawApp.js";
import { ritualOrder } from "../deck-order.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
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

describe("DrawApp", () => {
  it("applies the chosen cut to the cards later confirmed", async () => {
    const user = userEvent.setup();
    const { client, confirmReading } = createClient();
    render(<DrawApp client={client} />);

    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Lay out the deck" }));

    const cut = await screen.findByRole(
      "slider",
      { name: "Cut here" },
      { timeout: 2_000 },
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

    const baseOrder = Array.from(
      { length: 78 },
      (_, index) => `opaque-${index + 1}`,
    );
    const expected = ritualOrder(baseOrder, 3, 148).slice(0, 3);
    expect(expected).not.toEqual(baseOrder.slice(0, 3));
    await waitFor(() =>
      expect(confirmReading).toHaveBeenCalledWith("draw_test", expected),
    );
  });

  it("runs setup, ordered selection, undo, confirmation, reveal, and details", async () => {
    const user = userEvent.setup();
    const { client, confirmReading } = createClient();
    render(<DrawApp client={client} />);

    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Lay out the deck" }));
    // The ritual runs first; skipping leaves the server's order untouched.
    await user.click(
      await screen.findByRole("button", { name: "Skip and deal" }),
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
    const removeFirst = screen.getByRole("button", {
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
      expect(confirmReading).toHaveBeenCalledWith("draw_test", [
        "opaque-1",
        "opaque-2",
        "opaque-3",
      ]),
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
    expect(
      screen.getByRole("button", { name: "Turn card 2" }),
    ).not.toBeNull();
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
    expect(screen.getByRole("button", { name: "铺开牌组" })).not.toBeNull();
    await waitFor(() => expect(document.documentElement.lang).toBe("zh"));
  });

  it("retries confirmation with the same selection after a transient failure", async () => {
    const user = userEvent.setup();
    const { client, confirmReading } = createClient();
    confirmReading.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<DrawApp client={client} />);

    await user.type(screen.getByLabelText("Question or focus"), "What next?");
    await user.click(screen.getByRole("button", { name: "Lay out the deck" }));
    await user.click(
      await screen.findByRole("button", { name: "Skip and deal" }),
    );
    await screen.findAllByRole("button", { name: /^Card back/ });
    await user.click(screen.getByRole("button", { name: "Card back 1" }));
    await user.click(screen.getByRole("button", { name: "Card back 2" }));
    await user.click(screen.getByRole("button", { name: "Card back 3" }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));

    expect(await screen.findByText("Failed to fetch")).not.toBeNull();
    expect(confirmReading).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Your reading" }),
    ).not.toBeNull();
    expect(confirmReading).toHaveBeenCalledTimes(2);
    expect(confirmReading).toHaveBeenLastCalledWith("draw_test", [
      "opaque-1",
      "opaque-2",
      "opaque-3",
    ]);
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
