export type Language = "en" | "zh";
export type ReadingKind = "spread" | "daily" | "moon" | "custom";

export interface CustomSpreadInput {
  name: string;
  description?: string;
  positions: Array<{ name: string; meaning: string }>;
}

interface BeginReadingBase {
  readingKind: ReadingKind;
  language: Language;
  idempotencyKey?: string;
}

export interface SpreadReadingInput extends BeginReadingBase {
  readingKind: "spread";
  spreadType: string;
  question: string;
  sessionId?: string;
  customDate?: never;
  customSpread?: never;
}

export interface DailyReadingInput extends BeginReadingBase {
  readingKind: "daily";
  question?: string;
  spreadType?: never;
  sessionId?: never;
  customDate?: never;
  customSpread?: never;
}

export interface MoonReadingInput extends BeginReadingBase {
  readingKind: "moon";
  question: string;
  customDate?: string;
  spreadType?: never;
  sessionId?: never;
  customSpread?: never;
}

export interface CustomReadingInput extends BeginReadingBase {
  readingKind: "custom";
  question: string;
  sessionId?: string;
  customDate?: never;
  spreadType?: never;
  customSpread: CustomSpreadInput;
}

export type BeginReadingInput =
  | SpreadReadingInput
  | DailyReadingInput
  | MoonReadingInput
  | CustomReadingInput;

export interface BeginReadingInputSnapshot {
  readingKind?: ReadingKind;
  spreadType?: string;
  question?: string;
  language?: Language;
  customDate?: string;
  customSpread?: CustomSpreadInput;
}

export interface DrawSlot {
  slotId: string;
  index: number;
}

export interface BeginReadingPayload {
  drawId: string;
  readingKind: ReadingKind;
  spreadType: string;
  spreadName: string;
  question: string;
  language: Language;
  requiredCount: number;
  slots: DrawSlot[];
  deckBackImageUri?: string;
  positions?: Array<{ name: string; meaning?: string }>;
}

export interface EmbeddedImage {
  mimeType: string;
  data: string;
}

export interface ReadingCard {
  id: string;
  name: string;
  displayName: string;
  orientation: "upright" | "reversed";
  position?: string;
  positionMeaning?: string;
  meaning?: string;
  keywords?: string[];
  imageUri?: string;
  embeddedImage?: EmbeddedImage;
}

export interface ConfirmedReading {
  readingId?: string;
  sessionId?: string;
  drawId?: string;
  spreadType: string;
  spreadName: string;
  question: string;
  language: Language;
  timestamp?: string;
  cards: ReadingCard[];
  interpretation?: string;
  deckBackImageUri?: string;
}

export interface DrawClient {
  readonly target: "web" | "mcp";
  startsWithHandoff?(): boolean;
  clearHandoff?(): void;
  beginReading(input: BeginReadingInput): Promise<BeginReadingPayload>;
  confirmReading(
    drawId: string,
    selectedSlotIds: string[],
  ): Promise<ConfirmedReading>;
  subscribeInitial?(handlers: {
    onBegin(payload: BeginReadingPayload): void;
    onConfirmed(payload: ConfirmedReading): void;
    onError(error: Error): void;
  }): () => void;
  resolveImage?(card: ReadingCard): Promise<string | undefined>;
  canRequestFullscreen?(): boolean;
  requestFullscreen?(): Promise<void>;
  getSessionToken?(): string;
  setSessionToken?(token: string): void;
}

export interface LayoutPoint {
  x: number;
  y: number;
  rotation?: number;
  layer?: number;
}

export interface SpreadTemplate {
  id: string;
  name: Record<Language, string>;
  positions: string[];
  layout: LayoutPoint[];
}
