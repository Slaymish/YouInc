import type { Side } from "./rawTransaction";

/**
 * TypeScript port of youinc_ledger.models.Posting / JournalTransaction +
 * validate_balanced (P2 ledger port). Double-entry postings and the
 * balance invariant enforced before a journal transaction is persisted.
 */

export interface Posting {
  account: string;
  side: Side;
  amountCents: number;
  currency: string;
}

const DEFAULT_CURRENCY = "NZD";

/** Mirrors Python `Posting(...)` where `currency` defaults to "NZD". The
 *  pipeline never threads the transaction's currency into postings — the
 *  default is deliberate (a non-NZD txn still posts NZD legs today). */
export function posting(account: string, side: Side, amountCents: number): Posting {
  return { account, side, amountCents, currency: DEFAULT_CURRENCY };
}

export interface JournalTransaction {
  externalId: string;
  transactionDate: string;
  description: string;
  sourceAccountId: string;
  status: string;
  ruleId: string | null;
  postings: ReadonlyArray<Posting>;
}

/**
 * Port of JournalTransaction.validate_balanced: debits and credits must both
 * be strictly positive and equal, else throw (mirrors Python's ValueError
 * messages verbatim so error text stays at parity).
 */
export function validateBalanced(jt: JournalTransaction): void {
  let debitTotal = 0;
  let creditTotal = 0;
  for (const p of jt.postings) {
    if (p.side === "debit") debitTotal += p.amountCents;
    else if (p.side === "credit") creditTotal += p.amountCents;
  }
  if (debitTotal <= 0 || creditTotal <= 0) {
    throw new Error("Journal transaction must include positive debit and credit postings");
  }
  if (debitTotal !== creditTotal) {
    throw new Error(
      `Unbalanced journal transaction ${jt.externalId}: ` +
        `debits=${debitTotal}, credits=${creditTotal}`,
    );
  }
}
