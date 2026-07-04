import type { JournalRow } from "./readModel";

/**
 * TypeScript port of youinc_ledger.persistence_layer.ledger_exporter.export_hledger.
 * Renders journal rows (from fetchJournalRows) as an hledger journal string,
 * grouping postings by external_id in first-appearance order.
 *
 * Byte-for-byte parity notes vs the Python original:
 *  - `f"    {account:<45} ..."` → four-space indent, account left-justified to
 *    width 45 (padEnd; no truncation when longer). Account strings are ASCII in
 *    the ledger, so UTF-16 vs code-point width never diverges here.
 *  - the amount is Python `str(cents_to_decimal(cents))`, i.e. always exactly
 *    two decimal places, negated for credit legs — see centsToDecimalString.
 *  - trailing blank line per transaction; the whole file ends in a single "\n"
 *    (and is empty when there are no rows).
 */

const ACCOUNT_WIDTH = 45;
const CENTS_PER_UNIT = 100;

/**
 * Port of `str(cents_to_decimal(cents))` for a signed integer cent amount:
 * always two decimals, e.g. 10000 -> "100.00", -500 -> "-5.00", 5 -> "0.05".
 * Pure integer arithmetic — no float — so it matches Python's Decimal string
 * form exactly (the same class of silent-divergence risk as idempotency hashing).
 */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / CENTS_PER_UNIT);
  const fraction = String(abs % CENTS_PER_UNIT).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function exportHledger(rows: ReadonlyArray<JournalRow>): string {
  const grouped = new Map<string, JournalRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.externalId);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.externalId, [row]); // Map preserves first-insertion order.
    }
  }

  const lines: string[] = [];
  for (const [externalId, entries] of grouped) {
    const first = entries[0];
    const rulePart = first.ruleId ? ` rule:${first.ruleId}` : "";
    lines.push(
      `${first.transactionDate} ${first.description} ; akahu:${externalId}${rulePart}`,
    );
    for (const entry of entries) {
      const signedCents = entry.side === "debit" ? entry.amountCents : -entry.amountCents;
      lines.push(
        `    ${entry.account.padEnd(ACCOUNT_WIDTH)} ${entry.currency} ${centsToDecimalString(signedCents)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
