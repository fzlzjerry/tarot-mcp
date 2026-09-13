import { t } from "./i18n.js";
import type { Language } from "./types.js";

export interface PositionAction {
  /** Accessible name of the item's button; it must name the whole action. */
  label: string;
  onActivate(): void;
  disabled?: boolean;
}

/**
 * The numbered index of spread positions beneath the cloth. Every position is
 * reachable here at a full-size target, so dense or overlapping layouts never
 * depend on hitting a small card. Values and actions are read by position
 * index; a position without either is plain text.
 */
export function PositionKey({
  language,
  names,
  values,
  actions,
}: {
  language: Language;
  names: string[];
  values?: Array<string | undefined>;
  actions?: Array<PositionAction | undefined>;
}) {
  return (
    <ol className="position-key" aria-label={t(language, "spreadPositions")}>
      {names.map((name, index) => {
        const value = values?.[index];
        const action = actions?.[index];
        const content = (
          <>
            <span className="position-key__number">{index + 1}</span>
            <span className="position-key__name">{name}</span>
            {value ? (
              <span className="position-key__value">{value}</span>
            ) : null}
          </>
        );
        return (
          <li key={`${name}-${index}`}>
            {action ? (
              <button
                type="button"
                className="position-key__action"
                aria-label={action.label}
                disabled={action.disabled}
                onClick={() => action.onActivate()}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
