import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DeckGalleryButton } from "../DeckGallery.js";
import { t } from "../i18n.js";
import type { DeckCard, DrawClient } from "../types.js";

const card = (
  id: string,
  name: string,
  upright: string[],
  reversed: string[],
  group: Pick<DeckCard, "arcana" | "suit" | "number">,
): DeckCard => ({
  id,
  name,
  displayName: name,
  keywords: { upright, reversed },
  ...group,
});

const deck: DeckCard[] = [
  card("fool", "The Fool", ["beginnings", "trust"], ["recklessness"], {
    arcana: "major",
    number: 0,
  }),
  card("star", "The Star", ["hope", "renewal"], ["doubt"], {
    arcana: "major",
    number: 17,
  }),
  card("ace_of_cups", "Ace of Cups", ["new feeling"], ["blocked feeling"], {
    arcana: "minor",
    suit: "cups",
    number: 1,
  }),
  card("two_of_cups", "Two of Cups", ["partnership"], ["imbalance"], {
    arcana: "minor",
    suit: "cups",
    number: 2,
  }),
  card("ace_of_swords", "Ace of Swords", ["clarity"], ["confusion"], {
    arcana: "minor",
    suit: "swords",
    number: 1,
  }),
];

function createClient(overrides: Partial<DrawClient> = {}) {
  const listCards = vi.fn<NonNullable<DrawClient["listCards"]>>(
    async () => deck,
  );
  const client: DrawClient = {
    target: "web",
    beginReading: vi.fn<DrawClient["beginReading"]>(),
    confirmReading: vi.fn<DrawClient["confirmReading"]>(),
    listCards,
    getCardThumbnail: (cardId) => `/thumbs/${cardId}.webp`,
    resolveImage: async (shown) => `/plates/${shown.id}.webp`,
    ...overrides,
  };
  return { client, listCards };
}

const label = (
  key: Parameters<typeof t>[1],
  values?: Record<string, string | number>,
) => t("en", key, values);

async function openGallery(client: DrawClient) {
  const user = userEvent.setup();
  render(<DeckGalleryButton client={client} language="en" />);
  await user.click(screen.getByRole("button", { name: label("galleryOpen") }));
  const gallery = await screen.findByRole("dialog", {
    name: label("galleryTitle"),
  });
  await within(gallery).findByText(
    label("galleryCount", { shown: deck.length, total: deck.length }),
  );
  return { user, gallery: within(gallery) };
}

const thumbnails = (gallery: { getAllByRole(role: string): HTMLElement[] }) =>
  gallery
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("data-card"))
    .map((button) => button.textContent);

describe("deck gallery", () => {
  it("is offered only where the client can list the deck", () => {
    const { client } = createClient({ listCards: undefined });
    const { container } = render(
      <DeckGalleryButton client={client} language="en" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("lists the whole deck by group, with a small face for every card", async () => {
    const { client, listCards } = createClient();
    const { gallery } = await openGallery(client);

    expect(listCards).toHaveBeenCalledTimes(1);
    expect(listCards.mock.calls[0][0]).toBe("en");
    expect(
      gallery.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual([
      `${label("galleryMajor")}2`,
      `${label("galleryCups")}2`,
      `${label("gallerySwords")}1`,
    ]);
    expect(thumbnails(gallery)).toEqual(deck.map(({ name }) => name));
    const star = gallery.getByRole("button", { name: "The Star" });
    expect(star.querySelector("img")?.getAttribute("src")).toBe(
      "/thumbs/star.webp",
    );
  });

  it("asks for the catalog once per client and language", async () => {
    const { client, listCards } = createClient();
    const first = await openGallery(client);
    await first.user.click(
      first.gallery.getByRole("button", { name: label("close") }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    await first.user.click(
      screen.getByRole("button", { name: label("galleryOpen") }),
    );
    expect(
      await screen.findByRole("button", { name: "The Fool" }),
    ).not.toBeNull();
    expect(listCards).toHaveBeenCalledTimes(1);
  });

  it("finds cards by name, keyword or suit and narrows by group", async () => {
    const { client } = createClient();
    const { user, gallery } = await openGallery(client);
    const search = gallery.getByRole("searchbox", {
      name: label("gallerySearch"),
    });

    await user.type(search, "HOPE");
    expect(thumbnails(gallery)).toEqual(["The Star"]);
    expect(
      gallery.getByText(label("galleryCount", { shown: 1, total: 5 })),
    ).not.toBeNull();

    await user.clear(search);
    await user.type(search, "ace cups");
    expect(thumbnails(gallery)).toEqual(["Ace of Cups"]);

    await user.clear(search);
    const swords = gallery.getByRole("button", {
      name: label("gallerySwords"),
    });
    await user.click(swords);
    expect(swords.getAttribute("aria-pressed")).toBe("true");
    expect(thumbnails(gallery)).toEqual(["Ace of Swords"]);

    await user.type(search, "hope");
    expect(gallery.getByRole("status").textContent).toBe(label("galleryEmpty"));
    await user.click(
      gallery.getByRole("button", { name: label("galleryClear") }),
    );
    expect(thumbnails(gallery)).toHaveLength(deck.length);
    expect(
      gallery
        .getByRole("button", { name: label("galleryAll") })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("opens a card with both sets of keywords and pages through the cards on show", async () => {
    const { client } = createClient();
    const { user, gallery } = await openGallery(client);

    await user.click(gallery.getByRole("button", { name: "The Star" }));
    expect(
      gallery.getByRole("heading", { level: 3, name: "The Star" }),
    ).not.toBeNull();
    expect(gallery.getByText(`${label("galleryMajor")} · 17`)).not.toBeNull();
    expect(gallery.getByText("hope")).not.toBeNull();
    expect(gallery.getByText("doubt")).not.toBeNull();
    expect(
      (await gallery.findByRole("img", { name: "The Star" })).getAttribute(
        "src",
      ),
    ).toBe("/plates/star.webp");
    // Search and filters step aside while one card has the drawer.
    expect(gallery.queryByRole("searchbox")).toBeNull();

    await user.click(
      gallery.getByRole("button", { name: new RegExp(label("galleryNext")) }),
    );
    expect(
      gallery.getByRole("heading", { level: 3, name: "Ace of Cups" }),
    ).not.toBeNull();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(
      gallery.getByRole("heading", { level: 3, name: "The Fool" }),
    ).not.toBeNull();
    expect(
      gallery.getByRole<HTMLButtonElement>("button", {
        name: new RegExp(label("galleryPrevious")),
      }).disabled,
    ).toBe(true);

    await user.click(
      gallery.getByRole("button", { name: new RegExp(label("galleryBack")) }),
    );
    expect(document.activeElement).toBe(
      gallery.getByRole("button", { name: "The Fool" }),
    );
  });

  it("reports a deck that would not load and loads it on a second try", async () => {
    const listCards = vi
      .fn<NonNullable<DrawClient["listCards"]>>()
      .mockRejectedValueOnce(new Error("Request failed (503)"))
      .mockResolvedValueOnce(deck);
    const { client } = createClient({ listCards });
    const user = userEvent.setup();
    render(<DeckGalleryButton client={client} language="en" />);
    await user.click(
      screen.getByRole("button", { name: label("galleryOpen") }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(label("galleryFailed"));
    expect(alert.textContent).toContain("Request failed (503)");
    await user.click(
      within(alert).getByRole("button", { name: label("tryAgain") }),
    );
    expect(
      await screen.findByRole("button", { name: "The Fool" }),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
