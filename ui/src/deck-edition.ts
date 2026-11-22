import {
  VISUAL_CARD_ASSET_BASE,
  VISUAL_CARD_V2_ASSET_BASE,
} from "@tarot/shared/artwork.js";

export type DeckEdition = "v1" | "v2";

export const V2_GATE_CARD_IDS = [
  "fool",
  "three_of_cups",
  "three_of_pentacles",
  "queen_of_swords",
  "ten_of_wands",
] as const;

export const V2_GATE_CARD_SET: ReadonlySet<string> = new Set(V2_GATE_CARD_IDS);

export function readInitialDeckEdition(): DeckEdition {
  if (typeof window === "undefined") return "v1";
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("deck") === "v2" ? "v2" : "v1";
  } catch {
    return "v1";
  }
}

export function setUrlDeckEdition(edition: DeckEdition): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (edition === "v2") url.searchParams.set("deck", "v2");
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
  fallbackUri: string | undefined,
  edition: DeckEdition = readInitialDeckEdition(),
  hiRes = false,
): string | undefined {
  if (edition === "v2") {
    if (cardId === "back") {
      return hiRes
        ? `${VISUAL_CARD_V2_ASSET_BASE}/w1024/back.webp`
        : `${VISUAL_CARD_V2_ASSET_BASE}/back.webp`;
    }
    if (V2_GATE_CARD_SET.has(cardId)) {
      return hiRes
        ? `${VISUAL_CARD_V2_ASSET_BASE}/w1024/${cardId}.webp`
        : `${VISUAL_CARD_V2_ASSET_BASE}/${cardId}.webp`;
    }
  }
  return fallbackUri ?? `${VISUAL_CARD_ASSET_BASE}/${cardId}.webp`;
}

export function isV2GateCard(cardId: string): boolean {
  return V2_GATE_CARD_SET.has(cardId);
}
