/**
 * Double-entry primitives, ported from frontend/src/server/ledger-engine/journal.ts.
 *
 * Debits and credits must both be strictly positive and equal. Integer cents
 * throughout: no float arithmetic ever touches a balance.
 */
export type Side = 'debit' | 'credit';

export interface Posting {
  account: string;
  side: Side;
  amountCents: number;
  currency: string;
}

export const DEFAULT_CURRENCY = 'NZD';

export function posting(account: string, side: Side, amountCents: number, currency = DEFAULT_CURRENCY): Posting {
  return { account, side, amountCents, currency };
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

export function validateBalanced(journal: JournalTransaction): void {
  let debitTotal = 0;
  let creditTotal = 0;
  for (const p of journal.postings) {
    if (p.side === 'debit') debitTotal += p.amountCents;
    else if (p.side === 'credit') creditTotal += p.amountCents;
    else throw new Error(`Invalid posting side: ${String(p.side)}`);
  }
  if (debitTotal <= 0 || creditTotal <= 0) {
    throw new Error('Journal transaction must include positive debit and credit postings');
  }
  if (debitTotal !== creditTotal) {
    throw new Error(`Unbalanced journal transaction ${journal.externalId}: debits=${debitTotal}, credits=${creditTotal}`);
  }
}
