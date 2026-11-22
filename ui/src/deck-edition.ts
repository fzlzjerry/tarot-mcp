import {
  VISUAL_CARD_V1_ASSET_BASE,
  VISUAL_CARD_V2_ASSET_BASE,
} from "@tarot/shared/artwork.js";

export type DeckEdition = "v1" | "v2";

export const V2_SHOWCASE_CARD_IDS = [
  "fool",
  "high_priestess",
  "three_of_cups",
  "queen_of_swords",
  "ten_of_wands",
  "three_of_pentacles",
] as const;

export function readInitialDeckEdition(): DeckEdition {
  if (typeof window === "undefined") return "v2";
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("deck") === "v1" ? "v1" : "v2";
  } catch {
    return "v2";
  }
}

export function setUrlDeckEdition(edition: DeckEdition): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (edition === "v1") url.searchParams.set("deck", "v1");
    else url.searchParams.delete("deck");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // Embedded / restricted hosts may disallow history mutations.
  }
}

export function resolveWebCardAssetUrl(
  cardId: string,
  _fallbackUri?: string,
  edition: DeckEdition = readInitialDeckEdition(),
): string {
  if (edition === "v1") {
    return `${VISUAL_CARD_V1_ASSET_BASE}/${cardId}.webp`;
  }
  return `${VISUAL_CARD_V2_ASSET_BASE}/${cardId}.webp`;
}
