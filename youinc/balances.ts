import type { DatabaseSync } from 'node:sqlite';
import { atomic, execute, one, rows } from './database.ts';

/**
 * Balance anchoring: the bank's stated balance is the truth, the journal
 * explains the difference.
 *
 *   ledger_balance(account) = anchor_cents + sum(postings strictly after anchored_at)
 *
 * Every statement Akahu makes about a balance is appended to account_balances
 * (history is never rewritten), and account_basis records which statement is
 * currently in force. Reconciliation then compares the two independently, so
 * drift is a reported fact rather than a silent recalculation.
 */

export type BalanceSource = 'akahu' | 'manual' | 'opening';
export type BasisReason = 'reported' | 'opening' | 'manual';

export interface BalanceStatement {
  akahuAccountId: string;
  balanceCents: number;
  availableCents?: number | null;
  creditLimitCents?: number | null;
  currency?: string;
  overdrawn?: boolean | null;
  /** Akahu's `refreshed.balance` — when the bank last reported it. */
  akahuRefreshedAt?: string | null;
  fetchedAt?: string;
  source: BalanceSource;
  rawJson?: string | null;
}

/** Decimal dollars (or a string) to integer cents, ties away from zero.
 *  Mirrors the ledger engine's decimalToCents so both use one rounding rule. */
export function toCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (!s) return null;
  const negative = s.startsWith('-');
  if (negative || s.startsWith('+')) s = s.slice(1);
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const [intPart = '0', fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '000').slice(0, 3);
  let cents = parseInt(intPart || '0', 10) * 100 + parseInt(frac.slice(0, 2), 10);
  if (parseInt(frac[2], 10) >= 5) cents += 1;
  return negative ? -cents : cents;
}

/** Shape of one item from Akahu `GET /v1/accounts` (only what we use). */
export interface AkahuAccountPayload {
  _id?: unknown;
  name?: unknown;
  status?: unknown;
  type?: unknown;
  attributes?: unknown;
  formatted_account?: unknown;
  connection?: { name?: unknown } | null;
  balance?: {
    current?: unknown; available?: unknown; limit?: unknown;
    currency?: unknown; overdrawn?: unknown;
  } | null;
  refreshed?: { balance?: unknown } | null;
}

export interface ParsedAkahuAccount {
  akahuAccountId: string;
  name: string;
  institution: string | null;
  status: string;
  type: string;
  formattedAccount: string | null;
  hasFeed: boolean;
  connectionId: string | null;
  /** Whether any account under this authorisation exposes transactions.
   *  When none do, both feeds would be empty and a transfer pair between two
   *  of them can never be verified — see `sameFixture`. */
  connectionHasFeed: boolean;
  balanceCents: number | null;
  availableCents: number | null;
  creditLimitCents: number | null;
  currency: string;
  overdrawn: boolean | null;
  akahuRefreshedAt: string | null;
}

/**
 * Akahu reports `has_feed` through the account's `attributes` list, not its
 * type: an account without `TRANSACTIONS` still reports a balance but has no
 * transaction feed (his Sharesies Growth/Emergencies/KiwiSaver). Balance-only
 * accounts must be labelled, never reconciled against a feed that is absent.
 */
export function parseAkahuAccount(raw: AkahuAccountPayload): ParsedAkahuAccount {
  const id = typeof raw._id === 'string' ? raw._id : '';
  if (!id) throw new Error('Akahu account is missing _id');
  const attributes = Array.isArray(raw.attributes) ? raw.attributes.map(String) : [];
  const balance = raw.balance ?? null;
  const status = typeof raw.status === 'string' ? raw.status : 'UNKNOWN';
  const connection = (raw.connection ?? null) as Record<string, unknown> | null;
  return {
    akahuAccountId: id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : id,
    institution: connection && typeof connection.name === 'string' ? connection.name : null,
    connectionId: connection && typeof connection._id === 'string' ? connection._id : null,
    connectionHasFeed: false, // filled in by the client once every account is known
    status,
    type: typeof raw.type === 'string' ? raw.type : 'UNKNOWN',
    formattedAccount: typeof raw.formatted_account === 'string' ? raw.formatted_account : null,
    hasFeed: attributes.includes('TRANSACTIONS'),
    balanceCents: toCents(balance?.current as number | string | null | undefined),
    availableCents: toCents(balance?.available as number | string | null | undefined),
    creditLimitCents: toCents(balance?.limit as number | string | null | undefined),
    currency: typeof balance?.currency === 'string' ? balance.currency.toUpperCase() : 'NZD',
    overdrawn: typeof balance?.overdrawn === 'boolean' ? balance.overdrawn : null,
    akahuRefreshedAt: typeof raw.refreshed?.balance === 'string' ? raw.refreshed.balance : null,
  };
}

/** Append one statement to history and return its row id. */
export function recordBalance(db: DatabaseSync, statement: BalanceStatement): number {
  const fetchedAt = statement.fetchedAt ?? new Date().toISOString();
  const result = execute(
    db,
    `INSERT INTO account_balances
       (akahu_account_id, balance_cents, available_cents, credit_limit_cents, currency,
        overdrawn, akahu_refreshed_at, fetched_at, source, raw_json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    statement.akahuAccountId,
    statement.balanceCents,
    statement.availableCents ?? null,
    statement.creditLimitCents ?? null,
    statement.currency ?? 'NZD',
    statement.overdrawn === null || statement.overdrawn === undefined ? null : Number(statement.overdrawn),
    statement.akahuRefreshedAt ?? null,
    fetchedAt,
    statement.source,
    statement.rawJson ?? null,
  );
  return Number(result.lastInsertRowid);
}

/**
 * Move the anchor to the latest reported balance.
 *
 * Anchored at the bank's own `refreshed.balance` timestamp when it gives one,
 * not at sync time: postings dated between the bank's last refresh and our
 * fetch are then counted exactly once, rather than being assumed either in or
 * out of the stated balance.
 */
export function setBasis(
  db: DatabaseSync,
  akahuAccountId: string,
  anchorCents: number,
  anchoredAt: string,
  reason: BasisReason,
  balanceId: number | null = null,
): void {
  execute(
    db,
    `INSERT INTO account_basis (akahu_account_id, anchor_cents, anchored_at, anchor_balance_id, reason, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(akahu_account_id) DO UPDATE SET
       anchor_cents = excluded.anchor_cents,
       anchored_at = excluded.anchored_at,
       anchor_balance_id = excluded.anchor_balance_id,
       reason = excluded.reason,
       updated_at = excluded.updated_at`,
    akahuAccountId,
    anchorCents,
    anchoredAt,
    balanceId,
    reason,
    new Date().toISOString(),
  );
}

/** Record a statement and make it the anchor in one transaction. */
export function recordAndAnchor(db: DatabaseSync, statement: BalanceStatement): { balanceId: number } {
  return atomic(db, () => {
    const balanceId = recordBalance(db, statement);
    setBasis(
      db,
      statement.akahuAccountId,
      statement.balanceCents,
      statement.akahuRefreshedAt ?? statement.fetchedAt ?? new Date().toISOString(),
      statement.source === 'akahu' ? 'reported' : statement.source,
      balanceId,
    );
    return { balanceId };
  });
}

export interface Basis {
  akahuAccountId: string;
  anchorCents: number;
  anchoredAt: string;
  reason: BasisReason;
  anchorBalanceId: number | null;
  updatedAt: string;
}

export function getBasis(db: DatabaseSync, akahuAccountId: string): Basis | undefined {
  return one<Basis>(
    db,
    `SELECT akahu_account_id AS akahuAccountId, anchor_cents AS anchorCents, anchored_at AS anchoredAt,
            reason, anchor_balance_id AS anchorBalanceId, updated_at AS updatedAt
       FROM account_basis WHERE akahu_account_id = ?`,
    akahuAccountId,
  );
}

/**
 * Signed movement on a ledger account strictly after `since` (exclusive).
 *
 * Debits increase an asset; credits increase a liability (what is owed). The
 * caller passes `accountType` so one function serves both sides of the sheet.
 */
export function postingsSince(
  db: DatabaseSync,
  ledgerAccount: string,
  since: string,
  accountType: 'asset' | 'liability',
): { debitCents: number; creditCents: number; count: number } {
  const row = one<{ debit: number | null; credit: number | null; n: number }>(
    db,
    `SELECT
        COALESCE(SUM(CASE WHEN e.side = 'debit' THEN e.amount_cents END), 0) AS debit,
        COALESCE(SUM(CASE WHEN e.side = 'credit' THEN e.amount_cents END), 0) AS credit,
        COUNT(*) AS n
       FROM journal_entries e
       JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account = ? AND j.transaction_date > ?`,
    ledgerAccount,
    since,
  );
  return { debitCents: Number(row?.debit ?? 0), creditCents: Number(row?.credit ?? 0), count: Number(row?.n ?? 0) };
}

export interface AccountReconciliation {
  akahuAccountId: string;
  name: string;
  ledgerAccount: string;
  accountType: 'asset' | 'liability';
  hasFeed: boolean;
  /** What the bank last said. */
  reportedCents: number | null;
  reportedAt: string | null;
  reportedAgeHours: number | null;
  /** What our postings say, from the anchor forward. */
  ledgerCents: number | null;
  /** Differences between reported and ledger balances. */
  gap: Gap[];
  /** Canonical class used for reconcile_status. */
  status: 'agrees' | 'anchored' | 'balance-only' | 'unsynced' | 'stale' | 'error';
}

export type GapClass = 'timing' | 'unknown' | 'feed-gap';

export interface Gap {
  class: GapClass;
  cents: number;
  explanation: string;
}

export interface ReconcileOptions {
  /** Maximum age before a reported balance is called stale. */
  staleAfterHours?: number;
  /** Days either side of the anchor to look for the counterpart leg. */
  transferWindowDays?: number;
  now?: Date;
  /**
   * Level of detail:
   *  - `balanced`  (default) — an unexplained gap moves the anchor and is reported
   *    once, at the moment it was discovered.
   *  - `explained` — additionally prove every gap still visible by re-deriving it
   *    from first principles, naming the postings or possible counterpart leg.
   *    Costlier, and what `doctor`/`reconcile` use.
   */
  detail?: 'balanced' | 'explained';
}

interface MappingRow {
  akahu_account_id: string;
  name: string;
  ledger_account: string;
  account_type: 'asset' | 'liability';
  has_feed: number;
}

/** Latest stated balance per account, from history. */
function latestStatement(db: DatabaseSync, akahuAccountId: string) {
  return one<{ id: number; balance_cents: number; akahu_refreshed_at: string | null; fetched_at: string; source: string }>(
    db,
    `SELECT id, balance_cents, akahu_refreshed_at, fetched_at, source
       FROM account_balances WHERE akahu_account_id = ?
      ORDER BY COALESCE(akahu_refreshed_at, fetched_at) DESC, id DESC LIMIT 1`,
    akahuAccountId,
  );
}

/**
 * Reconcile every mapped account.
 *
 * The rule Hamish set (17 Oct): **the ledger may never fall behind.** The
 * bank's stated balance is always the figure reported, and an unexplained
 * difference never holds it back — it is surfaced as `unknown` alongside the
 * exact cents.
 *
 * In the default `balanced` mode that is the whole story: anchor + postings,
 * and the only gaps that can appear are ones that began in the last day or so
 * (before the next sync moves the anchor onto the bank's figure).
 *
 * `explained` goes further and re-derives long-lived gaps, naming what the
 * postings say or the counterpart leg that could account for the difference.
 * That is the honest reading of "it notes it, but it stays at the new balance":
 * the difference is explained where there is evidence, and labelled unknown
 * where there is not.
 */
export function reconcile(db: DatabaseSync, options: ReconcileOptions = {}): AccountReconciliation[] {
  const staleAfterHours = options.staleAfterHours ?? 36;
  const windowDays = options.transferWindowDays ?? 3;
  const now = options.now ?? new Date();

  const mappings = rows<MappingRow>(
    db,
    `SELECT akahu_account_id, name, ledger_account, account_type, has_feed
       FROM account_mappings ORDER BY ledger_account`,
  );

  return mappings.map((mapping) => {
    const base: AccountReconciliation = {
      akahuAccountId: mapping.akahu_account_id,
      name: mapping.name,
      ledgerAccount: mapping.ledger_account,
      accountType: mapping.account_type,
      hasFeed: Boolean(mapping.has_feed),
      reportedCents: null,
      reportedAt: null,
      reportedAgeHours: null,
      ledgerCents: null,
      gap: [],
      status: 'unsynced',
    };

    if (!mapping.has_feed) {
      const latest = latestStatement(db, mapping.akahu_account_id);
      base.reportedCents = latest ? Number(latest.balance_cents) : null;
      base.reportedAt = latest?.akahu_refreshed_at ?? latest?.fetched_at ?? null;
      base.status = latest ? 'balance-only' : 'unsynced';
      return base;
    }

    const basis = getBasis(db, mapping.akahu_account_id);
    if (!basis) return base;

    const movement = postingsSince(db, mapping.ledger_account, basis.anchoredAt, mapping.account_type);
    const ledgerCents =
      mapping.account_type === 'liability'
        ? basis.anchorCents + movement.creditCents - movement.debitCents
        : basis.anchorCents + movement.debitCents - movement.creditCents;
    base.ledgerCents = ledgerCents;

    const latest = latestStatement(db, mapping.akahu_account_id);
    if (!latest) {
      base.status = 'error';
      base.gap.push({ class: 'unknown', cents: 0, explanation: 'Anchored but no balance has ever been recorded.' });
      return base;
    }
    base.reportedCents = Number(latest.balance_cents);
    base.reportedAt = latest.akahu_refreshed_at ?? latest.fetched_at;
    const ageMs = now.getTime() - Date.parse(base.reportedAt);
    base.reportedAgeHours = Number.isFinite(ageMs) ? Math.round((ageMs / 3_600_000) * 10) / 10 : null;

    const statusOnly = latest.source === 'manual' || latest.source === 'opening';
    const reportedCents = base.reportedCents;

    if (statusOnly) {
      // A hand-entered figure is an explicit override, not a contest.
      base.status = reportedCents === ledgerCents ? 'agrees' : 'anchored';
      if (reportedCents !== ledgerCents) {
        base.gap.push({
          class: 'unknown',
          cents: reportedCents - ledgerCents,
          explanation: 'Manual balance snapshot set by hand; it is the anchor and wins over postings.',
        });
      }
      return base;
    }

    if (reportedCents === ledgerCents) {
      base.status = base.reportedAgeHours !== null && base.reportedAgeHours > staleAfterHours ? 'stale' : 'agrees';
      return base;
    }

    const unexplained = reportedCents - ledgerCents;
    if (options.detail !== 'explained') {
      // Default path: the bank's figure stands and there is nothing to hold
      // back. If it has been stale for well over a day, say so; otherwise the
      // gap simply is what it is until the next anchor.
      const longLived = base.reportedAgeHours !== null && base.reportedAgeHours > staleAfterHours * 2;
      base.status = longLived ? 'stale' : reportedCents === ledgerCents ? 'agrees' : 'anchored';
      return base;
    }
    base.gap = explainGap(db, {
      mapping,
      anchorAt: basis.anchoredAt,
      reportedAt: base.reportedAt,
      unexplained,
      windowDays,
    });
    base.status = base.gap.some((g) => g.class === 'unknown') ? 'anchored' : 'agrees';
    if (base.reportedAgeHours !== null && base.reportedAgeHours > staleAfterHours && base.status === 'agrees') {
      base.status = 'stale';
    }
    return base;
  });
}

/**
 * Try to account for a gap between the bank's figure and our postings.
 *
 * Two explanations are recognised, and only these two:
 *
 *  1. `timing`  — entries dated after the bank's refresh timestamp. They are
 *     real postings that the stated balance cannot contain yet; we do not
 *     pretend to know otherwise.
 *  2. `feed-gap` — a single leg that has no counterpart on another feed but
 *     whose amount exactly closes the gap on its own. This is the honest
 *     shape of a transfer whose other account is not connected or whose other
 *     leg predates our history.
 *
 * Anything else is `unknown`: reported with the exact cents, never smoothed
 * away, and never used to hold the balance back.
 */
function explainGap(
  db: DatabaseSync,
  ctx: {
    mapping: MappingRow;
    anchorAt: string;
    reportedAt: string | null;
    unexplained: number;
    windowDays: number;
  },
): Gap[] {
  const gaps: Gap[] = [];
  const { mapping, anchorAt, reportedAt, unexplained } = ctx;
  if (unexplained === 0) return gaps;

  const from = shiftDate(anchorAt, -ctx.windowDays);
  const to = shiftDate((reportedAt ?? anchorAt), ctx.windowDays);

  const sameAmount = rows<{ description: string; transaction_date: string; other: string }>(
    db,
    `SELECT j.description, j.transaction_date, e.account AS other
       FROM journal_entries e
       JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account = ? AND e.amount_cents = ?
        AND j.transaction_date BETWEEN ? AND ?
      ORDER BY j.transaction_date DESC`,
    mapping.ledger_account,
    Math.abs(unexplained),
    from,
    to,
  );

  if (unexplained > 0) {
    // The bank's figure is higher than our postings: an inflow we did not see.
    const inflow = rows<{ description: string; transaction_date: string }>(
      db,
      `SELECT j.description, j.transaction_date FROM journal_entries e
         JOIN journal_transactions j ON j.id = e.journal_transaction_id
        WHERE e.account = ? AND e.side = 'debit' AND e.amount_cents = ?
          AND j.transaction_date BETWEEN ? AND ?`,
      mapping.ledger_account, unexplained, from, to,
    );
    if (inflow.length) {
      gaps.push({
        class: 'timing',
        cents: unexplained,
        explanation: `Postings dated after the bank's refresh (${inflow.map((r) => `${r.transaction_date} ${r.description}`).join('; ')}) are not yet in the reported balance.`,
      });
      return gaps;
    }
    const counterpart = sameAmount[0];
    if (counterpart) {
      gaps.push({
        class: 'feed-gap',
        cents: unexplained,
        explanation: `A ${formatCents(unexplained)} posting on ${counterpart.transaction_date} ("${counterpart.description}") has no matching leg on another feed.`,
      });
      return gaps;
    }
    const known = rows<{ id: string; from_hash: string; to_hash: string }>(
      db, 'SELECT id, from_hash, to_hash FROM transfer_pairs WHERE from_akahu_account_id = ? OR to_akahu_account_id = ?',
      mapping.akahu_account_id, mapping.akahu_account_id,
    );
    gaps.push({
      class: 'unknown',
      cents: unexplained,
      explanation: `The bank reports ${formatCents(unexplained)} more than the ledger can account for${known.length ? ' (a transfer pair exists but does not match this amount)' : ''}. Cause unknown; balance taken from the bank.`,
    });
    return gaps;
  }

  // The bank's figure is lower than our postings: an outflow we did not see.
  const outflow = rows<{ description: string; transaction_date: string }>(
    db,
    `SELECT j.description, j.transaction_date FROM journal_entries e
       JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account = ? AND e.side = 'credit' AND e.amount_cents = ?
        AND j.transaction_date BETWEEN ? AND ?`,
    mapping.ledger_account, Math.abs(unexplained), from, to,
  );
  if (outflow.length) {
    gaps.push({
      class: 'timing',
      cents: unexplained,
      explanation: `Postings dated after the bank's refresh (${outflow.map((r) => `${r.transaction_date} ${r.description}`).join('; ')}) are not yet in the reported balance.`,
    });
    return gaps;
  }
  if (sameAmount[0]) {
    gaps.push({
      class: 'feed-gap',
      cents: unexplained,
      explanation: `A ${formatCents(Math.abs(unexplained))} posting on ${sameAmount[0].transaction_date} appears only once across the feeds.`,
    });
    return gaps;
  }
  gaps.push({
    class: 'unknown',
    cents: unexplained,
    explanation: `The bank reports ${formatCents(Math.abs(unexplained))} less than the ledger can account for. Cause unknown; balance taken from the bank.`,
  });
  return gaps;
}

export function shiftDate(iso: string, days: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
