import { rows } from "./database";
/** One posting, joined with its parent transaction's header fields. */
export interface JournalEntryRow {
  /** Groups postings into one transaction; stable per-transaction key. */
  transactionId: string;
  externalId: string;
  /** YYYY-MM-DD */
  transactionDate: string;
  description: string;
  ruleId: string | null;
  sourceAccountId: string;
  account: string;
  side: "debit" | "credit";
  amountCents: number;
  currency: string;
}

export function readJournalEntries(): JournalEntryRow[] {
  return rows<JournalEntryRow>(`SELECT t.id AS transactionId, t.external_id AS externalId,
    t.transaction_date AS transactionDate, t.description, t.rule_id AS ruleId,
    t.source_account_id AS sourceAccountId, e.account, e.side, e.amount_cents AS amountCents, e.currency
    FROM journal_entries e JOIN journal_transactions t ON t.id=e.journal_transaction_id
    ORDER BY t.transaction_date, t.id, e.id`);
}
export async function fetchJournalEntries(_workspaceId: string): Promise<JournalEntryRow[]> {
  return readJournalEntries();
}
