import { useEffect, useRef } from "react";
import { getSpreadPickerCatalog } from "@tarot/readings/spread-localizations.js";
import { VISUAL_BEGIN_INPUT_SCHEMA } from "@tarot/shared/visual-reading-schema.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  Language,
} from "../types.js";
import type { DrawStageName } from "../useDrawSession.js";
import {
  getModelContext,
  registerWebMcpTools,
  type WebMcpTool,
} from "./registration.js";

interface ReadingContext {
  language: Language;
  stage: DrawStageName;
  pendingBegin: boolean;
  draw?: BeginReadingPayload;
  reading?: ConfirmedReading;
  selectedCount: number;
  beginReading(
    input: BeginReadingInput,
    signal?: AbortSignal,
  ): Promise<BeginReadingPayload>;
}

function readingSnapshot(current: ReadingContext) {
  return {
    stage: current.pendingBegin ? "preparing" : current.stage,
    language: current.language,
    ...(current.draw
      ? {
          spreadName: current.draw.spreadName,
          question: current.draw.question,
          requiredCount: current.draw.requiredCount,
          selectedCount: current.selectedCount,
        }
      : {}),
    ...(current.reading
      ? {
          reading: {
            spreadName: current.reading.spreadName,
            question: current.reading.question,
            interpretation: current.reading.interpretation,
            cards: current.reading.cards.map((card) => ({
              name: card.displayName,
              orientation: card.orientation,
              position: card.position,
              meaning: card.meaning,
              keywords: card.keywords,
            })),
          },
        }
      : {}),
  };
}

/** Expose the live page, not a second reading session or a server tool proxy. */
export function useWebMcp(enabled: boolean, current: ReadingContext): void {
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  });

  useEffect(() => {
    const context = enabled ? getModelContext() : undefined;
    if (!context) return;
    const tools: WebMcpTool[] = [
      {
        name: "list_available_spreads",
        description:
          "List the available tarot spreads with their card counts and positions. Does not draw cards.",
        inputSchema: {
          type: "object",
          properties: { language: { type: "string", enum: ["en", "zh"] } },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        async execute(input, { signal } = {}) {
          signal?.throwIfAborted();
          const language = input.language ?? latest.current.language;
          if (language !== "en" && language !== "zh")
            throw new Error('Language must be "en" or "zh".');
          return { spreads: getSpreadPickerCatalog(language) };
        },
      },
      {
        name: "begin_visual_reading",
        description:
          "Prepare a tarot reading in this page. Only available before a reading begins. The user then shuffles, chooses card backs and confirms in the visible table. This does not reveal cards; use get_visual_reading_state to read progress and the confirmed result.",
        inputSchema: VISUAL_BEGIN_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: true,
          consequentialHint: false,
        },
        async execute(input, { signal } = {}) {
          signal?.throwIfAborted();
          // All arguments pass through the same server validation as manual form submissions.
          await latest.current.beginReading(
            {
              ...input,
              language: input.language ?? latest.current.language,
            } as BeginReadingInput,
            signal,
          );
          return {
            stage: "ritual",
            nextAction:
              "Ask the user to choose and confirm their cards in the table.",
          };
        },
      },
      {
        name: "get_visual_reading_state",
        description:
          "Read this table's current stage and selection count, or its result after the user has confirmed. Hidden card identities, authentication tokens and private draw capabilities are never returned.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute(_input, { signal } = {}) {
          signal?.throwIfAborted();
          return readingSnapshot(latest.current);
        },
      },
    ];
    const registration = registerWebMcpTools(context, tools);
    void registration.ready.catch((error: unknown) => {
      console.warn("WebMCP tools could not be registered.", error);
    });
    return registration.dispose;
  }, [enabled]);
}
