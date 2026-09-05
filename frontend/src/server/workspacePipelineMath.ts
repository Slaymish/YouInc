// Pure import-health calculations.
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
