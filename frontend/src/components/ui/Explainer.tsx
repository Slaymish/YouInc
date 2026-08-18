import { useEffect, useId, useRef, useState } from "react";
import "./explainer.css";

interface ExplainerProps {
  /** What's being explained — used for the accessible name. */
  readonly subject: string;
  /** Lines of working in the reader's own numbers. The last says what it means. */
  readonly lines: readonly string[];
}

/**
 * The quiet "why this number?" affordance. A definition tells you what a word
 * means; this shows the arithmetic in your own figures and then says what it
 * means for you — which is the line that actually helps.
 */
export function Explainer({ subject, lines }: ExplainerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Dismiss on Escape or a click elsewhere — a popover you can't get rid of is
  // worse than no popover.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span className="explainer" ref={wrapRef}>
      <button
        type="button"
        className="explainer__toggle"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Why is ${subject} this figure?`}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open ? (
        <span className="explainer__panel" id={id} role="note">
          {lines.map((line, index) => (
            <span
              className={
                index === lines.length - 1
                  ? "explainer__line explainer__line--point"
                  : "explainer__line"
              }
              key={line}
            >
              {line}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
