import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";

export const submitFeedback = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const { recordFeedback } = await import("~/server/feedback");
    return recordFeedback(data);
  });

const ANSWERED_KEY = "youinc.feedback.answered.v1";
const VARIANT_KEY = "youinc.feedback.variant";

type Variant = "A" | "B";
type Vote = "up" | "down";
type Status = "hidden" | "prompt" | "note" | "sending" | "done";

const COPY: Record<Variant, { question: string; thanks: string }> = {
  A: {
    question: "Did you find what you were looking for?",
    thanks: "Thanks — that helps us improve YouInc.",
  },
  B: {
    question: "Quick one: was this page useful?",
    thanks: "Appreciate it — feedback like this shapes what we build next.",
  },
};

function readVariant(): Variant {
  try {
    const stored = window.localStorage.getItem(VARIANT_KEY);
    if (stored === "A" || stored === "B") return stored;
    const assigned: Variant = Math.random() < 0.5 ? "A" : "B";
    window.localStorage.setItem(VARIANT_KEY, assigned);
    return assigned;
  } catch {
    return "A";
  }
}

function hasAnswered(): boolean {
  try {
    return window.localStorage.getItem(ANSWERED_KEY) === "1";
  } catch {
    return false;
  }
}

function markAnswered(): void {
  try {
    window.localStorage.setItem(ANSWERED_KEY, "1");
  } catch {
    // Storage unavailable (private mode etc.) — non-fatal, widget just re-appears next visit.
  }
}

interface FeedbackWidgetProps {
  source?: string;
}

export function FeedbackWidget({ source = "marketing" }: FeedbackWidgetProps) {
  const [status, setStatus] = useState<Status>("hidden");
  const [variant, setVariant] = useState<Variant>("A");
  const [vote, setVote] = useState<Vote | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (hasAnswered()) return;
    setVariant(readVariant());

    // Self-contained trigger: append a 1px sentinel to the true end of the
    // document body so this widget detects "near page bottom" regardless of
    // where in the tree it is mounted, without coordinating with the footer.
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "height:1px;width:100%;pointer-events:none;";
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStatus((current) => (current === "hidden" ? "prompt" : current));
        }
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  function dismiss() {
    markAnswered();
    setStatus("hidden");
  }

  async function send(finalVote: Vote, finalNote?: string) {
    setStatus("sending");
    try {
      await submitFeedback({
        data: {
          vote: finalVote,
          note: finalNote?.trim() ? finalNote.trim() : undefined,
          variant,
          source,
          path: window.location.pathname,
        },
      });
    } catch {
      // Best-effort: still show the thank-you state so a flaky network
      // doesn't strand the visitor mid-interaction.
    } finally {
      markAnswered();
      setStatus("done");
    }
  }

  function handleVote(chosen: Vote) {
    setVote(chosen);
    if (chosen === "up") {
      void send("up");
      return;
    }
    setStatus("note");
  }

  if (status === "hidden") return null;

  return (
    <aside className="fb-widget" role="complementary" aria-label="Page feedback">
      <div className="fb-panel">
        {status !== "done" ? (
          <button
            type="button"
            className="fb-dismiss"
            aria-label="Dismiss feedback prompt"
            onClick={dismiss}
          >
            ×
          </button>
        ) : null}

        {status === "prompt" || status === "note" || status === "sending" ? (
          <>
            <p className="fb-question">{COPY[variant].question}</p>
            <div className="fb-votes" role="group" aria-label="Feedback vote">
              <button
                type="button"
                className={`fb-vote${vote === "up" ? " fb-vote--active" : ""}`}
                onClick={() => handleVote("up")}
                disabled={status === "sending"}
                aria-label="Yes, this was helpful"
              >
                👍
              </button>
              <button
                type="button"
                className={`fb-vote${vote === "down" ? " fb-vote--active" : ""}`}
                onClick={() => handleVote("down")}
                disabled={status === "sending"}
                aria-label="No, this was not helpful"
              >
                👎
              </button>
            </div>
            {status === "note" ? (
              <form
                className="fb-note-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send("down", note);
                }}
              >
                <label className="visually-hidden" htmlFor="fb-note">
                  What could be better? (optional)
                </label>
                <textarea
                  id="fb-note"
                  className="fb-note"
                  maxLength={500}
                  rows={2}
                  placeholder="What could be better? (optional)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <button className="mk-btn mk-btn--primary fb-note-submit" type="submit" disabled={status === "sending"}>
                  Send feedback
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <p className="fb-thanks" role="status" aria-live="polite">
            {COPY[variant].thanks}
          </p>
        )}
      </div>
    </aside>
  );
}
