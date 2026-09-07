import { useEffect, useState } from "react";
import type { DrawClient, ReadingCard } from "./types.js";

export function useCardImage(
  client: DrawClient,
  card: ReadingCard,
): [string | undefined, boolean] {
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);
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
  return [source, failed];
}
