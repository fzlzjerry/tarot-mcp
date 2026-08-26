import {
  assertCompleteVisualDeck,
  extractError,
  isRecord,
  normalizeBeginPayload,
  normalizeConfirmedReading,
} from "./normalize.js";
import { t } from "./i18n.js";
import type {
  BeginReadingInput,
  BeginReadingPayload,
  ConfirmedReading,
  DrawClient,
  Language,
  ReadingCard,
} from "./types.js";

export const AUTH_TOKEN_SESSION_KEY = "tarot-mcp.visual-reading.bearer-token";
export const HANDOFF_TOKEN_SESSION_KEY =
  "tarot-mcp.visual-reading.handoff-token";

function readHandoffToken(): string {
  try {
    return window.sessionStorage.getItem(HANDOFF_TOKEN_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearHandoffToken(): void {
  try {
    window.sessionStorage.removeItem(HANDOFF_TOKEN_SESSION_KEY);
  } catch {
    // Some embedded/privacy contexts disable storage.
  }
}

function captureHandoffToken(): void {
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(fragment);
  if (!params.has("handoff")) return;

  const token = params.get("handoff")?.trim() ?? "";
  try {
    if (token) window.sessionStorage.setItem(HANDOFF_TOKEN_SESSION_KEY, token);
    else window.sessionStorage.removeItem(HANDOFF_TOKEN_SESSION_KEY);
  } catch {
    // The URL is still scrubbed even when session storage is unavailable.
  }

  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  } catch {
    // A restrictive host may disallow history mutation.
  }
}

function readSessionToken(): string {
  try {
    return window.sessionStorage.getItem(AUTH_TOKEN_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeSessionToken(token: string): void {
  try {
    const normalized = token.trim();
    if (normalized)
      window.sessionStorage.setItem(AUTH_TOKEN_SESSION_KEY, normalized);
    else window.sessionStorage.removeItem(AUTH_TOKEN_SESSION_KEY);
  } catch {
    // Some embedded/privacy contexts disable storage; requests remain usable without auth.
  }
}

async function postJson(path: string, bodyValue: unknown): Promise<unknown> {
  const token = readSessionToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(bodyValue),
  });
  const body = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok)
    throw extractError(body, `Request failed (${response.status})`);
  return body;
}

async function postHandoffJson(
  path: string,
  bodyValue: unknown,
): Promise<unknown> {
  const token = readHandoffToken();
  if (!token) throw new Error("The visual-reading handoff has expired.");
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Tarot-Handoff ${token}`,
      },
      body: JSON.stringify(bodyValue),
    });
  } catch {
    const language: Language = document.documentElement.lang
      .toLowerCase()
      .startsWith("zh")
      ? "zh"
      : "en";
    throw new Error(t(language, "handoffDisconnected"));
  }
  const body = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok)
    throw extractError(body, `Request failed (${response.status})`);
  return body;
}

type InitialHandoff =
  | { kind: "draw"; payload: BeginReadingPayload }
  | { kind: "reading"; payload: ConfirmedReading };

export function createWebClient(): DrawClient {
  captureHandoffToken();
  const starts = new Map<string, BeginReadingPayload>();
  let initialHandoff: Promise<InitialHandoff> | undefined;

  const resolveHandoff = (): Promise<InitialHandoff> => {
    if (!initialHandoff) {
      initialHandoff = postHandoffJson("/api/visual-handoff/resolve", {})
        .then((result) => {
          if (isRecord(result) && isRecord(result.reading)) {
            const begin = isRecord(result.draw)
              ? normalizeBeginPayload(result.draw)
              : undefined;
            if (begin) {
              assertCompleteVisualDeck(begin);
              starts.set(begin.drawId, begin);
            }
            return {
              kind: "reading" as const,
              payload: normalizeConfirmedReading(result, begin),
            };
          }
          const payload = normalizeBeginPayload(result);
          assertCompleteVisualDeck(payload);
          starts.set(payload.drawId, payload);
          return { kind: "draw" as const, payload };
        })
        .catch((error: unknown) => {
          initialHandoff = undefined;
          throw error;
        });
    }
    return initialHandoff;
  };

  return {
    target: "web",
    startsWithHandoff: () => Boolean(readHandoffToken()),
    clearHandoff() {
      clearHandoffToken();
      initialHandoff = undefined;
      starts.clear();
    },
    getSessionToken: readSessionToken,
    setSessionToken: writeSessionToken,
    subscribeInitial(handlers) {
      if (!readHandoffToken()) return () => undefined;
      let active = true;
      void resolveHandoff()
        .then((initial) => {
          if (!active) return;
          if (initial.kind === "reading") handlers.onConfirmed(initial.payload);
          else handlers.onBegin(initial.payload);
        })
        .catch((error: unknown) => {
          if (active) handlers.onError(extractError(error, "Handoff failed."));
        });
      return () => {
        active = false;
      };
    },
    async beginReading(input: BeginReadingInput): Promise<BeginReadingPayload> {
      const result = await postJson("/api/visual-readings", input);
      const payload = normalizeBeginPayload(result, input);
      assertCompleteVisualDeck(payload);
      starts.set(payload.drawId, payload);
      return payload;
    },
    async confirmReading(
      drawId: string,
      selectedSlotIds: string[],
    ): Promise<ConfirmedReading> {
      const result = readHandoffToken()
        ? await postHandoffJson("/api/visual-handoff/confirm", {
            selectedSlotIds,
          })
        : await postJson(
            `/api/visual-readings/${encodeURIComponent(drawId)}/confirm`,
            { selectedSlotIds },
          );
      return normalizeConfirmedReading(result, starts.get(drawId));
    },
    async resolveImage(card: ReadingCard): Promise<string | undefined> {
      return card.imageUri;
    },
  };
}
