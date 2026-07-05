import { describe, expect, it } from "vitest";
import { computePipelineHealth, latestTimestamp, type RawTransactionStatusRow } from "./workspacePipelineMath";

function row(partial: Partial<RawTransactionStatusRow>): RawTransactionStatusRow {
  return {
    transactionDate: "2026-06-01",
    processedAt: null,
    skippedReason: null,
    ...partial,
  };
}

describe("computePipelineHealth", () => {
  it("returns all-zero/null health for an empty tenant", () => {
    const health = computePipelineHealth([], null);
    expect(health).toEqual({
      rawCached: 0,
      posted: 0,
      pending: 0,
      zeroAmount: 0,
      unprocessed: 0,
      earliestTransactionDate: null,
      latestTransactionDate: null,
      lastSeenAt: null,
    });
  });

  it("buckets rows into posted / pending / zero-amount / unprocessed", () => {
    const rows: RawTransactionStatusRow[] = [
      row({ transactionDate: "2026-06-01", processedAt: "2026-06-01T00:00:00Z" }), // posted
      row({ transactionDate: "2026-06-02", processedAt: "2026-06-02T00:00:00Z" }), // posted
      row({ transactionDate: "2026-06-03", skippedReason: "pending" }),
      row({ transactionDate: "2026-06-04", skippedReason: "zero_amount" }),
      row({ transactionDate: "2026-06-05" }), // unprocessed: no processedAt, no skippedReason
    ];

    const health = computePipelineHealth(rows, "2026-06-10T00:00:00Z");

    expect(health.rawCached).toBe(5);
    expect(health.posted).toBe(2);
    expect(health.pending).toBe(1);
    expect(health.zeroAmount).toBe(1);
    expect(health.unprocessed).toBe(1);
    expect(health.earliestTransactionDate).toBe("2026-06-01");
    expect(health.latestTransactionDate).toBe("2026-06-05");
    expect(health.lastSeenAt).toBe("2026-06-10T00:00:00Z");
  });

  it("treats an unrecognized skipped_reason as unprocessed rather than miscounting", () => {
    const rows: RawTransactionStatusRow[] = [row({ skippedReason: "weird_future_reason" })];
    const health = computePipelineHealth(rows, null);
    expect(health.unprocessed).toBe(1);
    expect(health.posted).toBe(0);
    expect(health.pending).toBe(0);
    expect(health.zeroAmount).toBe(0);
  });
});

describe("latestTimestamp", () => {
  it("returns null for an empty or all-null list", () => {
    expect(latestTimestamp([])).toBeNull();
    expect(latestTimestamp([null, null])).toBeNull();
  });

  it("returns the max ISO timestamp, ignoring nulls", () => {
    expect(
      latestTimestamp(["2026-06-01T00:00:00Z", null, "2026-06-10T00:00:00Z", "2026-06-05T00:00:00Z"]),
    ).toBe("2026-06-10T00:00:00Z");
  });
});
