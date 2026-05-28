import { TarotCard } from "../shared/types.js";

/**
 * Deprecated compatibility export.
 *
 * Runtime card data is loaded through TarotCardManager from card-data.json.
 * Keep this export empty so older imports fail harmlessly instead of loading
 * a second, stale copy of the tarot deck.
 */

export const ALL_CARDS: TarotCard[] = [];
