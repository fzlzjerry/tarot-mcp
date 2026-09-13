import { useState } from "react";
import { t } from "./i18n.js";
import type { DrawClient, Language } from "./types.js";

type FullscreenState =
  { status: "idle" | "requesting" } | { status: "failed"; detail: string };

/**
 * Capability-gated full screen request shared by the table stages. The host
 * decides whether the action exists at all; a rejection becomes a notice in
 * the stage instead of an unhandled promise, and the table underneath keeps
 * its selection and revealed cards either way.
 */
export function useFullscreen(client: DrawClient): {
  available: boolean;
  requesting: boolean;
  failure?: string;
  request(): void;
} {
  const [state, setState] = useState<FullscreenState>({ status: "idle" });
  const available =
    client.requestFullscreen !== undefined &&
    (client.canRequestFullscreen?.() ?? true);

  const request = (): void => {
    if (!available || state.status === "requesting") return;
    const pending = client.requestFullscreen?.();
    if (!pending) return;
    setState({ status: "requesting" });
    pending.then(
      () => setState({ status: "idle" }),
      (error: unknown) =>
        setState({
          status: "failed",
          detail: error instanceof Error ? error.message : String(error),
        }),
    );
  };

  return {
    available,
    requesting: state.status === "requesting",
    failure: state.status === "failed" ? state.detail : undefined,
    request,
  };
}

export function FullscreenNotice({
  detail,
  language,
}: {
  detail: string;
  language: Language;
}) {
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>{t(language, "fullscreenFailed")}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}
