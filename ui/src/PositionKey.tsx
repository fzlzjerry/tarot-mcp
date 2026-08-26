import { t } from "./i18n.js";
import type { Language } from "./types.js";

export function PositionKey({
  language,
  names,
}: {
  language: Language;
  names: string[];
}) {
  return (
    <ol
      className="mobile-position-key"
      aria-label={t(language, "spreadPositions")}
    >
      {names.map((name, index) => (
        <li key={`${name}-${index}`}>
          <strong>{index + 1}</strong>
          <span>{name}</span>
        </li>
      ))}
    </ol>
  );
}
