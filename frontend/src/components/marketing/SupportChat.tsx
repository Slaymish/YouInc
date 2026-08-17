import { useEffect, useRef, useState } from "react";
import { SOURCE_URL, DEFAULT_EMAIL } from "./config";

// No live-chat backend exists — this is an honest affordance (spec E5) that
// routes to a real human via booking link or email, never a fake chat UI.
const POPOVER_ID = "support-chat-popover";

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="sc-root" ref={rootRef}>
      {open ? (
        <div
          className="sc-popover"
          id={POPOVER_ID}
          role="dialog"
          aria-label="Contact YouInc"
        >
          <p className="sc-popover__title">Questions about YouInc?</p>
          <p className="sc-popover__body">
            No live chat here. Open an issue on GitHub, or drop a line and I'll
            reply myself.
          </p>
          <a
            ref={firstLinkRef}
            className="mk-btn mk-btn--primary sc-popover__cta"
            href={`${SOURCE_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open an issue →
          </a>
          <a className="sc-popover__email" href={`mailto:${DEFAULT_EMAIL}`}>
            {DEFAULT_EMAIL}
          </a>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className="sc-fab"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={POPOVER_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <img
          className="sc-fab__avatar"
          src="/marketing/support-avatar.svg"
          width={96}
          height={96}
          alt=""
          loading="lazy"
        />
        <span className="sc-fab__label">Questions? Ask Hamish</span>
      </button>
    </div>
  );
}
