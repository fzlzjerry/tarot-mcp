import type {
  BeginReadingInputSnapshot,
  BeginReadingPayload,
  ConfirmedReading,
  DrawSlot,
  EmbeddedImage,
  Language,
  ReadingCard,
  ReadingKind,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function numberValue(...values: unknown[]): number | undefined {
  return values.find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
}

function languageValue(value: unknown, fallback: Language = "en"): Language {
  return value === "zh" ? "zh" : value === "en" ? "en" : fallback;
}

function readingKindValue(
  value: unknown,
  fallback: ReadingKind = "spread",
): ReadingKind {
  return value === "spread" ||
    value === "daily" ||
    value === "moon" ||
    value === "custom"
    ? value
    : fallback;
}

function unwrapPayload(value: unknown): UnknownRecord {
  if (!isRecord(value)) return {};
  for (const key of ["structuredContent", "structured", "reading", "draw"]) {
    if (isRecord(value[key])) return unwrapPayload(value[key]);
  }
  return value;
}

function resultMeta(value: unknown): UnknownRecord {
  return isRecord(value) && isRecord(value._meta) ? value._meta : {};
}

function normalizeSlots(value: unknown): DrawSlot[] {
  if (!Array.isArray(value)) return [];
  const slots = value.flatMap((entry, arrayIndex) => {
    if (typeof entry === "string") {
      return [{ slotId: entry, index: arrayIndex }];
    }
    if (!isRecord(entry)) return [];
    const slotId = stringValue(entry.slotId, entry.id, entry.slot_id);
    const index = numberValue(entry.order, entry.index) ?? arrayIndex;
    return slotId ? [{ slotId, index: Math.max(0, Math.floor(index)) }] : [];
  });
  return slots.sort((left, right) => left.index - right.index);
}

function normalizeEmbeddedImage(value: unknown): EmbeddedImage | undefined {
  if (!isRecord(value)) return undefined;
  const data = stringValue(value.data, value.blob);
  if (!data) return undefined;
  return {
    mimeType: stringValue(value.mimeType, value.mime_type) ?? "image/webp",
    data,
  };
}

function embeddedImageUri(value: unknown): string | undefined {
  if (typeof value === "string" && value.startsWith("data:")) return value;
  const image = normalizeEmbeddedImage(value);
  if (!image) return undefined;
  return image.data.startsWith("data:")
    ? image.data
    : `data:${image.mimeType};base64,${image.data}`;
}

function normalizePositions(
  value: unknown,
): Array<{ name: string; meaning?: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const positions = value.flatMap((entry) => {
    if (typeof entry === "string") return [{ name: entry }];
    if (!isRecord(entry)) return [];
    const name = stringValue(entry.name, entry.position);
    return name
      ? [{ name, meaning: stringValue(entry.meaning, entry.description) }]
      : [];
  });
  return positions.length > 0 ? positions : undefined;
}

export function normalizeBeginPayload(
  value: unknown,
  input: BeginReadingInputSnapshot = {},
): BeginReadingPayload {
  const payload = unwrapPayload(value);
  const meta = resultMeta(value);
  const visualDeck = isRecord(meta.visualDeck) ? meta.visualDeck : {};
  const deck = isRecord(payload.deck) ? payload.deck : {};
  const spread = isRecord(payload.spread) ? payload.spread : {};
  const inputKind =
    input.readingKind ??
    (input.customSpread || input.spreadType === "custom" ? "custom" : "spread");
  const readingKind = readingKindValue(payload.readingKind, inputKind);
  const spreadType =
    stringValue(
      payload.spreadType,
      payload.spread_type,
      spread.type,
      input.spreadType,
    ) ?? (readingKind === "daily" ? "daily_guidance" : readingKind);
  const language = languageValue(payload.language, input.language ?? "en");
  const positions =
    normalizePositions(payload.positions) ??
    normalizePositions(spread.positions) ??
    input.customSpread?.positions;
  const requiredCount = Math.max(
    1,
    Math.min(
      15,
      Math.floor(
        numberValue(
          payload.requiredCount,
          payload.requiredCardCount,
          payload.cardCount,
          payload.selectionCount,
          spread.cardCount,
        ) ??
          positions?.length ??
          1,
      ),
    ),
  );
  const slots = normalizeSlots(
    visualDeck.slots ??
      payload.slots ??
      deck.slots ??
      payload.deckSlots ??
      payload.slotIds,
  );

  return {
    drawId: stringValue(payload.drawId, payload.draw_id) ?? "",
    readingKind,
    spreadType,
    spreadName:
      stringValue(payload.spreadName, payload.spread_name, spread.name) ??
      input.customSpread?.name ??
      spreadType,
    question: stringValue(payload.question, input.question) ?? "",
    language,
    requiredCount,
    slots,
    deckBackImageUri:
      embeddedImageUri(visualDeck.backImage) ??
      stringValue(deck.backImageUri, payload.backImageUri),
    positions,
  };
}

export function assertCompleteVisualDeck(payload: BeginReadingPayload): void {
  if (!payload.drawId) {
    throw new Error("The server did not return a drawId.");
  }
  const uniqueSlots = new Set(payload.slots.map(({ slotId }) => slotId));
  if (payload.slots.length !== 78 || uniqueSlots.size !== 78) {
    throw new Error(
      "The visual deck metadata is incomplete. Waiting for 78 opaque card slots; start a new draw if it does not arrive.",
    );
  }
  if (!payload.deckBackImageUri) {
    throw new Error(
      "The visual deck metadata is incomplete. Waiting for the generated card-back artwork; start a new draw if it does not arrive.",
    );
  }
}

function normalizeCard(
  value: unknown,
  index: number,
  cardImages: UnknownRecord,
): ReadingCard | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.cardId, value.id, value.card_id, value.name);
  const name = stringValue(value.name, value.cardName, value.displayName, id);
  if (!id || !name) return undefined;
  const orientation = value.orientation === "reversed" ? "reversed" : "upright";
  const keywords = Array.isArray(value.keywords)
    ? value.keywords.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : undefined;
  return {
    id,
    name,
    displayName:
      stringValue(value.displayName, value.localizedName, name) ?? name,
    orientation,
    position:
      stringValue(value.position, value.positionName) ?? `#${index + 1}`,
    positionMeaning: stringValue(
      value.positionMeaning,
      value.position_description,
    ),
    meaning: stringValue(
      value.meaning,
      value.generalMeaning,
      value.description,
    ),
    keywords,
    imageUri: stringValue(
      value.imageUri,
      value.imageUrl,
      value.imageResourceUri,
    ),
    embeddedImage: normalizeEmbeddedImage(cardImages[id]),
  };
}

export function normalizeConfirmedReading(
  value: unknown,
  begin?: BeginReadingPayload,
): ConfirmedReading {
  const root = unwrapPayload(value);
  const meta = resultMeta(value);
  const cardImages = isRecord(meta.cardImages) ? meta.cardImages : {};
  const nested = isRecord(root.reading) ? root.reading : root;
  const cardsValue = nested.cards ?? root.cards;
  const cards = Array.isArray(cardsValue)
    ? cardsValue.flatMap((card, index) => {
        const normalized = normalizeCard(card, index, cardImages);
        return normalized ? [normalized] : [];
      })
    : [];
  const language = languageValue(nested.language, begin?.language ?? "en");
  const spreadType =
    stringValue(nested.spreadType, begin?.spreadType) ?? "custom";
  const spread = isRecord(nested.spread) ? nested.spread : {};
  return {
    readingId: stringValue(nested.readingId, nested.id),
    sessionId: stringValue(nested.sessionId),
    drawId: stringValue(nested.drawId, begin?.drawId),
    spreadType,
    spreadName:
      stringValue(nested.spreadName, spread.name, begin?.spreadName) ??
      spreadType,
    question: stringValue(nested.question, begin?.question) ?? "",
    language,
    timestamp: stringValue(nested.timestamp, nested.confirmedAt),
    cards,
    interpretation: stringValue(nested.interpretation, root.interpretation),
    deckBackImageUri:
      embeddedImageUri(meta.backImage) ?? begin?.deckBackImageUri,
  };
}

export function extractError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (isRecord(value)) {
    const contentMessage = Array.isArray(value.content)
      ? value.content.find(
          (entry): entry is UnknownRecord =>
            isRecord(entry) &&
            entry.type === "text" &&
            typeof entry.text === "string",
        )?.text
      : undefined;
    const message = stringValue(value.error, value.message, contentMessage);
    if (message) return new Error(message);
  }
  return new Error(fallback);
}
