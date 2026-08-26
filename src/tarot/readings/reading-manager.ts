import { TarotCardManager } from "../cards/card-manager.js";
import { TarotSessionManager } from "./session-manager.js";
import {
  TarotReading,
  TarotSession,
  TarotSpread,
  DrawnCard,
  CardOrientation,
  Language,
  TarotCard,
} from "../shared/types.js";
import {
  TAROT_SPREADS,
  customSpreadTypeId,
  getSpread,
  isValidSpreadType,
} from "./spreads.js";
import { generateId, randomOrientation } from "../shared/utils.js";
import { VISUAL_CARD_ASSET_BASE } from "../shared/artwork.js";
import { sanitizeString } from "../shared/validation.js";
import {
  InvalidSpreadTypeError,
  SessionNotFoundError,
} from "../shared/errors.js";
import { generateInterpretation } from "./interpretation/index.js";
import { formatReading, renderAvailableSpreads } from "./reading-formatter.js";
import { localizedSpread } from "./spread-localizations.js";
import {
  localizedCardName,
  localizedKeywords,
  localizedMeanings,
} from "../shared/i18n.js";
import { selectRelevantMeaning } from "./interpretation/patterns.js";

export interface TarotReadingRandomSource {
  drawCards?: (count: number) => TarotCard[];
  drawOrientation?: () => CardOrientation;
}

export interface SelectedTarotCard {
  card: TarotCard;
  orientation: CardOrientation;
}

/** Machine-readable payload of a performed reading (MCP structuredContent). */
export interface ReadingPayload {
  readingId: string;
  sessionId?: string;
  spreadType: string;
  spreadName: string;
  question: string;
  timestamp: string;
  cards: Array<{
    name: string;
    /** Stable snake_case identifier used by visual clients and card assets. */
    id: string;
    cardId: string;
    displayName: string;
    orientation: CardOrientation;
    position?: string;
    positionMeaning?: string;
    keywords: string[];
    meaning: string;
    imageUri: string;
  }>;
}

export interface PerformedReading {
  text: string;
  reading: ReadingPayload;
}

/**
 * Orchestrates tarot readings: session resolution, card drawing, and the
 * hand-off to the interpretation and formatting modules.
 */
export class TarotReadingManager {
  private cardManager: TarotCardManager;
  private sessionManager: TarotSessionManager;
  private randomSource: TarotReadingRandomSource;

  constructor(
    cardManager: TarotCardManager,
    sessionManager: TarotSessionManager,
    randomSource: TarotReadingRandomSource = {}
  ) {
    this.cardManager = cardManager;
    this.sessionManager = sessionManager;
    this.randomSource = randomSource;
  }

  /**
   * Perform a tarot reading with a built-in spread.
   */
  public performReading(
    spreadType: string,
    question: string,
    sessionId?: string | null,
    options: { trackSession?: boolean; language?: Language } = {},
  ): string {
    return this.performReadingWithDetails(spreadType, question, sessionId, options).text;
  }

  /**
   * Perform a reading and also return the machine-readable payload used for
   * MCP structuredContent.
   */
  public performReadingWithDetails(
    spreadType: string,
    question: string,
    sessionId?: string | null,
    options: { trackSession?: boolean; language?: Language } = {},
  ): PerformedReading {
    if (!isValidSpreadType(spreadType)) {
      throw new InvalidSpreadTypeError(
        `Invalid spread type: ${spreadType}. Use list_available_spreads to see valid options.`,
      );
    }

    const language = options.language ?? "en";
    const session = this.resolveSession(sessionId, options.trackSession ?? true);
    const spread = localizedSpread(getSpread(spreadType)!, spreadType, language);

    return this.executeReading(spread, spreadType, question, session, language);
  }

  /**
   * Perform a custom tarot reading with a user-defined spread. The custom_*
   * type id never matches the analyzer registry, so custom spreads always
   * use the generic cross-card analysis.
   */
  public performCustomReading(
    spreadName: string,
    description: string,
    positions: { name: string; meaning: string }[],
    question: string,
    sessionId?: string | null,
    options: { language?: Language } = {},
  ): string {
    return this.performCustomReadingWithDetails(
      spreadName,
      description,
      positions,
      question,
      sessionId,
      options,
    ).text;
  }

  /**
   * Custom-reading variant that also returns the structuredContent payload.
   */
  public performCustomReadingWithDetails(
    spreadName: string,
    description: string,
    positions: { name: string; meaning: string }[],
    question: string,
    sessionId?: string | null,
    options: { language?: Language } = {},
  ): PerformedReading {
    const language = options.language ?? "en";
    const session = this.resolveSession(sessionId, true);

    const customSpread: TarotSpread = {
      name: spreadName,
      description: description,
      positions: positions,
      cardCount: positions.length
    };
    const customType = customSpreadTypeId(spreadName);

    return this.executeReading(customSpread, customType, question, session, language);
  }

  /**
   * Complete a reading with cards chosen from an already shuffled, opaque
   * visual deck. This is intentionally an internal-domain entry point: public
   * tools only ever pass slot IDs to VisualDrawManager, never arbitrary card
   * IDs, so callers cannot bypass the prepared-deck selection contract.
   */
  public performPreparedReadingWithDetails(
    spread: TarotSpread,
    spreadType: string,
    question: string,
    selectedCards: SelectedTarotCard[],
    sessionId?: string | null,
    options: { trackSession?: boolean; language?: Language } = {},
  ): PerformedReading {
    if (selectedCards.length !== spread.cardCount) {
      throw new Error(
        `Prepared selection has ${selectedCards.length} cards; ${spread.cardCount} required`,
      );
    }
    if (new Set(selectedCards.map(({ card }) => card.id)).size !== selectedCards.length) {
      throw new Error("Prepared selection contains duplicate cards");
    }

    const session = this.resolveSession(sessionId, options.trackSession ?? true);
    return this.executeReading(
      spread,
      spreadType,
      question,
      session,
      options.language ?? "en",
      selectedCards,
    );
  }

  /** Validate/touch a continuation session without creating a new session. */
  public assertContinuationSession(sessionId: string): void {
    this.resolveSession(sessionId, false);
  }

  /**
   * Shared reading pipeline: draw cards, interpret, store in the session,
   * and format for display.
   */
  private executeReading(
    spread: TarotSpread,
    spreadType: string,
    question: string,
    session: TarotSession | undefined,
    language: Language = "en",
    selectedCards?: SelectedTarotCard[],
  ): PerformedReading {
    // Immediate readings draw here. Visual readings provide a selection from
    // a server-shuffled opaque deck whose orientations were fixed at begin.
    const selection =
      selectedCards ??
      this.drawCards(spread.cardCount).map((card) => ({
        card,
        orientation: this.drawOrientation(),
      }));

    const drawnCards: DrawnCard[] = selection.map(({ card, orientation }, index) => ({
      card,
      orientation,
      position: spread.positions[index].name,
      positionMeaning: spread.positions[index].meaning
    }));

    const reading: TarotReading = {
      id: generateId("reading"),
      spreadType,
      question,
      cards: drawnCards,
      interpretation: generateInterpretation(drawnCards, question, spreadType, spread.name, language),
      timestamp: new Date(),
      ...(session ? { sessionId: session.id } : {}),
    };

    const readingNumber = session
      ? this.sessionManager.getSessionReadingCount(session.id) + 1
      : 0;

    // Build every potentially-throwing representation before committing the
    // session mutation. Visual confirmation can then cache the completed
    // result without risking a retry that records the same reading twice.
    const performed: PerformedReading = {
      text: formatReading(reading, spread.name, spread.description, readingNumber, language),
      reading: {
        readingId: reading.id,
        ...(session ? { sessionId: session.id } : {}),
        spreadType,
        spreadName: spread.name,
        question,
        timestamp: reading.timestamp.toISOString(),
        cards: drawnCards.map((drawnCard) => {
          const meanings = localizedMeanings(
            drawnCard.card,
            drawnCard.orientation,
            language,
          );
          const cardId = drawnCard.card.id;
          return {
            id: cardId,
            cardId,
            name: drawnCard.card.name,
            displayName: localizedCardName(drawnCard.card, language),
            orientation: drawnCard.orientation,
            position: drawnCard.position,
            positionMeaning: drawnCard.positionMeaning,
            keywords: localizedKeywords(
              drawnCard.card,
              drawnCard.orientation,
              language,
            ),
            meaning: selectRelevantMeaning(
              meanings,
              drawnCard.position ?? "General",
              question,
              drawnCard.positionMeaning,
            ),
            imageUri: `${VISUAL_CARD_ASSET_BASE}/${cardId}.webp`,
          };
        }),
      },
    };

    if (session) {
      this.sessionManager.addReadingToSession(session.id, reading);
    }

    return performed;
  }

  /**
   * Resolve an existing session or start a new one. Throws
   * SessionNotFoundError when an unknown session ID is supplied, so stale
   * IDs fail loudly instead of being silently dropped. Returns undefined
   * when session tracking is disabled (one-shot tools such as the daily
   * card, which cannot continue a session anyway).
   */
  private resolveSession(
    sessionId: string | null | undefined,
    trackSession: boolean,
  ): TarotSession | undefined {
    if (sessionId == null) {
      return trackSession ? this.sessionManager.createSession() : undefined;
    }

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      // Echo at most a short, sanitized form of the client-supplied ID.
      const safeId = sanitizeString(sessionId).slice(0, 64);
      throw new SessionNotFoundError(
        `Session "${safeId}" not found. It may have expired (24 hours idle), been evicted under load, or predate a server restart. Omit sessionId or pass "new" to start a new session.`,
      );
    }
    return session;
  }

  /**
   * List all available spreads
   */
  public listAvailableSpreads(language: Language = "en"): string {
    const localized = Object.entries(TAROT_SPREADS).map(([type, spread]) =>
      localizedSpread(spread, type, language),
    );
    return renderAvailableSpreads(localized, language);
  }

  private drawCards(count: number): TarotCard[] {
    return this.randomSource.drawCards
      ? this.randomSource.drawCards(count)
      : this.cardManager.getRandomCards(count);
  }

  private drawOrientation(): CardOrientation {
    return this.randomSource.drawOrientation
      ? this.randomSource.drawOrientation()
      : randomOrientation();
  }
}
