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
import { TAROT_SPREADS, getSpread, isValidSpreadType } from "./spreads.js";
import { generateId, getSecureRandomInt } from "../shared/utils.js";
import { sanitizeString } from "../shared/validation.js";
import {
  InvalidSpreadTypeError,
  SessionNotFoundError,
} from "../shared/errors.js";
import { generateInterpretation } from "./interpretation/index.js";
import { formatReading, renderAvailableSpreads } from "./reading-formatter.js";
import { localizedSpread } from "./spread-localizations.js";

export interface TarotReadingRandomSource {
  drawCards?: (count: number) => TarotCard[];
  drawOrientation?: () => CardOrientation;
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
    orientation: CardOrientation;
    position?: string;
    positionMeaning?: string;
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
    const customType = `custom_${spreadName.toLowerCase().replace(/\s+/g, '_')}`;

    return this.executeReading(customSpread, customType, question, session, language);
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
  ): PerformedReading {
    // Use cryptographically secure random card drawing
    const cards = this.drawCards(spread.cardCount);

    // Generate random orientations for each card using secure randomness
    const drawnCards: DrawnCard[] = cards.map((card, index) => ({
      card,
      orientation: this.drawOrientation(),
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
      sessionId: session?.id
    };

    if (session) {
      this.sessionManager.addReadingToSession(session.id, reading);
    }

    const readingNumber = session
      ? this.sessionManager.getSessionReadingCount(session.id)
      : 0;

    return {
      text: formatReading(reading, spread.name, spread.description, readingNumber, language),
      reading: {
        readingId: reading.id,
        sessionId: session?.id,
        spreadType,
        spreadName: spread.name,
        question,
        timestamp: reading.timestamp.toISOString(),
        cards: drawnCards.map((drawnCard) => ({
          name: drawnCard.card.name,
          orientation: drawnCard.orientation,
          position: drawnCard.position,
          positionMeaning: drawnCard.positionMeaning,
        })),
      },
    };
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
        `Session "${safeId}" not found. Sessions expire 24 hours after their last activity. Omit sessionId to start a new session.`,
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

  /**
   * Generate cryptographically secure random orientation
   */
  private getSecureRandomOrientation(): CardOrientation {
    return getSecureRandomInt(2) === 0 ? "upright" : "reversed";
  }

  private drawCards(count: number): TarotCard[] {
    return this.randomSource.drawCards
      ? this.randomSource.drawCards(count)
      : this.cardManager.getRandomCards(count);
  }

  private drawOrientation(): CardOrientation {
    return this.randomSource.drawOrientation
      ? this.randomSource.drawOrientation()
      : this.getSecureRandomOrientation();
  }
}
