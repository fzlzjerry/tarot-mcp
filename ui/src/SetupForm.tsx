import { type FormEvent, useState } from "react";
import { getSpreadPickerCatalog } from "@tarot/readings/spread-localizations.js";
import { t } from "./i18n.js";
import type {
  BeginReadingInput,
  DrawClient,
  Language,
  ReadingKind,
} from "./types.js";

function parseCustomPositions(value: string): string[] {
  return value
    .split("\n")
    .map((position) => position.trim())
    .filter(Boolean);
}

export function SetupForm({
  language,
  client,
  onLanguageChange,
  onSubmit,
  isPending,
}: {
  language: Language;
  client: DrawClient;
  onLanguageChange(language: Language): void;
  onSubmit(input: BeginReadingInput): void;
  isPending: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [readingKind, setReadingKind] = useState<ReadingKind>("spread");
  const [spreadType, setSpreadType] = useState("three_card");
  const [customDate, setCustomDate] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPositions, setCustomPositions] = useState("");
  const [authToken, setAuthToken] = useState(
    () => client.getSessionToken?.() ?? "",
  );
  const [validation, setValidation] = useState<string | undefined>();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (readingKind !== "daily" && !question.trim()) {
      setValidation(t(language, "required"));
      return;
    }
    const positions = parseCustomPositions(customPositions);
    if (
      readingKind === "custom" &&
      (positions.length < 1 || positions.length > 15)
    ) {
      setValidation(t(language, "positionRange"));
      return;
    }
    setValidation(undefined);
    const normalizedQuestion = question.trim();
    if (readingKind === "daily") {
      onSubmit({
        readingKind,
        language,
        ...(normalizedQuestion ? { question: normalizedQuestion } : {}),
      });
    } else if (readingKind === "moon") {
      onSubmit({
        readingKind,
        question: normalizedQuestion,
        language,
        ...(customDate ? { customDate } : {}),
      });
    } else if (readingKind === "custom") {
      onSubmit({
        readingKind,
        question: normalizedQuestion,
        language,
        customSpread: {
          name: customName.trim() || t(language, "custom"),
          positions: positions.map((name) => ({ name, meaning: "" })),
        },
      });
    } else {
      onSubmit({
        readingKind,
        spreadType,
        question: normalizedQuestion,
        language,
      });
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="brand-mark" aria-hidden="true">
          ✦
        </div>
        <h1 id="setup-title">{t(language, "title")}</h1>
        <p className="setup-subtitle">{t(language, "subtitle")}</p>
        <form className="setup-form" onSubmit={submit} noValidate>
          <label className="field field--wide">
            <span>{t(language, "question")}</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t(language, "questionPlaceholder")}
              rows={3}
              maxLength={2000}
              autoFocus
              required={readingKind !== "daily"}
            />
          </label>
          <label className="field">
            <span>{t(language, "readingKind")}</span>
            <select
              value={readingKind}
              onChange={(event) =>
                setReadingKind(event.target.value as ReadingKind)
              }
            >
              <option value="spread">{t(language, "kindSpread")}</option>
              <option value="daily">{t(language, "kindDaily")}</option>
              <option value="moon">{t(language, "kindMoon")}</option>
              <option value="custom">{t(language, "kindCustom")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t(language, "language")}</span>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as Language)
              }
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {readingKind === "spread" ? (
            <label className="field field--wide">
              <span>{t(language, "spread")}</span>
              <select
                value={spreadType}
                onChange={(event) => setSpreadType(event.target.value)}
              >
                {getSpreadPickerCatalog(language).map((spread) => (
                  <option key={spread.id} value={spread.id}>
                    {spread.name} · {spread.cardCount}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {readingKind === "moon" ? (
            <label className="field field--wide">
              <span>{t(language, "moonDate")}</span>
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
            </label>
          ) : null}
          {readingKind === "custom" ? (
            <>
              <label className="field field--wide">
                <span>{t(language, "customName")}</span>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder={t(language, "customNamePlaceholder")}
                  maxLength={100}
                />
              </label>
              <label className="field field--wide">
                <span>{t(language, "customPositions")}</span>
                <textarea
                  value={customPositions}
                  onChange={(event) => setCustomPositions(event.target.value)}
                  placeholder={t(language, "customPositionsPlaceholder")}
                  rows={6}
                />
              </label>
            </>
          ) : null}
          {client.target === "web" && client.setSessionToken ? (
            <details className="settings-panel field--wide">
              <summary>{t(language, "connectionSettings")}</summary>
              <label className="field">
                <span>{t(language, "bearerToken")}</span>
                <input
                  type="password"
                  value={authToken}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t(language, "bearerTokenPlaceholder")}
                  onChange={(event) => {
                    const token = event.target.value;
                    setAuthToken(token);
                    client.setSessionToken?.(token);
                  }}
                />
                <small>{t(language, "sessionOnly")}</small>
              </label>
            </details>
          ) : null}
          {validation ? (
            <p className="form-error" role="alert">
              {validation}
            </p>
          ) : null}
          <button
            className="primary-action field--wide"
            type="submit"
            disabled={isPending}
          >
            {isPending ? t(language, "beginning") : t(language, "begin")}
          </button>
        </form>
      </section>
    </main>
  );
}
