import { useEffect, useState } from "react";
import type { DrawClient, ReadingCard } from "./types.js";

/**
 * A card's image: the client's immediate face first, then its sharper one once
 * that has arrived and decoded. Pass `sharp` as false to hold the second
 * request back, so a card still face down asks the server for nothing.
 */
export function useCardImage(
  client: DrawClient,
  card: ReadingCard,
  sharp = true,
): [string | undefined, boolean] {
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [upgrade, setUpgrade] = useState<{
    card: ReadingCard;
    source: string;
  }>();
  useEffect(() => {
    let active = true;
    setFailed(false);
    setSource(undefined);
    void client
      .resolveImage?.(card)
      .then((value) => {
        if (active) setSource(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [card, client]);
  useEffect(() => {
    if (!sharp) return;
    let active = true;
    void client
      .resolveSharpImage?.(card)
      .then(async (value) => {
        if (!value) return;
        // Decoded before the swap, so a damaged image never replaces a good one.
        const image = new Image();
        image.src = value;
        await image.decode();
        if (active) setUpgrade({ card, source: value });
      })
      .catch(() => {
        // The immediate face stays.
      });
    return () => {
      active = false;
    };
  }, [card, client, sharp]);
  const sharpSource = upgrade?.card === card ? upgrade.source : undefined;
  return [sharpSource ?? source, failed && !sharpSource];
}
