import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  EMPTY_TOASTS,
  nextExpiryDelay,
  TOAST_DURATION_MS,
  toastQueueReducer,
  type ToastItem,
} from "./toastQueue";

export interface NotifyOptions {
  /** One sentence, already in the past tense — "Removed Kiwibank Savings." */
  message: string;
  /** Omit for a plain notice; supply to offer Undo. */
  onUndo?: () => void;
  /**
   * Runs once the toast goes without being undone. Use it to defer a write
   * that has no server-side inverse: the UI updates immediately, the write
   * lands when Undo stops being on offer.
   */
  onCommit?: () => void;
  durationMs?: number;
}

export interface UndoToasts {
  toasts: readonly ToastItem[];
  notify: (options: NotifyOptions) => void;
  dismiss: (id: number) => void;
  undo: (id: number) => void;
  /** Suspends/resumes auto-dismiss — wired to hover and focus on the stack. */
  setHeld: (held: boolean) => void;
}

/**
 * Owns the undo-toast queue for one editor. Must live in the component that
 * SURVIVES the action — a toast owned by the row being deleted unmounts with
 * it, taking the undo with it.
 */
export function useUndoToasts(): UndoToasts {
  const [toasts, dispatch] = useReducer(toastQueueReducer, EMPTY_TOASTS);
  const [held, setHeldState] = useState(false);
  const nextId = useRef(1);

  const notify = useCallback((options: NotifyOptions) => {
    dispatch({
      type: "push",
      toast: {
        id: nextId.current++,
        message: options.message,
        onUndo: options.onUndo,
        onCommit: options.onCommit,
        expiresAt: Date.now() + (options.durationMs ?? TOAST_DURATION_MS),
      },
    });
  }, []);

  // Read from a ref so the callbacks below stay referentially stable, and so
  // the unmount flush sees the live queue rather than a stale closure.
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  // A deferred write must land exactly once. Expiry, dismissal and the
  // visibility flush can all reach the same toast, so commits are recorded.
  const committed = useRef(new Set<number>());
  const commit = useCallback((toast: ToastItem) => {
    if (committed.current.has(toast.id)) return;
    committed.current.add(toast.id);
    toast.onCommit?.();
  }, []);

  // Dismissing is not undoing — the × means "I've read it", so any deferred
  // write still lands.
  const dismiss = useCallback(
    (id: number) => {
      const toast = toastsRef.current.find((t) => t.id === id);
      dispatch({ type: "dismiss", id });
      if (toast) commit(toast);
    },
    [commit],
  );

  const undo = useCallback((id: number) => {
    const toast = toastsRef.current.find((t) => t.id === id);
    // Mark it committed so a racing flush can't also fire the write.
    if (toast) committed.current.add(toast.id);
    dispatch({ type: "dismiss", id });
    toast?.onUndo?.();
  }, []);

  const setHeld = useCallback((next: boolean) => setHeldState(next), []);

  // One timer for the soonest expiry, rescheduled whenever the queue changes.
  // While held, nothing expires; on release the stack gets a fresh window so a
  // toast can't vanish the instant the pointer or focus leaves it.
  useEffect(() => {
    if (held) return;
    const delay = nextExpiryDelay(toasts, Date.now());
    if (delay === null) return;
    const handle = setTimeout(() => {
      const now = Date.now();
      // Commit anything whose undo window just closed, then drop it.
      for (const toast of toastsRef.current) {
        if (toast.expiresAt <= now) commit(toast);
      }
      dispatch({ type: "expire", now });
    }, delay);
    return () => clearTimeout(handle);
  }, [toasts, held, commit]);

  useEffect(() => {
    if (held) return;
    dispatch({ type: "extend", from: Date.now(), durationMs: TOAST_DURATION_MS });
  }, [held]);

  // The stack unmounts when it empties, so a pointer resting on the last toast
  // never gets its mouseleave — without this, held would latch on and the next
  // toast would hang around forever.
  useEffect(() => {
    if (toasts.length === 0) setHeldState(false);
  }, [toasts.length]);

  // A deferred write must not be lost because the page went away mid-window.
  // Flush on unmount and when the tab is hidden, which covers navigation,
  // closing the tab, and switching apps on a phone.
  useEffect(() => {
    // Committing behind a visible Undo button would make that button a lie, so
    // the stack is cleared in the same breath.
    const flush = () => {
      for (const toast of toastsRef.current) commit(toast);
      dispatch({ type: "expire", now: Number.MAX_SAFE_INTEGER });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [commit]);

  return { toasts, notify, dismiss, undo, setHeld };
}
