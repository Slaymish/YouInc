import { useCallback, useEffect, useState } from "react";

// A first-run hint that shows forever becomes furniture. These retire
// themselves: shown until the person does the thing (or dismisses it) once,
// then never again. Flags live beside the dashboard layout, in the same
// localStorage the app already uses, so nothing new has to be provisioned.
const STORAGE_KEY = "youinc.hints.seen.v1";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(keys: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(keys)]));
  } catch {
    // Private browsing or a full quota — showing the hint again is harmless.
  }
}

export interface OneTimeHint {
  /** False until the browser has been checked, so the hint never flashes on SSR. */
  visible: boolean;
  /** Retires the hint for good. */
  dismiss: () => void;
}

export function useOneTimeHint(key: string): OneTimeHint {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readSeen().includes(key));
  }, [key]);

  const dismiss = useCallback(() => {
    setVisible(false);
    writeSeen([...readSeen(), key]);
  }, [key]);

  return { visible, dismiss };
}
