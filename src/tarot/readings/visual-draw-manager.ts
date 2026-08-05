import { createHash, randomUUID } from "node:crypto";
import { TarotCardManager } from "../cards/card-manager.js";
import { TarotDomainError } from "../shared/errors.js";
import { pick } from "../shared/i18n.js";
import {
  CardOrientation,
  Language,
  TarotSpread,
} from "../shared/types.js";
import { getSecureRandomInt } from "../shared/utils.js";
import {
  PerformedReading,
  ReadingPayload,
  SelectedTarotCard,
  TarotReadingManager,
} from "./reading-manager.js";

export const VISUAL_ARTWORK_VERSION = "midnight-art-nouveau-v1";
export const VISUAL_CARD_ASSET_BASE =
  "/assets/cards/midnight-art-nouveau-v1";
export const VISUAL_CARD_BACK_URI = `${VISUAL_CARD_ASSET_BASE}/back.webp`;

export type VisualReadingKind = "spread" | "daily" | "moon" | "custom";

export interface VisualMoonContext {
  date: string;
  phase: string;
  name: string;
  illumination: number;
  themes: string[];
}

export interface VisualReadingSpec {
  readingKind: VisualReadingKind;
  question: string;
  language: Language;
  spreadType: string;
  spread: TarotSpread;
  sessionId?: string;
  trackSession: boolean;
  moon?: VisualMoonContext;
  moonGuidance?: string;
}

export interface VisualDeckSlot {
  slotId: string;
  order: number;
}

export interface VisualBeginPayload {
  drawId: string;
  status: "pending";
  readingKind: VisualReadingKind;
  question: string;
  language: Language;
  createdAt: string;
  expiresAt: string;
  requiredCount: number;
  requiredCardCount: number;
  spreadType: string;
  spreadName: string;
  sessionMode: "new" | "continue" | "none";
  spread: {
    type: string;
    name: string;
    description: string;
    positions: Array<{ index: number; name: string; meaning: string }>;
  };
  moon?: VisualMoonContext;
  slots: VisualDeckSlot[];
  deck: {
    size: 78;
    artworkVersion: string;
    backImageUri: string;
    slots: VisualDeckSlot[];
  };
}

export interface VisualReadingPayload extends ReadingPayload {
  drawId: string;
  status: "confirmed";
  confirmedAt: string;
  readingKind: VisualReadingKind;
  artworkVersion: string;
  moon?: VisualMoonContext;
}

export interface ConfirmedVisualReading {
  text: string;
  reading: VisualReadingPayload;
}

export class VisualDrawError extends TarotDomainError {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

interface DeckEntry extends SelectedTarotCard {
  slotId: string;
}

type VisualDrawStatus = "pending" | "confirming" | "confirmed" | "expired";

interface VisualDrawRecord {
  drawId: string;
  status: VisualDrawStatus;
  spec: VisualReadingSpec;
  createdAt: number;
  expiresAt: number;
  retainUntil: number;
  beginPayload: VisualBeginPayload;
  deck?: Map<string, DeckEntry>;
  selectionKey?: string;
  confirmationPromise?: Promise<ConfirmedVisualReading>;
  result?: ConfirmedVisualReading;
}

interface IdempotencyRecord {
  requestHash: string;
  drawId: string;
  retainUntil: number;
}

export interface VisualDrawManagerOptions {
  now?: () => number;
  randomUuid?: () => string;
  drawOrientation?: () => CardOrientation;
  pendingTtlMs?: number;
  retentionTtlMs?: number;
  maxPending?: number;
  maxRetained?: number;
}

/**
 * Owns the short-lived, opaque deck used by the visual two-stage flow.
 * It intentionally stays separate from both MCP transport sessions and
 * TarotSession history: abandoned selections must not create empty sessions
 * or increment reading counters.
 */
export class VisualDrawManager {
  public static readonly DEFAULT_PENDING_TTL_MS = 30 * 60 * 1000;
  public static readonly DEFAULT_RETENTION_TTL_MS = 24 * 60 * 60 * 1000;
  public static readonly DEFAULT_MAX_PENDING = 1000;
  public static readonly DEFAULT_MAX_RETAINED = 1000;

  private readonly records = new Map<string, VisualDrawRecord>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly now: () => number;
  private readonly randomUuid: () => string;
  private readonly drawOrientation: () => CardOrientation;
  private readonly pendingTtlMs: number;
  private readonly retentionTtlMs: number;
  private readonly maxPending: number;
  private readonly maxRetained: number;

  constructor(
    private readonly cardManager: TarotCardManager,
    private readonly readingManager: TarotReadingManager,
    options: VisualDrawManagerOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.randomUuid = options.randomUuid ?? randomUUID;
    this.drawOrientation =
      options.drawOrientation ??
      (() => (getSecureRandomInt(2) === 0 ? "upright" : "reversed"));
    this.pendingTtlMs =
      options.pendingTtlMs ?? VisualDrawManager.DEFAULT_PENDING_TTL_MS;
    this.retentionTtlMs =
      options.retentionTtlMs ?? VisualDrawManager.DEFAULT_RETENTION_TTL_MS;
    this.maxPending = options.maxPending ?? VisualDrawManager.DEFAULT_MAX_PENDING;
    this.maxRetained = options.maxRetained ?? VisualDrawManager.DEFAULT_MAX_RETAINED;
  }

  public begin(
    spec: VisualReadingSpec,
    idempotencyKey?: string,
    idempotencyFingerprint?: string,
  ): VisualBeginPayload {
    const now = this.now();
    this.sweep(now);

    const requestHash = idempotencyFingerprint
      ? createHash("sha256").update(idempotencyFingerprint).digest("hex")
      : this.hashSpec(spec);
    if (idempotencyKey) {
      const existing = this.idempotency.get(idempotencyKey);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new VisualDrawError(
            "IDEMPOTENCY_CONFLICT",
            409,
            "The idempotencyKey was already used with different visual-reading parameters.",
          );
        }
        const record = this.records.get(existing.drawId);
        if (record?.status === "expired") {
          throw new VisualDrawError(
            "DRAW_EXPIRED",
            410,
            `Visual draw "${record.drawId}" expired. Start a new visual reading with a new idempotencyKey.`,
          );
        }
        if (record) {
          return record.beginPayload;
        }
        this.idempotency.delete(idempotencyKey);
      }
    }

    const pendingCount = [...this.records.values()].filter(
      (record) => record.status === "pending" || record.status === "confirming",
    ).length;
    const retainedCount = [...this.records.values()].filter(
      (record) => record.status === "expired" || record.status === "confirmed",
    ).length;
    if (pendingCount >= this.maxPending || retainedCount >= this.maxRetained) {
      throw new VisualDrawError(
        "DRAW_CAPACITY_REACHED",
        503,
        "The visual draw cache is full. Try again after an existing draw expires from memory.",
      );
    }

    const drawId = this.uniqueId("draw", this.records);
    const cards = this.cardManager.getRandomCards(78);
    const usedSlotIds = new Set<string>();
    const deckEntries: DeckEntry[] = cards.map((card) => {
      const slotId = this.uniqueId("slot", usedSlotIds);
      usedSlotIds.add(slotId);
      return {
        slotId,
        card,
        orientation: this.drawOrientation(),
      };
    });
    const slots = deckEntries.map(({ slotId }, order) => ({ slotId, order }));
    const createdAt = now;
    const expiresAt = now + this.pendingTtlMs;
    const sessionMode = !spec.trackSession
      ? "none"
      : spec.sessionId
        ? "continue"
        : "new";

    const beginPayload: VisualBeginPayload = {
      drawId,
      status: "pending",
      readingKind: spec.readingKind,
      question: spec.question,
      language: spec.language,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      requiredCount: spec.spread.cardCount,
      requiredCardCount: spec.spread.cardCount,
      spreadType: spec.spreadType,
      spreadName: spec.spread.name,
      sessionMode,
      spread: {
        type: spec.spreadType,
        name: spec.spread.name,
        description: spec.spread.description,
        positions: spec.spread.positions.map((position, index) => ({
          index,
          ...position,
        })),
      },
      ...(spec.moon ? { moon: spec.moon } : {}),
      slots,
      deck: {
        size: 78,
        artworkVersion: VISUAL_ARTWORK_VERSION,
        backImageUri: VISUAL_CARD_BACK_URI,
        slots,
      },
    };

    const record: VisualDrawRecord = {
      drawId,
      status: "pending",
      spec,
      createdAt,
      expiresAt,
      retainUntil: expiresAt + this.retentionTtlMs,
      beginPayload,
      deck: new Map(deckEntries.map((entry) => [entry.slotId, entry])),
    };
    this.records.set(drawId, record);
    if (idempotencyKey) {
      this.idempotency.set(idempotencyKey, {
        requestHash,
        drawId,
        retainUntil: record.retainUntil,
      });
    }
    return beginPayload;
  }

  public async confirm(
    drawId: string,
    selectedSlotIds: string[],
  ): Promise<ConfirmedVisualReading> {
    const now = this.now();
    this.sweep(now);
    const record = this.records.get(drawId);
    if (!record) {
      throw new VisualDrawError(
        "DRAW_NOT_FOUND",
        404,
        `Visual draw "${drawId}" was not found.`,
      );
    }
    if (
      record.status === "expired" ||
      (now >= record.expiresAt && record.status === "pending")
    ) {
      this.expire(record, now);
      throw new VisualDrawError(
        "DRAW_EXPIRED",
        410,
        `Visual draw "${drawId}" expired. Start a new visual reading.`,
      );
    }

    const selectionKey = JSON.stringify(selectedSlotIds);
    if (record.status === "confirmed") {
      if (record.selectionKey === selectionKey && record.result) {
        return record.result;
      }
      throw new VisualDrawError(
        "DRAW_ALREADY_CONFIRMED",
        409,
        `Visual draw "${drawId}" was already confirmed with a different selection.`,
      );
    }
    if (record.status === "confirming") {
      if (record.selectionKey === selectionKey && record.confirmationPromise) {
        return record.confirmationPromise;
      }
      throw new VisualDrawError(
        "DRAW_ALREADY_CONFIRMING",
        409,
        `Visual draw "${drawId}" is being confirmed with a different selection.`,
      );
    }

    const selectedCards = this.validateSelection(record, selectedSlotIds);
    record.status = "confirming";
    record.selectionKey = selectionKey;

    const confirmationPromise = Promise.resolve().then(() =>
      this.completeReading(record, selectedCards),
    );
    record.confirmationPromise = confirmationPromise;

    try {
      const result = await confirmationPromise;
      const confirmedAt = this.now();
      record.status = "confirmed";
      record.result = result;
      record.deck = undefined;
      record.confirmationPromise = undefined;
      record.retainUntil = confirmedAt + this.retentionTtlMs;
      return result;
    } catch (error) {
      record.status = "pending";
      record.selectionKey = undefined;
      record.confirmationPromise = undefined;
      throw error;
    }
  }

  public getPendingCount(): number {
    this.sweep(this.now());
    return [...this.records.values()].filter(
      (record) => record.status === "pending" || record.status === "confirming",
    ).length;
  }

  private validateSelection(
    record: VisualDrawRecord,
    selectedSlotIds: string[],
  ): SelectedTarotCard[] {
    if (selectedSlotIds.length !== record.spec.spread.cardCount) {
      throw new VisualDrawError(
        "INVALID_SELECTION_COUNT",
        400,
        `Select exactly ${record.spec.spread.cardCount} cards before confirming.`,
      );
    }
    if (new Set(selectedSlotIds).size !== selectedSlotIds.length) {
      throw new VisualDrawError(
        "DUPLICATE_SLOT",
        400,
        "Each visual deck slot may be selected only once.",
      );
    }

    const deck = record.deck!;
    return selectedSlotIds.map((slotId) => {
      const selected = deck.get(slotId);
      if (!selected) {
        throw new VisualDrawError(
          "INVALID_SLOT",
          400,
          `Slot "${slotId.slice(0, 80)}" does not belong to visual draw "${record.drawId}".`,
        );
      }
      return { card: selected.card, orientation: selected.orientation };
    });
  }

  private completeReading(
    record: VisualDrawRecord,
    selectedCards: SelectedTarotCard[],
  ): ConfirmedVisualReading {
    const { spec } = record;
    const performed: PerformedReading =
      this.readingManager.performPreparedReadingWithDetails(
        spec.spread,
        spec.spreadType,
        spec.question,
        selectedCards,
        spec.sessionId,
        { trackSession: spec.trackSession, language: spec.language },
      );
    const confirmedAt = new Date(this.now()).toISOString();
    const heading = pick(
      spec.language,
      "# 🔮 Your Moon Phase Reading",
      "# 🔮 你的月相解读",
    );
    const text = spec.moonGuidance
      ? `${spec.moonGuidance}\n\n---\n\n${heading}\n\n${performed.text}`
      : performed.text;
    return {
      text,
      reading: {
        ...performed.reading,
        drawId: record.drawId,
        status: "confirmed",
        confirmedAt,
        readingKind: spec.readingKind,
        artworkVersion: VISUAL_ARTWORK_VERSION,
        ...(spec.moon ? { moon: spec.moon } : {}),
      },
    };
  }

  private hashSpec(spec: VisualReadingSpec): string {
    return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
  }

  private uniqueId(
    prefix: string,
    occupied: { has(value: string): boolean },
  ): string {
    for (;;) {
      const id = `${prefix}_${this.randomUuid()}`;
      if (!occupied.has(id)) return id;
    }
  }

  private sweep(now: number): void {
    for (const record of this.records.values()) {
      if (record.status === "pending" && now >= record.expiresAt) {
        this.expire(record, now);
      }
      if (
        (record.status === "expired" || record.status === "confirmed") &&
        now >= record.retainUntil
      ) {
        this.deleteRecord(record.drawId);
      }
    }
    for (const [key, record] of this.idempotency.entries()) {
      if (now >= record.retainUntil || !this.records.has(record.drawId)) {
        this.idempotency.delete(key);
      }
    }
  }

  private expire(record: VisualDrawRecord, _now: number): void {
    record.status = "expired";
    record.deck = undefined;
    record.confirmationPromise = undefined;
    record.retainUntil = record.expiresAt + this.retentionTtlMs;
  }

  private deleteRecord(drawId: string): void {
    this.records.delete(drawId);
    for (const [key, record] of this.idempotency.entries()) {
      if (record.drawId === drawId) this.idempotency.delete(key);
    }
  }
}
