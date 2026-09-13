import { isRecord } from "./normalize.js";
import type {
  BeginReadingPayload,
  ConfirmedReading,
  ReadingCard,
  TarotUiSnapshot,
} from "./types.js";

export interface ModelReadingContext {
  status: "confirmed";
  readingId?: string;
  sessionId?: string;
  drawId?: string;
  spreadType: string;
  spreadName: string;
  question: string;
  language: ConfirmedReading["language"];
  timestamp?: string;
  cards: Array<Omit<ReadingCard, "imageUri" | "embeddedImage">>;
  interpretation?: string;
}

/** Keep binary card art out of model context and private UI checkpoints. */
export function modelReadingContext(
  reading: ConfirmedReading,
): ModelReadingContext {
  return {
    status: "confirmed",
    ...(reading.readingId ? { readingId: reading.readingId } : {}),
    ...(reading.sessionId ? { sessionId: reading.sessionId } : {}),
    ...(reading.drawId ? { drawId: reading.drawId } : {}),
    spreadType: reading.spreadType,
    spreadName: reading.spreadName,
    question: reading.question,
    language: reading.language,
    ...(reading.timestamp ? { timestamp: reading.timestamp } : {}),
    cards: reading.cards.map((card) => ({
      id: card.id,
      name: card.name,
      displayName: card.displayName,
      orientation: card.orientation,
      ...(card.position ? { position: card.position } : {}),
      ...(card.positionMeaning
        ? { positionMeaning: card.positionMeaning }
        : {}),
      ...(card.meaning ? { meaning: card.meaning } : {}),
      ...(card.keywords?.length ? { keywords: [...card.keywords] } : {}),
    })),
    ...(reading.interpretation
      ? { interpretation: reading.interpretation }
      : {}),
  };
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (!nonemptyString(item)) return false;
  }
  return new Set(value).size === value.length;
}

function optionalStrings(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  return keys.every(
    (key) => value[key] === undefined || typeof value[key] === "string",
  );
}

function isReadingCard(value: unknown): value is ReadingCard {
  if (
    !isRecord(value) ||
    !nonemptyString(value.id) ||
    !nonemptyString(value.name) ||
    !nonemptyString(value.displayName) ||
    (value.orientation !== "upright" && value.orientation !== "reversed") ||
    !optionalStrings(value, ["position", "positionMeaning", "meaning"])
  )
    return false;
  if (value.keywords !== undefined) {
    if (!Array.isArray(value.keywords)) return false;
    for (const word of value.keywords) {
      if (typeof word !== "string") return false;
    }
  }
  return true;
}

function isConfirmedReading(value: unknown): value is ConfirmedReading {
  if (
    !isRecord(value) ||
    !nonemptyString(value.drawId) ||
    !nonemptyString(value.spreadType) ||
    !nonemptyString(value.spreadName) ||
    typeof value.question !== "string" ||
    (value.language !== "en" && value.language !== "zh") ||
    !optionalStrings(value, [
      "readingId",
      "sessionId",
      "timestamp",
      "interpretation",
    ]) ||
    !Array.isArray(value.cards) ||
    value.cards.length === 0
  )
    return false;
  for (const card of value.cards) {
    if (!isReadingCard(card)) return false;
  }
  return true;
}

/** A private checkpoint is usable only alongside a matching authoritative result. */
export function restoreUiSnapshot(
  value: unknown,
  payload: BeginReadingPayload | ConfirmedReading,
): TarotUiSnapshot | undefined {
  try {
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !nonemptyString(payload.drawId) ||
      value.drawId !== payload.drawId ||
      !uniqueStrings(value.deckOrder) ||
      value.deckOrder.length !== 78 ||
      !uniqueStrings(value.selectedSlotIds) ||
      !Array.isArray(value.revealedIndices) ||
      typeof value.continuationSent !== "boolean"
    )
      return undefined;

    const incomingConfirmed = "cards" in payload;
    const requiredCount = incomingConfirmed
      ? payload.cards.length
      : payload.requiredCount;
    if (
      !Number.isInteger(requiredCount) ||
      requiredCount < 1 ||
      requiredCount > 78 ||
      value.selectedSlotIds.length > requiredCount
    )
      return undefined;
    const deck = new Set(value.deckOrder);
    if (value.selectedSlotIds.some((slot) => !deck.has(slot))) return undefined;
    if ("slots" in payload) {
      const slots = new Set(payload.slots.map((slot) => slot.slotId));
      if (
        payload.slots.length !== 78 ||
        slots.size !== 78 ||
        value.deckOrder.some((slot) => !slots.has(slot))
      )
        return undefined;
    }

    let pendingConfirmation: TarotUiSnapshot["pendingConfirmation"];
    if (value.pendingConfirmation !== undefined) {
      const pending = value.pendingConfirmation;
      const selectedSlotIds = value.selectedSlotIds;
      if (
        !isRecord(pending) ||
        !uniqueStrings(pending.selectedSlotIds) ||
        pending.selectedSlotIds.length !== requiredCount ||
        selectedSlotIds.length !== requiredCount ||
        pending.selectedSlotIds.some(
          (slot, index) => slot !== selectedSlotIds[index],
        )
      )
        return undefined;
      const failure = pending.failure;
      if (
        failure !== undefined &&
        (!isRecord(failure) ||
          (failure.code !== undefined && !nonemptyString(failure.code)) ||
          (failure.httpStatus !== undefined &&
            (typeof failure.httpStatus !== "number" ||
              !Number.isInteger(failure.httpStatus) ||
              failure.httpStatus < 100 ||
              failure.httpStatus > 599)))
      )
        return undefined;
      pendingConfirmation = {
        selectedSlotIds: [...pending.selectedSlotIds],
        ...(failure !== undefined
          ? {
              failure: {
                ...(typeof failure.code === "string"
                  ? { code: failure.code }
                  : {}),
                ...(typeof failure.httpStatus === "number"
                  ? { httpStatus: failure.httpStatus }
                  : {}),
              },
            }
          : {}),
      };
    }

    let confirmedReading: ConfirmedReading | undefined;
    if (value.confirmedReading !== undefined) {
      if (
        !isConfirmedReading(value.confirmedReading) ||
        value.confirmedReading.drawId !== payload.drawId ||
        value.confirmedReading.cards.length !== requiredCount ||
        value.selectedSlotIds.length !== requiredCount
      )
        return undefined;
      confirmedReading = value.confirmedReading;
      if (pendingConfirmation && !incomingConfirmed) return undefined;
    }
    const revealedIndices = value.revealedIndices;
    if (
      new Set(revealedIndices).size !== revealedIndices.length ||
      (value.continuationSent &&
        (!confirmedReading ||
          revealedIndices.length !== confirmedReading.cards.length))
    )
      return undefined;
    for (const index of revealedIndices) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= (confirmedReading?.cards.length ?? 0)
      )
        return undefined;
    }

    if (incomingConfirmed) {
      if (
        !isConfirmedReading(payload) ||
        value.selectedSlotIds.length !== requiredCount
      )
        return undefined;
      if (
        confirmedReading &&
        (confirmedReading.readingId !== payload.readingId ||
          confirmedReading.cards.some((card, index) => {
            const incoming = payload.cards[index]!;
            return (
              card.id !== incoming.id ||
              card.orientation !== incoming.orientation ||
              card.position !== incoming.position
            );
          }))
      )
        return undefined;
      confirmedReading = payload;
      pendingConfirmation = undefined;
    }

    return {
      version: 1,
      drawId: payload.drawId,
      deckOrder: [...value.deckOrder],
      selectedSlotIds: [...value.selectedSlotIds],
      ...(pendingConfirmation ? { pendingConfirmation } : {}),
      ...(confirmedReading
        ? { confirmedReading: modelReadingContext(confirmedReading) }
        : {}),
      revealedIndices: [...revealedIndices],
      continuationSent: value.continuationSent,
    };
  } catch {
    // Host state may be absent, stale, or malformed; it is never authoritative.
    return undefined;
  }
}
