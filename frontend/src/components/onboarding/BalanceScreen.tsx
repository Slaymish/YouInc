import { useState } from "react";
import type { QuizCategoryMeta } from "./quizModel";
import { formatMoney } from "~/components/widgets/format";

interface BalanceScreenProps {
  meta: QuizCategoryMeta;
  cents: number; // current value (0 if unanswered)
  onChange: (cents: number) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function BalanceScreen({ meta, cents, onChange, onNext, onSkip }: BalanceScreenProps) {
  const [text, setText] = useState(cents ? String(Math.round(cents / 100)) : "");
  return (
    <section className="quiz-screen" aria-labelledby={`quiz-${meta.id}-heading`}>
      <h1 id={`quiz-${meta.id}-heading`} className="quiz-screen__headline">
        {meta.label}
      </h1>
      <p className="quiz-screen__hint">{meta.hint}</p>
      <output className="quiz-balance__value">{formatMoney(cents)}</output>
      <input
        type="range"
        min={0}
        max={meta.sliderMaxCents}
        step={meta.sliderStepCents}
        value={cents}
        aria-label={`${meta.label} amount`}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v);
          setText(String(Math.round(v / 100)));
        }}
      />
      <label className="quiz-balance__exact">
        Or type it exactly
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            setText(digits);
            onChange(digits ? Number(digits) * 100 : 0);
          }}
        />
      </label>
      <div className="quiz-screen__actions">
        <button type="button" className="mk-btn mk-btn--ghost" onClick={onSkip}>
          I don't have this
        </button>
        <button type="button" className="mk-btn mk-btn--primary" onClick={onNext}>
          Next
        </button>
      </div>
    </section>
  );
}
