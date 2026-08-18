import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { UndoToasts } from "./useUndo";
import "./toast.css";

const HOST_ID = "youinc-toast-host";

/**
 * One shared live region in <body> for the whole page. Editors each own their
 * own queue but portal into this single host, so two stacks can't overlap each
 * other in the corner — they read as one column. Created on mount (before any
 * toast exists) because a live region has to be in the DOM before its content
 * changes or the change is never announced.
 */
function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.className = "toast-host";
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  // role="status" implies atomic, which would re-announce the whole stack on
  // every change; false so only the newly added toast is read out.
  host.setAttribute("aria-atomic", "false");
  document.body.appendChild(host);
  return host;
}

function useToastHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // Effect-only so this is a no-op during SSR; toasts are post-interaction.
  useEffect(() => setHost(ensureHost()), []);
  return host;
}

/**
 * Renders an editor's queue into the shared live region. Never moves focus —
 * an interruption that yanks the caret out of a form is worse than the problem
 * it solves; the Undo button is reachable by Tab instead.
 */
export function ToastViewport({ toasts, dismiss, undo, setHeld }: UndoToasts) {
  const host = useToastHost();
  if (!host || toasts.length === 0) return null;

  return createPortal(
    <ol
      className="toast-stack"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        const id = Number((event.target as HTMLElement).closest("li")?.dataset.toastId);
        if (Number.isFinite(id)) dismiss(id);
      }}
    >
      {toasts.map((toast) => (
        <li key={toast.id} className="toast" data-toast-id={toast.id}>
          <p className="toast__message">{toast.message}</p>
          {toast.onUndo ? (
            <button type="button" className="toast__undo" onClick={() => undo(toast.id)}>
              Undo
            </button>
          ) : null}
          <button
            type="button"
            className="toast__dismiss"
            aria-label="Dismiss notification"
            onClick={() => dismiss(toast.id)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ol>,
    host,
  );
}
