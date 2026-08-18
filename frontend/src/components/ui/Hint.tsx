import { useOneTimeHint } from "./useOneTimeHint";
import "./hint.css";

/**
 * A pointer at something nobody discovers unaided. It appears once, and once
 * it's dismissed it never comes back — the whole point of a hint is that it
 * stops being one.
 */
export function Hint({
  hintKey,
  children,
}: {
  /** Stable key; changing it re-shows the hint for everyone. */
  readonly hintKey: string;
  readonly children: React.ReactNode;
}) {
  const { visible, dismiss } = useOneTimeHint(hintKey);
  if (!visible) return null;

  return (
    <aside className="hint">
      <p className="hint__text">{children}</p>
      <button className="hint__dismiss" type="button" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}
