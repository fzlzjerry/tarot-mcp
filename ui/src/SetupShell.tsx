import type { ReactNode } from "react";
import { VISUAL_CARD_ASSET_BASE } from "@tarot/shared/artwork.js";
import { t } from "./i18n.js";
import { RitualProgress } from "./RitualProgress.js";
import type { DrawClient, Language } from "./types.js";

/** Page identity and responsive composition, independent of form state. */
export function SetupShell({
  language,
  client,
  onLanguageChange,
  spreadCount,
  children,
}: {
  language: Language;
  client: DrawClient;
  onLanguageChange(language: Language): void;
  spreadCount: number;
  children: ReactNode;
}) {
  return (
    <div className="setup-shell">
      <a className="skip-link" href="#reading-form">
        {t(language, "skipToForm")}
      </a>
      <RitualProgress current="intention" language={language} />
      <header className="setup-header">
        {client.target === "mcp" ? (
          <span className="wordmark">Tarot</span>
        ) : (
          <a className="wordmark" href="/draw/" aria-label="Tarot">
            <span aria-hidden="true">✦</span> Tarot
          </a>
        )}
        <label className="language-picker">
          <span className="sr-only">{t(language, "language")}</span>
          <select
            aria-label={t(language, "language")}
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as Language)
            }
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main className="setup-layout">
        <section className="setup-intro" aria-labelledby="setup-title">
          <p className="setup-eyebrow">{t(language, "deckEdition")}</p>
          <h1 id="setup-title">{t(language, "title")}</h1>
          <p className="setup-subtitle">{t(language, "subtitle")}</p>
          <figure className="deck-preview">
            <div className="deck-preview__cards" aria-hidden="true">
              {(["moon", "back", "star"] as const).map((cardId) => {
                const source =
                  client.target === "mcp"
                    ? client.getPreviewImage?.(cardId)
                    : `${VISUAL_CARD_ASSET_BASE}/${cardId}.webp`;
                return source ? (
                  <img
                    key={cardId}
                    className={`deck-preview__${cardId}`}
                    src={source}
                    width="512"
                    height="768"
                    alt=""
                  />
                ) : null;
              })}
            </div>
            <figcaption>{t(language, "deckPreview")}</figcaption>
          </figure>
        </section>
        <section className="setup-panel" aria-labelledby="form-title">
          <div className="setup-panel__heading">
            <h2 id="form-title">{t(language, "prepareReading")}</h2>
            <span>{t(language, "spreadCount", { count: spreadCount })}</span>
          </div>
          {children}
        </section>
      </main>
      <footer className="setup-footer">
        <span>{t(language, "reflectionNote")}</span>
      </footer>
    </div>
  );
}
