import { type ReactNode, useState } from "react";
import {
  VISUAL_CARD_ASSET_BASE,
  VISUAL_CARD_V2_ASSET_BASE,
} from "@tarot/shared/artwork.js";
import {
  type DeckEdition,
  V2_GATE_CARD_IDS,
  readInitialDeckEdition,
  setUrlDeckEdition,
} from "./deck-edition.js";
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
  const [edition, setEdition] = useState<DeckEdition>(() =>
    client.target === "web" ? readInitialDeckEdition() : "v1",
  );

  const switchEdition = (next: DeckEdition): void => {
    setEdition(next);
    setUrlDeckEdition(next);
  };

  const heroCards =
    edition === "v2" && client.target === "web"
      ? ([
          {
            slot: "moon",
            src: `${VISUAL_CARD_V2_ASSET_BASE}/fool.webp`,
          },
          {
            slot: "back",
            src: `${VISUAL_CARD_V2_ASSET_BASE}/back.webp`,
          },
          {
            slot: "star",
            src: `${VISUAL_CARD_V2_ASSET_BASE}/queen_of_swords.webp`,
          },
        ] as const)
      : (["moon", "back", "star"] as const).map((cardId) => ({
          slot: cardId,
          src:
            client.target === "mcp"
              ? client.getPreviewImage?.(cardId)
              : `${VISUAL_CARD_ASSET_BASE}/${cardId}.webp`,
        }));

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
        <div className="setup-header__controls">
          {client.target === "web" ? (
            <div className="edition-switch" role="group" aria-label={t(language, "deckEdition")}>
              <button
                type="button"
                className={edition === "v1" ? "is-active" : ""}
                aria-pressed={edition === "v1"}
                onClick={() => switchEdition("v1")}
              >
                {t(language, "deckEditionV1")}
              </button>
              <button
                type="button"
                className={edition === "v2" ? "is-active" : ""}
                aria-pressed={edition === "v2"}
                onClick={() => switchEdition("v2")}
              >
                {t(language, "deckEditionV2")}
              </button>
            </div>
          ) : null}
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
        </div>
      </header>
      <main className="setup-layout">
        <section className="setup-intro" aria-labelledby="setup-title">
          <p className="setup-eyebrow">{t(language, "deckEdition")}</p>
          <h1 id="setup-title">{t(language, "title")}</h1>
          <p className="setup-subtitle">{t(language, "subtitle")}</p>
          <figure className="deck-preview">
            <div className="deck-preview__cards" aria-hidden="true">
              {heroCards.map(({ slot, src }) =>
                src ? (
                  <img
                    key={`${edition}-${slot}`}
                    className={`deck-preview__${slot}`}
                    src={src}
                    width="512"
                    height="768"
                    alt=""
                  />
                ) : null,
              )}
            </div>
            <figcaption>
              {edition === "v2" && client.target === "web"
                ? t(language, "v2GateCaption")
                : t(language, "deckPreview")}
            </figcaption>
            {edition === "v2" && client.target === "web" ? (
              <div className="v2-gate-strip" aria-hidden="true">
                {V2_GATE_CARD_IDS.map((id) => (
                  <img
                    key={id}
                    src={`${VISUAL_CARD_V2_ASSET_BASE}/w320/${id}.webp`}
                    width="160"
                    height="240"
                    alt=""
                  />
                ))}
              </div>
            ) : null}
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
