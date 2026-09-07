import { useState } from "react";
import { t } from "./i18n.js";
import type { DrawClient, Language } from "./types.js";

export function ConnectionSettings({
  client,
  language,
}: {
  client: DrawClient;
  language: Language;
}) {
  const [token, setToken] = useState(() => client.getSessionToken?.() ?? "");
  if (client.target !== "web" || !client.setSessionToken) return null;
  return (
    <details className="settings-panel">
      <summary>{t(language, "connectionSettings")}</summary>
      <label className="field">
        <span>{t(language, "bearerToken")}</span>
        <input
          type="password"
          value={token}
          autoComplete="off"
          spellCheck={false}
          placeholder={t(language, "bearerTokenPlaceholder")}
          onChange={(event) => {
            setToken(event.target.value);
            client.setSessionToken?.(event.target.value);
          }}
        />
        <small>{t(language, "sessionOnly")}</small>
      </label>
    </details>
  );
}
