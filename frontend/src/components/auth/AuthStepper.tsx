// Step-progress dots for the multi-step signin/signup flows. Reuses the
// `onb-steps` dot pattern from onboarding so the two flows read consistently.

interface AuthStepperProps {
  /** 0-based index of the current step. */
  index: number;
  /** Total number of steps. */
  count: number;
}

export function AuthStepper({ index, count }: AuthStepperProps) {
  return (
    <div className="onb-steps" aria-hidden="true">
      {Array.from({ length: count }, (_, s) => (
        <span
          key={s}
          className={
            "onb-steps__dot" +
            (s < index
              ? " onb-steps__dot--done"
              : s === index
                ? " onb-steps__dot--active"
                : "")
          }
        />
      ))}
    </div>
  );
}
