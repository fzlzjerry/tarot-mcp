import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { vi } from "vitest";
import type { ArcFanHandle } from "../ArcFan.js";
import { DrawStage } from "../DrawStage.js";
import { ReadingBoard } from "../ReadingBoard.js";
import { SetupForm } from "../SetupForm.js";
import { t } from "../i18n.js";
import type {
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
} from "../types.js";

function makeClient(target: DrawClient["target"] = "web"): DrawClient {
  return {
    target,
    beginReading: vi.fn<DrawClient["beginReading"]>(),
    confirmReading: vi.fn<DrawClient["confirmReading"]>(),
    resolveImage: async (card) => card.imageUri,
  };
}

function makeReading(): ConfirmedReading {
  return {
    readingId: "reading_m1",
    drawId: "draw_m1",
    spreadType: "three_card",
    spreadName: "Three Card Spread",
    question: "How should I frame this next chapter?",
    language: "en",
    cards: [
      {
        id: "fool",
        name: "The Fool",
        displayName: "The Fool",
        orientation: "upright",
        position: "Past",
        positionMeaning: "Where you are stepping from",
        meaning: "An unscripted opening asks for curiosity and light footing.",
        keywords: ["beginnings", "curiosity"],
        editionMotifs: ["Bright coastal cliff", "White rose", "Leaping white dog"],
        imageUri: "/assets/cards/midnight-art-nouveau-v1/fool.webp",
      },
      {
        id: "queen_of_swords",
        name: "Queen of Swords",
        displayName: "Queen of Swords",
        orientation: "reversed",
        position: "Present",
        positionMeaning: "What asks for clarity now",
        meaning: "Check whether sharpness protects clarity or guards an old hurt.",
        keywords: ["discernment", "boundaries"],
        editionMotifs: ["Upright gleaming silver sword", "Storm-blue clouds"],
        imageUri: "/assets/cards/midnight-art-nouveau-v1/queen_of_swords.webp",
      },
      {
        id: "ten_of_wands",
        name: "Ten of Wands",
        displayName: "Ten of Wands",
        orientation: "upright",
        position: "Future",
        positionMeaning: "Where the load is trending",
        meaning: "Real overload requires shedding what is no longer yours.",
        keywords: ["burden", "delegation"],
        imageUri: "/assets/cards/midnight-art-nouveau-v1/ten_of_wands.webp",
      },
    ],
  };
}

describe("Milestone 1 UI upgrades", () => {
  it("shows the Focused Card Spotlight only after reveal and navigates Prev/Next in both Spotlight and CardDetails", async () => {
    const user = userEvent.setup();
    render(
      <ReadingBoard
        reading={makeReading()}
        client={makeClient("web")}
        language="en"
        onRestart={vi.fn()}
      />,
    );

    // No spotlight while all cards are face down
    expect(screen.queryByText(t("en", "spotlightEyebrow"))).toBeNull();

    // Reveal first card -> Spotlight shows The Fool with edition motifs
    await user.click(
      screen.getByRole("button", { name: t("en", "revealNext") }),
    );
    const spotlight = screen.getByRole("region", {
      name: t("en", "spotlightEyebrow"),
    });
    expect(within(spotlight).getByText("The Fool")).not.toBeNull();
    expect(within(spotlight).getByText(/Bright coastal cliff/)).not.toBeNull();

    // Reveal second card -> Spotlight auto-focuses Queen of Swords, prev/next active
    await user.click(
      screen.getByRole("button", { name: t("en", "revealNext") }),
    );
    expect(within(spotlight).getByText("Queen of Swords")).not.toBeNull();

    await user.click(
      within(spotlight).getByRole("button", { name: t("en", "previousCard") }),
    );
    expect(within(spotlight).getByText("The Fool")).not.toBeNull();

    // Open full-plate CardDetails from Spotlight and step with ArrowRight
    await user.click(
      screen.getByRole("button", { name: t("en", "inspectFullCard") }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "The Fool" }),
    ).not.toBeNull();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(
      within(dialog).getByRole("heading", { name: "Queen of Swords" }),
    ).not.toBeNull();

    await user.click(within(dialog).getByRole("button", { name: t("en", "close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the active-slot ribbon and 78-card scrubber controls in DrawStage", () => {
    const slots = Array.from({ length: 78 }, (_, index) => ({
      slotId: `slot-${index + 1}`,
      index,
    }));
    const draw: BeginReadingPayload = {
      drawId: "draw_scrubber",
      readingKind: "spread",
      spreadType: "three_card",
      spreadName: "Three Card Spread",
      question: "Next steps?",
      language: "en",
      requiredCount: 3,
      slots,
      positions: [{ name: "Past" }, { name: "Present" }, { name: "Future" }],
    };

    const { rerender } = render(
      <DrawStage
        draw={draw}
        client={makeClient("web")}
        deckOrder={slots.map((s) => s.slotId)}
        selected={["slot-1"]}
        origins={{}}
        arcRef={createRef<ArcFanHandle>()}
        isConfirming={false}
        selectionLocked={false}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onOriginConsumed={vi.fn()}
        onDeparted={vi.fn()}
        onUndo={vi.fn()}
        onClear={vi.fn()}
        onConfirm={vi.fn()}
        language="en"
      />,
    );

    expect(
      screen.getByText(
        t("en", "nextSlotLabel", { number: 2, position: "Present" }),
      ),
    ).not.toBeNull();
    expect(
      screen.getByRole("slider", { name: t("en", "deckScrubber") }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: t("en", "scrollLeft") }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: t("en", "scrollRight") }),
    ).not.toBeNull();

    rerender(
      <DrawStage
        draw={draw}
        client={makeClient("web")}
        deckOrder={slots.map((s) => s.slotId)}
        selected={["slot-1", "slot-2", "slot-3"]}
        origins={{}}
        arcRef={createRef<ArcFanHandle>()}
        isConfirming={false}
        selectionLocked={false}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onOriginConsumed={vi.fn()}
        onDeparted={vi.fn()}
        onUndo={vi.fn()}
        onClear={vi.fn()}
        onConfirm={vi.fn()}
        language="en"
      />,
    );
    expect(
      screen.getByText(t("en", "allSlotsReady", { count: 3 })),
    ).not.toBeNull();
  });

  it("renders starter intention chips, miniature spread map, and v2 gate preview toggle in SetupForm", async () => {
    const user = userEvent.setup();
    render(
      <SetupForm
        language="en"
        client={makeClient("web")}
        onLanguageChange={vi.fn()}
        onSubmit={vi.fn()}
        isPending={false}
      />,
    );

    // Miniature spread layout map is rendered
    expect(
      screen.getByRole("img", { name: /Spread layout map/i }),
    ).not.toBeNull();

    // Clicking a quick-starter intention fills the question and switches spread
    await user.click(
      screen.getByRole("button", { name: t("en", "intentCareer") }),
    );
    const textarea = screen.getByLabelText(
      t("en", "question"),
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe(t("en", "intentCareerQ"));

    // Toggle to v2 Gate Preview updates caption cleanly
    await user.click(
      screen.getByRole("button", { name: t("en", "deckEditionV2") }),
    );
    expect(screen.getByText(t("en", "v2GateCaption"))).not.toBeNull();
  });
});
