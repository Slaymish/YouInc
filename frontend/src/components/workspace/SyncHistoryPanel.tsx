import { useEffect, useRef, useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { AkahuSyncLogEntry } from "~/server/akahuConnection";

// --- Server functions --------------------------------------------------------

const listSyncLogFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AkahuSyncLogEntry[]> => {
    const { listSyncLog } = await import("~/server/akahuConnection");
    return listSyncLog();
  },
);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NZ");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-NZ");
}

function statusLabel(entry: AkahuSyncLogEntry): string {
  if (entry.status === "running") return "Running…";
  if (entry.status === "success") return "Success";
  return "Error";
}

interface Props {
  /** Recent sync attempts, loaded by the /workspace loader. */
  initialEntries: AkahuSyncLogEntry[];
  /** Bumped by the parent to trigger a refresh (e.g. after a new sync). */
  refreshToken?: number;
}

export function SyncHistoryPanel({ initialEntries, refreshToken }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The loader already supplied initialEntries for the first render — only
  // refetch on later bumps from the parent (e.g. after a new sync), not on
  // mount.
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        setEntries(await listSyncLogFn());
      } catch (err) {
        setError(errorMessage(err));
      }
    });
    // Only re-run when the parent bumps refreshToken, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  if (entries.length === 0 && !pending) {
    return (
      <p className="mb-empty">
        No syncs yet. Sync an Akahu account above to see its history here.
      </p>
    );
  }

  return (
    <div className="sync-history">
      {error ? <p className="mb-error" role="alert">{error}</p> : null}
      <div className="mb-table-wrap">
        <table className="mb-table sync-history__table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Date range</th>
              <th>Started</th>
              <th>Status</th>
              <th className="mb-numeric">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <code className="mb-account">{entry.akahuAccountId}</code>
                </td>
                <td>
                  {formatDate(entry.fromDate)} – {formatDate(entry.toDate)}
                </td>
                <td>{formatDateTime(entry.startedAt)}</td>
                <td>
                  <span className={`sync-history__status sync-history__status--${entry.status}`}>
                    {statusLabel(entry)}
                  </span>
                  {entry.status === "error" && entry.errorMessage ? (
                    <span className="sync-history__error">{entry.errorMessage}</span>
                  ) : null}
                </td>
                <td className="mb-numeric">{entry.transactionsIngested ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
