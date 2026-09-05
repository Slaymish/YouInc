import { rows, execute, setting } from "./database";
import { accountType } from "./accountType";
import { throwServerError } from "./serverError";
import {
  combineBalances,
  type AccountBalance,
  type LedgerTotals,
} from "./workspaceSummary";

export { accountType };
export type { AccountBalance, LedgerTotals };

export interface WorkspaceManualBalance {
  account: string;
  accountType: string;
  balanceCents: number;
  asOfDate: string;
  updatedAt: string;
}

export interface WorkspaceLedgerSummary {
  workspaceId: string;
  currency: string;
  /** The workspace's configured suspense/fallback account (default: Expenses:Uncategorized:Suspense). */
  suspenseAccount: string;
  /** Editable manual balances (the accounts a user maintains by hand). */
  manualBalances: WorkspaceManualBalance[];
  /** Combined per-account balances: journal-derived + manual (manual wins). */
  balances: AccountBalance[];
  /** Whether any journal-derived (synced) balances contribute to the total. */
  hasJournalBalances: boolean;
  totals: LedgerTotals;
}

interface ManualBalanceDbRow {
  account: string;
  balance_cents: number;
  as_of_date: string;
  updated_at: string;
}

interface JournalEntryDbRow {
  account: string;
  side: "debit" | "credit";
  amount_cents: number;
}

interface WorkspaceContext {
  workspaceId: string;
  currency: string;
  suspenseAccount: string;
}

/** Resolve the caller's primary workspace (id + default currency + suspense account), or throw 401. */
async function workspaceContext(): Promise<WorkspaceContext> {
  return { workspaceId: 'local', currency: setting('currency'), suspenseAccount: setting('suspense') };
}

/** Aggregate journal entries into per-account balances: debit +, credit −. */
function aggregateJournalBalances(
  rows: JournalEntryDbRow[],
): { account: string; balanceCents: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const signed =
      r.side === "debit" ? Number(r.amount_cents) : -Number(r.amount_cents);
    totals.set(r.account, (totals.get(r.account) ?? 0) + signed);
  }
  return [...totals.entries()].map(([account, balanceCents]) => ({
    account,
    balanceCents,
  }));
}

function summarize(
  workspace: WorkspaceContext,
  manualRows: ManualBalanceDbRow[],
  journalRows: JournalEntryDbRow[],
): WorkspaceLedgerSummary {
  const manualBalances: WorkspaceManualBalance[] = manualRows
    .map((r) => ({
      account: r.account,
      accountType: accountType(r.account),
      balanceCents: Number(r.balance_cents),
      asOfDate: r.as_of_date,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => a.account.localeCompare(b.account));

  const journalBalances = aggregateJournalBalances(journalRows);
  const { balances, totals } = combineBalances(
    journalBalances,
    manualBalances.map((m) => ({
      account: m.account,
      balanceCents: m.balanceCents,
    })),
  );

  return {
    workspaceId: workspace.workspaceId,
    currency: workspace.currency,
    suspenseAccount: workspace.suspenseAccount,
    manualBalances,
    balances,
    hasJournalBalances: journalBalances.length > 0,
    totals,
  };
}

/** The caller's workspace ledger summary: journal-derived + manual balances. */
export async function getWorkspaceLedger(): Promise<WorkspaceLedgerSummary> {
  const workspace = await workspaceContext();
  return summarize(workspace,
    rows<ManualBalanceDbRow>('SELECT * FROM manual_account_balances ORDER BY account'),
    rows<JournalEntryDbRow>('SELECT account, side, amount_cents FROM journal_entries'));
}

export interface UpsertWorkspaceBalanceInput {
  account: string;
  balanceCents: number;
  asOfDate?: string;
}

/**
 * Insert or update one manual account balance for the caller's workspace, then
 * return the refreshed summary. RLS confines the write to the caller's workspace;
 * we also set tenant_id explicitly (required by the NOT NULL column + policy
 * WITH CHECK). Account paths must be namespaced (contain a ":") so accountType()
 * can classify them as Assets/Liabilities/etc.
 */
export async function upsertWorkspaceBalance(
  input: UpsertWorkspaceBalanceInput,
): Promise<WorkspaceLedgerSummary> {
  const workspace = await workspaceContext();

  const account = input.account.trim();
  if (!account.includes(":")) {
    throwServerError(
      "Use a namespaced account, e.g. Assets:Bank:Everyday or Liabilities:Card.",
      400,
    );
  }
  if (!Number.isFinite(input.balanceCents)) {
    throwServerError("Enter a valid balance.", 400);
  }
  const balanceCents = Math.round(input.balanceCents);
  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);

  if (!Number.isSafeInteger(balanceCents)) throw new Error('Balance is too large.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || !Number.isFinite(Date.parse(asOfDate)) || new Date(asOfDate).toISOString().slice(0,10) !== asOfDate) throw new Error('Enter a valid date.');
  execute(`INSERT INTO manual_account_balances VALUES (?,?,?,?)
    ON CONFLICT(account) DO UPDATE SET balance_cents=excluded.balance_cents,
    as_of_date=excluded.as_of_date, updated_at=excluded.updated_at`,
    account, balanceCents, asOfDate, new Date().toISOString());
  return getWorkspaceLedger();
}

/** Remove a manual account balance from the caller's workspace. */
export async function deleteWorkspaceBalance(
  account: string,
): Promise<WorkspaceLedgerSummary> {
  execute('DELETE FROM manual_account_balances WHERE account = ?', account.trim());
  return getWorkspaceLedger();
}
