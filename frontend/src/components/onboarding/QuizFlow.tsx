import { useEffect, useState } from "react";
import {
  QUIZ_CATEGORIES,
  emptyQuizState,
  type QuizCategory,
  type QuizGoal,
  type QuizState,
} from "./quizModel";
import { loadQuizState, persistQuizState } from "./quizStorage";
import { GoalScreen } from "./GoalScreen";
import { BalanceScreen } from "./BalanceScreen";
import { QuizProgress } from "./QuizProgress";
import { RevealScreen } from "./RevealScreen";

type Phase = "goal" | number | "reveal"; // number = index into QUIZ_CATEGORIES
const TOTAL = QUIZ_CATEGORIES.length + 1; // goal + categories

export function QuizFlow() {
  const [state, setState] = useState<QuizState>(() =>
    typeof window === "undefined" ? emptyQuizState() : loadQuizState(),
  );
  const [phase, setPhase] = useState<Phase>("goal");

  useEffect(() => {
    persistQuizState(state);
  }, [state]);

  const centsFor = (id: QuizCategory) => state.entries.find((e) => e.category === id)?.cents ?? 0;

  const setGoal = (goal: QuizGoal) => {
    setState((s) => ({ ...s, goal }));
    setPhase(0);
  };

  const setCents = (id: QuizCategory, cents: number) =>
    setState((s) => {
      const rest = s.entries.filter((e) => e.category !== id);
      return { ...s, entries: cents > 0 ? [...rest, { category: id, cents }] : rest };
    });

  const advance = (i: number) => setPhase(i + 1 >= QUIZ_CATEGORIES.length ? "reveal" : i + 1);

  if (phase === "reveal") {
    return <RevealScreen state={state} onRestart={() => setPhase("goal")} />;
  }

  const stepIndex = phase === "goal" ? 0 : phase + 1;
  return (
    <main className="mk quiz-flow">
      <QuizProgress current={stepIndex} total={TOTAL} />
      {phase === "goal" ? (
        <GoalScreen value={state.goal} onSelect={setGoal} />
      ) : (
        <BalanceScreen
          meta={QUIZ_CATEGORIES[phase]}
          cents={centsFor(QUIZ_CATEGORIES[phase].id)}
          onChange={(c) => setCents(QUIZ_CATEGORIES[phase].id, c)}
          onNext={() => advance(phase)}
          onSkip={() => {
            setCents(QUIZ_CATEGORIES[phase].id, 0);
            advance(phase);
          }}
        />
      )}
    </main>
  );
}
