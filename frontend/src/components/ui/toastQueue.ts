// Pure queue logic for the undo toast. Deliberately React-free so it can be
// unit-tested in vitest's node environment (see toastQueue.test.ts).
//
// Timing model: every toast carries an absolute `expiresAt`. The host schedules
// ONE timer for the soonest expiry rather than a timer per toast, and hovering
// or focusing the stack suspends expiry entirely (WCAG 2.2.1) — on release the
// whole stack is granted a fresh window via the `extend` action.

/** Auto-dismiss window. Long enough to read a sentence and reach for Undo. */
export const TOAST_DURATION_MS = 8000;

/**
 * Bounded stack rather than a single replaceable slot: tidying up several rows
 * in a row is a real flow, and each toast owns a distinct undo payload, so
 * replacing would silently discard the earlier undos. Capped so the stack can
 * never take over the viewport — the oldest is evicted past the cap.
 */
export const MAX_TOASTS = 3;

export interface ToastItem {
  id: number;
  message: string;
  /** Absent for a plain notice; present when the action is reversible. */
  onUndo?: () => void;
  /**
   * Runs when the toast goes away WITHOUT being undone — expiry, dismissal, or
   * a flush on unmount. Lets a caller defer the real write until undo is no
   * longer on offer, which is the only way to reverse something the server has
   * no inverse operation for.
   */
  onCommit?: () => void;
  expiresAt: number;
}

export type ToastQueueAction =
  | { type: "push"; toast: ToastItem }
  | { type: "dismiss"; id: number }
  | { type: "expire"; now: number }
  | { type: "extend"; from: number; durationMs: number };

export const EMPTY_TOASTS: readonly ToastItem[] = [];

export function toastQueueReducer(
  state: readonly ToastItem[],
  action: ToastQueueAction,
): readonly ToastItem[] {
  switch (action.type) {
    case "push": {
      const next = [...state, action.toast];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    }
    case "dismiss": {
      const next = state.filter((t) => t.id !== action.id);
      return next.length === state.length ? state : next;
    }
    case "expire": {
      const next = state.filter((t) => t.expiresAt > action.now);
      return next.length === state.length ? state : next;
    }
    case "extend": {
      if (state.length === 0) return state;
      const expiresAt = action.from + action.durationMs;
      return state.map((t) => ({ ...t, expiresAt }));
    }
    default:
      return state;
  }
}

/**
 * Milliseconds until the soonest expiry, or null when nothing is queued.
 * Never negative, so an already-overdue toast is swept on the next tick.
 */
export function nextExpiryDelay(
  state: readonly ToastItem[],
  now: number,
): number | null {
  if (state.length === 0) return null;
  const soonest = state.reduce((min, t) => (t.expiresAt < min ? t.expiresAt : min), Infinity);
  return Math.max(0, soonest - now);
}
