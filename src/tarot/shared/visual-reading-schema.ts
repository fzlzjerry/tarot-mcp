import { SPREAD_TYPES } from "./types.js";

const VISUAL_COMMON_INPUT_PROPERTIES = {
  readingKind: {
    type: "string",
    enum: ["spread", "daily", "moon", "custom"],
  },
  language: {
    type: "string",
    enum: ["en", "zh"],
    default: "en",
  },
  question: {
    type: "string",
    description: "Question or focus for the visual reading.",
  },
  idempotencyKey: {
    type: "string",
    maxLength: 128,
    description:
      "Optional high-entropy client key (a random UUID is recommended). Reusing it with identical parameters returns the same prepared draw; treat it as a draw capability and do not share it between callers.",
  },
} as const;

const VISUAL_SESSION_ID_PROPERTY = {
  type: "string",
  description:
    "Continuation only: pass an exact server-issued session_... ID; omit for a new session.",
} as const;

const VISUAL_CUSTOM_SPREAD_PROPERTY = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    positions: {
      type: "array",
      minItems: 1,
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  required: ["name", "positions"],
} as const;

/** Shared by the MCP server and the browser WebMCP provider. */
export const VISUAL_BEGIN_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ...VISUAL_COMMON_INPUT_PROPERTIES,
    spreadType: { type: "string", enum: [...SPREAD_TYPES] },
    sessionId: VISUAL_SESSION_ID_PROPERTY,
    customDate: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
    customSpread: VISUAL_CUSTOM_SPREAD_PROPERTY,
  },
  required: ["readingKind"],
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      properties: {
        ...VISUAL_COMMON_INPUT_PROPERTIES,
        readingKind: { const: "spread" },
        spreadType: {
          type: "string",
          enum: [...SPREAD_TYPES],
        },
        sessionId: VISUAL_SESSION_ID_PROPERTY,
      },
      required: ["readingKind", "spreadType", "question"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        ...VISUAL_COMMON_INPUT_PROPERTIES,
        readingKind: { const: "daily" },
      },
      required: ["readingKind"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        ...VISUAL_COMMON_INPUT_PROPERTIES,
        readingKind: { const: "moon" },
        customDate: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
      },
      required: ["readingKind"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        ...VISUAL_COMMON_INPUT_PROPERTIES,
        readingKind: { const: "custom" },
        customSpread: VISUAL_CUSTOM_SPREAD_PROPERTY,
        sessionId: VISUAL_SESSION_ID_PROPERTY,
      },
      required: ["readingKind", "question", "customSpread"],
    },
  ],
};
