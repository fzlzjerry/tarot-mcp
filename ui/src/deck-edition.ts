import { VISUAL_CARD_V2_ASSET_BASE } from "@tarot/shared/artwork.js";

export const V2_SHOWCASE_CARD_IDS = [
  "fool",
  "high_priestess",
  "three_of_cups",
  "queen_of_swords",
  "ten_of_wands",
  "three_of_pentacles",
] as const;

/** A small face for a grid of many cards: the 192px copy of a plate. */
export function resolveWebCardThumbnailUrl(cardId: string): string {
  return `${VISUAL_CARD_V2_ASSET_BASE}/mcp/${cardId}.webp`;
}

export function resolveWebCardAssetUrl(cardId: string): string {
  return `${VISUAL_CARD_V2_ASSET_BASE}/${cardId}.webp`;
}
