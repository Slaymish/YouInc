import type { Side } from "./rawTransaction";
import type { JournalTransaction } from "./journal";

/**
 * TypeScript port of the *read side* of youinc_ledger's LedgerDatabase:
 * `fetch_balances`, `fetch_income_statement` and `fetch_journal_rows`. The
 * Python originals are SQL aggregations over `journal_entries` (joined to
 * `journal_transactions`); here they run over the in-memory journals the ported
 * pipeline produced (see InMemoryLedgerStore.orderedJournals), reproducing the
 * exact sign conventions, grouping keys and ORDER BY the golden fixture pins.
 *
 * Sign conventions (mirroring the CASE expressions in db.py):
 *  - balances:         debit  positive, credit negative  (net asset/liability)
 *  - income statement: credit positive, debit  negative  (P&L accounts)
 */

export interface BalanceRow {
  account: string;
  balanceCents: number;
  currency: string;
}

export interface IncomeStatementRow {
  month: string;
  account: string;
  amountCents: number;
  currency: string;
}

export interface JournalRow {
  externalId: string;
  transactionDate: string;
  description: string;
  ruleId: string | null;
  account: string;
  side: Side;
  amountCents: number;
  currency: string;
}

/** SQLite's default BINARY collation compares by byte/code-point; for the
 *  ASCII account/month strings in the ledger that is exactly JS's `<` on
 *  strings. Group keys join fields on NUL so no field value can collide. */
const KEY_SEP = "\u0000";

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Port of `LedgerDatabase.fetch_balances`:
 *   SUM(debit ? +amount : -amount) GROUP BY account, currency ORDER BY account.
 * Currency is a secondary sort key (deterministic for the single-currency
 * ledger; never reorders same-account rows because each account is one
 * currency today).
 */
export function fetchBalances(journals: ReadonlyArray<JournalTransaction>): BalanceRow[] {
  const totals = new Map<string, BalanceRow>();
  for (const jt of journals) {
    for (const p of jt.postings) {
      const key = `${p.account}${KEY_SEP}${p.currency}`;
      const signed = p.side === "debit" ? p.amountCents : -p.amountCents;
      const existing = totals.get(key);
      if (existing) {
        totals.set(key, { ...existing, balanceCents: existing.balanceCents + signed });
      } else {
        totals.set(key, { account: p.account, balanceCents: signed, currency: p.currency });
      }
    }
  }
  return [...totals.values()].sort(
    (a, b) => compareStrings(a.account, b.account) || compareStrings(a.currency, b.currency),
  );
}

/**
 * Port of `LedgerDatabase.fetch_income_statement`:
 *   month = substr(transaction_date, 1, 7); credit positive, debit negative;
 *   WHERE account LIKE 'Income:%' OR 'Expenses:%';
 *   GROUP BY month, account, currency ORDER BY month, account.
 */
export function fetchIncomeStatement(
  journals: ReadonlyArray<JournalTransaction>,
): IncomeStatementRow[] {
  const totals = new Map<string, IncomeStatementRow>();
  for (const jt of journals) {
    const month = jt.transactionDate.slice(0, 7);
    for (const p of jt.postings) {
      // Python uses SQL `LIKE`, which is ASCII case-insensitive; `startsWith`
      // is case-sensitive. Unexercised by the corpus (ledger accounts are
      // always "Income:"/"Expenses:"), so this is a documented, not silent,
      // difference — no rule maps a lowercase P&L prefix today.
      if (!p.account.startsWith("Income:") && !p.account.startsWith("Expenses:")) continue;
      const key = `${month}${KEY_SEP}${p.account}${KEY_SEP}${p.currency}`;
      const signed = p.side === "credit" ? p.amountCents : -p.amountCents;
      const existing = totals.get(key);
      if (existing) {
        totals.set(key, { ...existing, amountCents: existing.amountCents + signed });
      } else {
        totals.set(key, { month, account: p.account, amountCents: signed, currency: p.currency });
      }
    }
  }
  return [...totals.values()].sort(
    (a, b) => compareStrings(a.month, b.month) || compareStrings(a.account, b.account),
  );
}

/**
 * Port of `LedgerDatabase.fetch_journal_rows`: one row per posting, joined to
 * its journal header, ORDER BY transaction_date, jt insertion, posting
 * insertion. `journals` must already be in (transaction_date, insertion) order
 * — i.e. `InMemoryLedgerStore.orderedJournals()` — and postings keep their
 * insertion order, so a flat map reproduces the SQL ordering exactly.
 */
export function fetchJournalRows(journals: ReadonlyArray<JournalTransaction>): JournalRow[] {
  const rows: JournalRow[] = [];
  for (const jt of journals) {
    for (const p of jt.postings) {
      rows.push({
        externalId: jt.externalId,
        transactionDate: jt.transactionDate,
        description: jt.description,
        ruleId: jt.ruleId,
        account: p.account,
        side: p.side,
        amountCents: p.amountCents,
        currency: p.currency,
      });
    }
  }
  return rows;
}
