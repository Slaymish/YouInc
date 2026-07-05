// Pure pipeline-health math for the /workspace dashboard — dependency-free
// (no Supabase, no `~/` aliases) so it can be unit-tested under the
// plugin-free vitest config, mirroring workspaceSummary.ts. The Postgres
// fetch lives in workspacePipeline.ts and calls this.
//
// Ported from the retired single-tenant SQLite `pipelineRow` query in
// server/ledger.ts (see git history at 6065eee~1): raw_transactions rows are
// bucketed into posted / pending / zero-amount / unprocessed by the same
// processed_at + skipped_reason convention persistDeltas() writes in
// tenantIngestion.ts. `lastSeenAt` deliberately comes from the caller
// (akahu_connections.last_synced_at) rather than raw_transactions.last_seen_at:
// the Postgres ingestion path only ever INSERTs brand-new raw rows (already
//-seen hashes are filtered out before persistDeltas runs), so last_seen_at is
// set once at insertion and never bumped on re-sync — a much weaker "when did
// we last sync" signal than the Akahu connection's own last_synced_at.
export interface RawTransactionStatusRow {
  transactionDate: string;
  processedAt: string | null;
  skippedReason: string | null;
}

export interface PipelineHealth {
  rawCached: number;
  posted: number;
  pending: number;
  zeroAmount: number;
  unprocessed: number;
  earliestTransactionDate: string | null;
  latestTransactionDate: string | null;
  lastSeenAt: string | null;
}

/**
 * Buckets raw-transaction rows into pipeline health counts. Mutually
 * exclusive per row: `processedAt` set => posted; else `skippedReason`
 * distinguishes pending/zero-amount; anything else (processedAt null,
 * skippedReason null) => unprocessed (e.g. a row whose journal build errored).
 */
export function computePipelineHealth(
  rows: readonly RawTransactionStatusRow[],
  lastSeenAt: string | null,
): PipelineHealth {
  let posted = 0;
  let pending = 0;
  let zeroAmount = 0;
  let unprocessed = 0;
  let earliestTransactionDate: string | null = null;
  let latestTransactionDate: string | null = null;

  for (const row of rows) {
    if (row.processedAt !== null) {
      posted += 1;
    } else if (row.skippedReason === "pending") {
      pending += 1;
    } else if (row.skippedReason === "zero_amount") {
      zeroAmount += 1;
    } else {
      unprocessed += 1;
    }

    if (earliestTransactionDate === null || row.transactionDate < earliestTransactionDate) {
      earliestTransactionDate = row.transactionDate;
    }
    if (latestTransactionDate === null || row.transactionDate > latestTransactionDate) {
      latestTransactionDate = row.transactionDate;
    }
  }

  return {
    rawCached: rows.length,
    posted,
    pending,
    zeroAmount,
    unprocessed,
    earliestTransactionDate,
    latestTransactionDate,
    lastSeenAt,
  };
}

/** Latest (max) ISO timestamp in a list, ignoring nulls. Null if none. */
export function latestTimestamp(values: readonly (string | null)[]): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (value !== null && (latest === null || value > latest)) {
      latest = value;
    }
  }
  return latest;
}
