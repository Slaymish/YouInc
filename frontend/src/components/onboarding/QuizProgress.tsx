interface QuizProgressProps {
  current: number;
  total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
  const pct = Math.round((current / total) * 100);
  return (
    <div
      className="quiz-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="quiz-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
