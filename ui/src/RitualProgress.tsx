import { t, type MessageKey } from "./i18n.js";
import type { Language } from "./types.js";

export type RitualStep =
  "intention" | "shuffle" | "cut" | "select" | "reveal" | "interpret";

const steps: ReadonlyArray<{ step: RitualStep; label: MessageKey }> = [
  { step: "intention", label: "stepIntention" },
  { step: "shuffle", label: "stepShuffle" },
  { step: "cut", label: "stepCut" },
  { step: "select", label: "stepChoose" },
  { step: "reveal", label: "stepReveal" },
  { step: "interpret", label: "stepInterpret" },
];

export function RitualProgress({
  current,
  language,
}: {
  current: RitualStep;
  language: Language;
}) {
  const active = steps.findIndex(({ step }) => step === current);
  return (
    <ol className="ritual-progress" aria-label={t(language, "ritualProgress")}>
      {steps.map(({ step, label }, index) => (
        <li
          key={step}
          aria-current={step === current ? "step" : undefined}
          data-next={index === active + 1 ? true : undefined}
        >
          <span className="ritual-progress__number">{index + 1}</span>
          <span className="ritual-progress__label">{t(language, label)}</span>
        </li>
      ))}
    </ol>
  );
}
