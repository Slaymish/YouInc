import { pyTruthy } from "./rawTransaction";

/**
 * TypeScript port of the incremental-sync cursor logic in
 * youinc_ledger.cli.cmd_sync / _latest_payload_date (P2 ledger port). Proven at
 * parity against tests/golden/fixtures/sync_state.json (see
 * syncState.golden.test.ts).
 *
 * Two pieces cmd_sync owns: the sync-state key format, and the marker value the
 * cursor advances to after a batch. Persistence (set_sync_state) and the CLI
 * exit code (1 if the pipeline reported errors else 0) live in the caller — in
 * the multi-tenant target that becomes a per-tenant server function, so only
 * the pure cursor computation is ported here.
 */

/** Cursor key for an account's incremental sync position: `last_sync:{account_id}`. */
export function syncStateKey(accountId: string): string {
  return `last_sync:${accountId}`;
}

type Payload = Record<string, unknown>;

/** `str(settlement_date or settled_at or date or "")[:10]` — the first
 *  Python-truthy of the three date sources, else "". */
function payloadDate(payload: Payload): string {
  for (const key of ["settlement_date", "settled_at", "date"]) {
    const value = payload[key];
    if (pyTruthy(value)) return String(value).slice(0, 10);
  }
  return "";
}

/**
 * Port of _latest_payload_date: the max over each payload's
 * (settlement_date | settled_at | date)[:10], ignoring empties; null if none.
 * Deliberately compares heterogeneous date sources — a payload with no
 * settlement_date contributes its own `date` to the max, a quirk the golden
 * fixture pins. Lexicographic max on YYYY-MM-DD strings equals chronological.
 */
export function latestPayloadDate(payloads: Iterable<Payload>): string | null {
  let latest: string | null = null;
  for (const payload of payloads) {
    const date = payloadDate(payload);
    if (!date) continue;
    if (latest === null || date > latest) latest = date;
  }
  return latest;
}

/**
 * Port of `sync_marker = args.end_date or _latest_payload_date(payloads)`: an
 * explicit end date wins outright, otherwise advance to the latest payload
 * date. Returns null when neither yields a value (cursor is left unchanged).
 */
export function resolveSyncMarker(
  endDate: string | null | undefined,
  payloads: Iterable<Payload>,
): string | null {
  if (pyTruthy(endDate)) return String(endDate);
  return latestPayloadDate(payloads);
}
