import { QUIZ_GOALS, type QuizGoal } from "./quizModel";

interface GoalScreenProps {
  value: QuizGoal | null;
  onSelect: (goal: QuizGoal) => void;
}

export function GoalScreen({ value, onSelect }: GoalScreenProps) {
  return (
    <section className="quiz-screen" aria-labelledby="quiz-goal-heading">
      <h1 id="quiz-goal-heading" className="quiz-screen__headline">
        What are you trying to get a handle on?
      </h1>
      <ul className="quiz-goal__list">
        {QUIZ_GOALS.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={`quiz-goal__option${value === g.id ? " is-selected" : ""}`}
              aria-pressed={value === g.id}
              onClick={() => onSelect(g.id)}
            >
              {g.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
