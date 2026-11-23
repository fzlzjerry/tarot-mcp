import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVisualAssetDirectories } from "./static-assets.js";

export const CARD_ARTWORK_MIME_TYPE = "image/webp";
export const CARD_ARTWORK_URI_TEMPLATE = "tarot://cards/{id}/artwork";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Base64 of one card's full-size face, the file the Web table serves. Pass an
 * id taken from the card catalog, never caller text: it becomes a file name.
 */
export async function readCardArtwork(
  cardId: string,
): Promise<string | undefined> {
  const { cardDirectory } = resolveVisualAssetDirectories(moduleDirectory);
  if (!cardDirectory) return undefined;
  try {
    const bytes = await readFile(join(cardDirectory, `${cardId}.webp`));
    return bytes.toString("base64");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
