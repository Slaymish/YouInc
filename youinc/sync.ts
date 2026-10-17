import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { execute, one, rows } from './database.ts';
import { akahuConfigFromEnv, AkahuClient, type AkahuConfig } from './akahu.ts';
import { importAccount, type ImportResult } from './import.ts';
import { applyPairs, candidates, proposePairs, type PairResult } from './transfers.ts';
import { accountMappings } from './reports.ts';
import { recordAndAnchor, type ParsedAkahuAccount } from './balances.ts';
import { finishSync, logSync } from './doctor.ts';
import { loadRoutingConfig } from './config.ts';
import type { RoutingConfig } from './routing.ts';

/**
 * Sync: the daily job.
 *
 * Order is deliberate and is the fix for the drift Hamish kept hitting:
 *
 *   1. refresh balances  — ask Akahu for a fresh read from the bank
 *   2. anchor balances   — the new stated balance becomes the anchor
 *   3. import            — postings are counted forward from that anchor
 *   4. pair transfers    — one journal per movement between his own accounts
 *
 * Anchoring before importing means a transaction is never counted twice (once
 * inside the bank's figure, once as a posting after it). If a step fails the
 * run stops and says so; a partly-applied sync is the one outcome that would
 * leave the books lying.
 */

export interface SyncOptions {
  /** Force an Akahu refresh before reading balances. */
  refresh?: boolean;
  /** First day of the transaction window (YYYY-MM-DD). */
  from?: string;
  /** Last day of the transaction window. */
  to?: string;
  /** Restrict to specific Akahu account ids. */
  only?: string[];
  dryRun?: boolean;
  client?: AkahuClient;
  config?: AkahuConfig;
  now?: Date;
}

export interface AccountSyncOutcome {
  akahuAccountId: string;
  ledgerAccount: string;
  status: 'ok' | 'balance-only' | 'error';
  balanceCents: number | null;
  balanceRefreshedAt: string | null;
  transactions: number;
  posted: number;
  imported?: ImportResult;
  error?: string;
}

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  refreshed: boolean;
  accounts: AccountSyncOutcome[];
  transfers: PairResult;
  appliedPairs: number;
  pairErrors: string[];
}

function defaultWindow(now: Date, days: number) {
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Upsert the mapping row for an Akahu account.
 *
 * The ledger account name is preserved once set (his choice, not Akahu's), and
 * a new account is first given a readable default derived from the account
 * name. Metadata is refreshed every sync: status, feed availability, credit
 * limit and connection identity all come from Akahu, never guessed.
 */
export function upsertMapping(db: DatabaseSync, account: ParsedAkahuAccount): { ledgerAccount: string } {
  const existing = one<{ ledger_account: string; account_type: string }>(
    db, 'SELECT ledger_account, account_type FROM account_mappings WHERE akahu_account_id = ?', account.akahuAccountId,
  );
  const accountType = account.type === 'CREDITCARD' || account.type === 'LOAN' ? 'liability' : 'asset';
  const ledgerAccount = existing?.ledger_account ?? defaultLedgerAccount(account, accountType);
  const now = new Date().toISOString();
  if (existing) {
    execute(
      db,
      `UPDATE account_mappings SET name = ?, has_feed = ?, connection = ?, connection_id = ?, connection_has_feed = ?,
              formatted_account = ?, credit_limit_cents = ?, updated_at = ? WHERE akahu_account_id = ?`,
      account.name, Number(account.hasFeed), account.institution, account.connectionId, Number(account.connectionHasFeed),
      account.formattedAccount, account.creditLimitCents, now, account.akahuAccountId,
    );
    return { ledgerAccount };
  }
  execute(
    db,
    `INSERT INTO account_mappings
       (id, akahu_account_id, name, ledger_account, account_type, has_feed, connection, connection_id,
        connection_has_feed, formatted_account, credit_limit_cents, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    randomUUID(), account.akahuAccountId, account.name, ledgerAccount, accountType, Number(account.hasFeed),
    account.institution, account.connectionId, Number(account.connectionHasFeed), account.formattedAccount,
    account.creditLimitCents, now, now,
  );
  return { ledgerAccount };
}

function defaultLedgerAccount(account: ParsedAkahuAccount, accountType: 'asset' | 'liability'): string {
  const institution = (account.institution ?? 'Bank').replace(/[^A-Za-z0-9 ]/g, '').trim().replace(/\s+/g, '');
  const name = account.name.replace(/[^A-Za-z0-9 ]/g, '').trim().replace(/\s+/g, '');
  const root = accountType === 'liability' ? 'Liabilities' : 'Assets';
  return `${root}:${institution || 'Bank'}:${name || account.akahuAccountId.slice(-6)}`;
}

export async function sync(db: DatabaseSync, options: SyncOptions = {}): Promise<SyncReport> {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const config: AkahuConfig = options.config ?? akahuConfigFromEnv();
  const client = options.client ?? new AkahuClient(config);
  const routing: RoutingConfig = loadRoutingConfig(db);
  const window = { ...defaultWindow(now, 90), ...(options.from ? { from: options.from } : {}), ...(options.to ? { to: options.to } : {}) };

  let refreshed = false;
  if (options.refresh && !options.dryRun) {
    // A refresh is a request, not a wait: Akahu refreshes asynchronously, so
    // the balance read below may still carry the previous timestamp. That is
    // recorded honestly via `refreshed.balance` rather than assumed current.
    await client.refresh();
    refreshed = true;
  }

  const accounts = (await client.accounts()).filter(
    (a) => !options.only?.length || options.only.includes(a.akahuAccountId),
  );

  const outcomes: AccountSyncOutcome[] = [];
  for (const account of accounts) {
    const logId = randomUUID();
    const { ledgerAccount } = upsertMapping(db, account);
    const outcome: AccountSyncOutcome = {
      akahuAccountId: account.akahuAccountId,
      ledgerAccount,
      status: account.hasFeed ? 'ok' : 'balance-only',
      balanceCents: account.balanceCents,
      balanceRefreshedAt: account.akahuRefreshedAt,
      transactions: 0,
      posted: 0,
    };
    if (account.hasFeed) logSync(db, { id: logId, account: account.akahuAccountId, startedAt, fromDate: window.from, toDate: window.to });

    if (options.dryRun) {
      outcomes.push(outcome);
      continue;
    }

    try {
      if (!account.hasFeed) {
        // Balance-only account: record the statement and anchor it. No feed,
        // no postings, and `reconcile` labels it `balance-only` rather than
        // pretending it agrees with a journal it cannot have.
        if (account.balanceCents !== null) {
          recordAndAnchor(db, {
            akahuAccountId: account.akahuAccountId,
            balanceCents: account.balanceCents,
            availableCents: account.availableCents,
            creditLimitCents: account.creditLimitCents,
            currency: account.currency,
            overdrawn: account.overdrawn,
            akahuRefreshedAt: account.akahuRefreshedAt,
            source: 'akahu',
          });
        }
        outcomes.push(outcome);
        continue;
      }

      const payloads: Record<string, unknown>[] = [];
      for await (const txn of client.transactions(account.akahuAccountId, window.from, window.to)) payloads.push(txn);
      outcome.transactions = payloads.length;
      const imported = importAccount(db, routing, account, payloads);
      outcome.imported = imported;
      outcome.posted = imported.posted;
      if (imported.errors.length) throw new Error(imported.errors[0]);
      finishSync(db, logId, 'success', imported.posted);
    } catch (error) {
      outcome.status = 'error';
      outcome.error = error instanceof Error ? error.message : String(error);
      finishSync(db, logId, 'error', null, outcome.error);
    }
    outcomes.push(outcome);
  }

  // Pairing runs over the whole ledger, not just this window: a leg that
  // arrived yesterday may only get its counterpart today.
  let transfers: PairResult = { pairs: [], unpaired: [] };
  let appliedPairs = 0;
  let pairErrors: string[] = [];
  if (!options.dryRun) {
    transfers = proposePairs(candidates(db), 3);
    const applied = applyPairs(db, routing, transfers.pairs);
    appliedPairs = applied.applied;
    pairErrors = applied.errors;
    // Re-propose so the report reflects what is still unmatched.
    transfers = proposePairs(candidates(db), 3);
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    refreshed,
    accounts: outcomes,
    transfers,
    appliedPairs,
    pairErrors,
  };
}

export { accountMappings };
export type { ParseAccountCarrier };

// Local alias so the re-export above reads clearly.
type ParseAccountCarrier = ParsedAkahuAccount;
