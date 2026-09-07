import { type FormEvent, useRef, useState } from "react";
import { getSpreadPickerCatalog } from "@tarot/readings/spread-localizations.js";
import { SetupShell } from "./SetupShell.js";
import { ConnectionSettings } from "./ConnectionSettings.js";
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
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const positionsRef = useRef<HTMLTextAreaElement>(null);
  const [invalidField, setInvalidField] = useState<"question" | "positions">();
  const catalog = getSpreadPickerCatalog(language);
  const preview = catalog.find(
    (spread) =>
      spread.id === (readingKind === "daily" ? "daily_guidance" : spreadType),
  );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isPending) return;
    if (readingKind !== "daily" && !question.trim()) {
      setInvalidField("question");
      questionRef.current?.focus();
      return;
    }
    const positions = parseCustomPositions(customPositions);
    if (
      readingKind === "custom" &&
      (positions.length < 1 || positions.length > 15)
    ) {
      setInvalidField("positions");
      positionsRef.current?.focus();
      return;
    }
    setInvalidField(undefined);
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
    <SetupShell
      language={language}
      onLanguageChange={onLanguageChange}
      spreadCount={catalog.length}
    >
      <form
        id="reading-form"
        className="setup-form"
        onSubmit={submit}
        noValidate
        aria-busy={isPending}
      >
        <fieldset className="reading-kind-switch">
          <legend>{t(language, "readingKind")}</legend>
          {(["spread", "daily", "moon", "custom"] as const).map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name="reading-kind"
                value={kind}
                checked={readingKind === kind}
                onChange={() => {
                  setReadingKind(kind);
                  setInvalidField(undefined);
                }}
              />
              <span>
                {t(
                  language,
                  kind === "spread"
                    ? "kindSpread"
                    : kind === "daily"
                      ? "kindDaily"
                      : kind === "moon"
                        ? "kindMoon"
                        : "kindCustom",
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="field field--wide">
          <span>{t(language, "question")}</span>
          <textarea
            ref={questionRef}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (invalidField === "question") setInvalidField(undefined);
            }}
            placeholder={t(language, "questionPlaceholder")}
            rows={3}
            maxLength={2000}
            required={readingKind !== "daily"}
            aria-invalid={invalidField === "question"}
            aria-describedby={
              invalidField === "question" ? "setup-error" : undefined
            }
          />
        </label>
        {readingKind === "spread" ? (
          <label className="field field--wide">
            <span>{t(language, "spread")}</span>
            <select
              value={spreadType}
              onChange={(event) => setSpreadType(event.target.value)}
            >
              {catalog.map((spread) => (
                <option key={spread.id} value={spread.id}>
                  {spread.name} · {spread.cardCount}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {(readingKind === "spread" || readingKind === "daily") && preview ? (
          <div className="spread-preview" aria-live="polite">
            <p>{preview.description}</p>
            <ol>
              {preview.positions.map((position, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  {position.name}
                </li>
              ))}
            </ol>
          </div>
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
                ref={positionsRef}
                value={customPositions}
                onChange={(event) => {
                  setCustomPositions(event.target.value);
                  if (invalidField === "positions") setInvalidField(undefined);
                }}
                placeholder={t(language, "customPositionsPlaceholder")}
                rows={6}
                aria-invalid={invalidField === "positions"}
                aria-describedby={
                  invalidField === "positions" ? "setup-error" : undefined
                }
              />
            </label>
          </>
        ) : null}
        {invalidField ? (
          <p id="setup-error" className="form-error" role="alert">
            {t(
              language,
              invalidField === "question" ? "required" : "positionRange",
            )}
          </p>
        ) : null}
        <button
          className="primary-action field--wide"
          type="submit"
          disabled={isPending}
        >
          <span>
            {isPending ? t(language, "beginning") : t(language, "begin")}
          </span>
          <span aria-hidden="true">↗</span>
        </button>
        <p className="setup-note">{t(language, "choiceNote")}</p>
      </form>
      <ConnectionSettings client={client} language={language} />
    </SetupShell>
  );
}
