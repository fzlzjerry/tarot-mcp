import type { ReactNode } from "react";
import { VISUAL_CARD_ASSET_BASE } from "@tarot/shared/artwork.js";
import { t } from "./i18n.js";
import type { Language } from "./types.js";

/** Page identity and responsive composition, independent of form state. */
export function SetupShell({
  language,
  onLanguageChange,
  spreadCount,
  children,
}: {
  language: Language;
  onLanguageChange(language: Language): void;
  spreadCount: number;
  children: ReactNode;
}) {
  return (
    <div className="setup-shell">
      <a className="skip-link" href="#reading-form">
        {t(language, "skipToForm")}
      </a>
      <header className="setup-header">
        <a className="wordmark" href="/draw/" aria-label="Tarot">
          <span aria-hidden="true">✦</span> Tarot
        </a>
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
              <img
                className="deck-preview__moon"
                src={`${VISUAL_CARD_ASSET_BASE}/moon.webp`}
                width="512"
                height="768"
                alt=""
              />
              <img
                className="deck-preview__back"
                src={`${VISUAL_CARD_ASSET_BASE}/back.webp`}
                width="512"
                height="768"
                alt=""
              />
              <img
                className="deck-preview__star"
                src={`${VISUAL_CARD_ASSET_BASE}/star.webp`}
                width="512"
                height="768"
                alt=""
              />
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
        <ol>
          {(["stepIntention", "stepChoose", "stepReflect"] as const).map(
            (key, index) => (
              <li key={key}>
                <span>0{index + 1}</span>
                {t(language, key)}
              </li>
            ),
          )}
        </ol>
      </footer>
    </div>
  );
}
