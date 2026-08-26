import type { CSSProperties } from "react";

export function cardBackStyle(uri: string | undefined): CSSProperties | undefined {
  return uri
    ? ({
        "--deck-back-image": `url("${uri.replaceAll('"', "%22")}")`,
      } as CSSProperties)
    : undefined;
}
