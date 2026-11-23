import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CardPlate } from "./CardPlate.js";
import { type MessageKey, t } from "./i18n.js";
import type { DeckCard, DrawClient, Language } from "./types.js";
import { useCardImage } from "./useCardImage.js";

type Group = "major" | NonNullable<DeckCard["suit"]>;

const GROUPS: Array<{ id: Group; label: MessageKey }> = [
  { id: "major", label: "galleryMajor" },
  { id: "wands", label: "galleryWands" },
  { id: "cups", label: "galleryCups" },
  { id: "swords", label: "gallerySwords" },
  { id: "pentacles", label: "galleryPentacles" },
];

const groupOf = (card: DeckCard): Group => card.suit ?? "major";

const groupLabel = (language: Language, card: DeckCard): string =>
  t(language, GROUPS.find(({ id }) => id === groupOf(card))!.label);

/** The catalog never changes within a session; fetch it once per language. */
const catalogs = new WeakMap<DrawClient, Map<Language, DeckCard[]>>();

function DeckCardView({
  card,
  client,
  language,
  onBack,
  onPrevious,
  onNext,
}: {
  card: DeckCard;
  client: DrawClient;
  language: Language;
  onBack(): void;
  onPrevious?(): void;
  onNext?(): void;
}) {
  const plate = useMemo(
    () => ({
      id: card.id,
      name: card.name,
      displayName: card.displayName,
      orientation: "upright" as const,
    }),
    [card],
  );
  const [source] = useCardImage(client, plate);
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    back.current?.focus();
  }, []);

  return (
    <article className="deck-gallery__card" aria-labelledby="deck-card-title">
      <button ref={back} type="button" className="text-action" onClick={onBack}>
        ← {t(language, "galleryBack")}
      </button>
      <CardPlate source={source} name={card.displayName} />
      <div className="deck-gallery__copy">
        <p className="position-label">
          {groupLabel(language, card)}
          {card.arcana === "major" && card.number !== undefined
            ? ` · ${card.number}`
            : ""}
        </p>
        <h3 id="deck-card-title">{card.displayName}</h3>
        {card.displayName !== card.name ? (
          <p className="deck-gallery__alias">{card.name}</p>
        ) : null}
        {(["upright", "reversed"] as const).map((orientation) =>
          card.keywords[orientation].length > 0 ? (
            <div key={orientation} className="deck-gallery__keywords">
              <h4>{t(language, orientation)}</h4>
              <ul className="keyword-list">
                {card.keywords[orientation].map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        <div className="dialog-nav">
          <button
            type="button"
            className="text-action"
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            ← {t(language, "galleryPrevious")}
          </button>
          <button
            type="button"
            className="text-action"
            onClick={onNext}
            disabled={!onNext}
          >
            {t(language, "galleryNext")} →
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * The whole deck, face up, to browse and search. It lists all 78 cards the
 * same way whatever has been drawn, so it gives nothing away about a reading
 * that is still face down.
 */
export function DeckGallery({
  client,
  language,
  onClose,
}: {
  client: DrawClient;
  language: Language;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const returnTo = useRef<string | undefined>(undefined);
  const [catalog, setCatalog] = useState<{
    cards?: DeckCard[];
    error?: string;
  }>(() => ({ cards: catalogs.get(client)?.get(language) }));
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group | "all">("all");
  const [openId, setOpenId] = useState<string>();

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);

  useEffect(() => {
    if (catalogs.get(client)?.has(language) || !client.listCards) return;
    const controller = new AbortController();
    client.listCards(language, { signal: controller.signal }).then(
      (cards) => {
        const known = catalogs.get(client) ?? new Map<Language, DeckCard[]>();
        catalogs.set(client, known.set(language, cards));
        if (!controller.signal.aborted) setCatalog({ cards });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setCatalog({
            error: error instanceof Error ? error.message : String(error),
          });
      },
    );
    return () => controller.abort();
  }, [attempt, client, language]);

  const cards = catalog.cards;
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (cards ?? []).filter((card) => {
      if (group !== "all" && groupOf(card) !== group) return false;
      const text = [
        card.displayName,
        card.name,
        groupLabel(language, card),
        ...card.keywords.upright,
        ...card.keywords.reversed,
      ]
        .join(" ")
        .toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [cards, group, language, query]);

  const openIndex = shown.findIndex((card) => card.id === openId);
  const openCard = openIndex >= 0 ? shown[openIndex] : undefined;
  const step = (offset: number): (() => void) | undefined => {
    const target = shown[openIndex + offset];
    return target ? () => setOpenId(target.id) : undefined;
  };

  // Back from a card, focus returns to the thumbnail it was opened from.
  useEffect(() => {
    if (openCard || !returnTo.current) return;
    dialog.current
      ?.querySelector<HTMLElement>(`[data-card="${returnTo.current}"]`)
      ?.focus();
    returnTo.current = undefined;
  }, [openCard]);

  const close = (): void => {
    const element = dialog.current;
    if (element?.open && typeof element.close === "function") element.close();
    else onClose();
  };
  const outside = (event: PointerEvent<HTMLDialogElement>): boolean => {
    const box = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  };
  const turnPage = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (!openCard) return;
    const move =
      event.key === "ArrowLeft"
        ? step(-1)
        : event.key === "ArrowRight"
          ? step(1)
          : undefined;
    if (!move) return;
    event.preventDefault();
    move();
  };

  return (
    <dialog
      ref={dialog}
      className="deck-gallery"
      aria-labelledby="deck-gallery-title"
      onClose={onClose}
      onKeyDown={turnPage}
      // A press that starts and ends on the backdrop closes the drawer; a
      // drag that only ends there, such as a text selection, does not.
      onPointerDown={(event) => {
        pressedOutside.current = outside(event);
      }}
      onPointerUp={(event) => {
        if (pressedOutside.current && outside(event)) close();
      }}
    >
      <header className="deck-gallery__header">
        <h2 id="deck-gallery-title">{t(language, "galleryTitle")}</h2>
        <button
          type="button"
          className="dialog-close"
          onClick={close}
          aria-label={t(language, "close")}
        >
          ×
        </button>
        {openCard ? null : (
          <div className="deck-gallery__tools">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(language, "gallerySearch")}
              aria-label={t(language, "gallerySearch")}
            />
            <div
              className="deck-gallery__groups"
              role="group"
              aria-label={t(language, "galleryFilter")}
            >
              {[
                { id: "all" as const, label: "galleryAll" as const },
                ...GROUPS,
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={group === id}
                  onClick={() => setGroup(id)}
                >
                  {t(language, label)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      <div className="deck-gallery__body">
        {openCard ? (
          <DeckCardView
            card={openCard}
            client={client}
            language={language}
            onBack={() => {
              returnTo.current = openCard.id;
              setOpenId(undefined);
            }}
            onPrevious={step(-1)}
            onNext={step(1)}
          />
        ) : null}
        <div hidden={openCard !== undefined}>
          <p className="deck-gallery__status" role="status">
            {cards
              ? shown.length > 0
                ? t(language, "galleryCount", {
                    shown: shown.length,
                    total: cards.length,
                  })
                : t(language, "galleryEmpty")
              : catalog.error
                ? ""
                : t(language, "galleryLoading")}
          </p>
          {catalog.error ? (
            <div className="error-banner" role="alert">
              <div>
                <strong>{t(language, "galleryFailed")}</strong>
                <span>{catalog.error}</span>
              </div>
              <div className="error-banner__actions">
                <button
                  type="button"
                  onClick={() => {
                    setCatalog({});
                    setAttempt((count) => count + 1);
                  }}
                >
                  {t(language, "tryAgain")}
                </button>
              </div>
            </div>
          ) : null}
          {cards && shown.length === 0 ? (
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setQuery("");
                setGroup("all");
              }}
            >
              {t(language, "galleryClear")}
            </button>
          ) : null}
          {GROUPS.map(({ id, label }) => {
            const members = shown.filter((card) => groupOf(card) === id);
            return members.length > 0 ? (
              <section key={id} aria-labelledby={`deck-group-${id}`}>
                <h3 id={`deck-group-${id}`}>
                  {t(language, label)}
                  <span>{members.length}</span>
                </h3>
                <ul className="deck-gallery__grid">
                  {members.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        className="deck-thumb"
                        data-card={card.id}
                        onClick={() => setOpenId(card.id)}
                      >
                        <span className="deck-thumb__art">
                          <img
                            src={client.getCardThumbnail?.(card.id)}
                            alt=""
                            width="192"
                            height="288"
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        </span>
                        <span className="deck-thumb__name">
                          {card.displayName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null;
          })}
        </div>
      </div>
    </dialog>
  );
}

/** The gallery's opener, shown only where the client can list the deck. */
export function DeckGalleryButton({
  client,
  language,
}: {
  client: DrawClient;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  if (!client.listCards) return null;
  return (
    <>
      <button
        type="button"
        className="text-action"
        onClick={() => setOpen(true)}
      >
        {t(language, "galleryOpen")}
      </button>
      {open ? (
        <DeckGallery
          client={client}
          language={language}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
