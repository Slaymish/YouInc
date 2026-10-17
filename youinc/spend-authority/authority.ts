import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Standing spending authority — the limits, not the payment rail.
 *
 * This module decides whether a purchase may proceed; it never touches a card
 * and never holds a credential. The funding card lives wherever the merchant
 * checkout or a browser vault keeps it.
 *
 * Design rules, in order of importance (Hamish, 17 Oct 2026):
 *
 *  1. No self-service increases. A limit only moves because he moved it. This
 *     module can read a policy file; it cannot raise one.
 *  2. The monthly sum is checked, not just the individual purchase. One bad
 *     purchase is a limit; twenty small ones are an exploit.
 *  3. Hard stops are code, not prose: no gambling/crypto/cash advances, no
 *     allowlist escape without a human, no purchases implying a commitment.
 *  4. Every purchase is recorded *before* the outcome is known, so a crash
 *     mid-purchase can never make money disappear from the record.
 *  5. An intent is idempotent on (at, purpose) so a retried run cannot
 *     double-buy.
 */

export type SpendMode = 'notify' | 'unattended';

export interface SpendPolicy {
  /** 0 means notify-only: nothing may be bought unattended. */
  perPurchaseLimitCents: number;
  perCallLimitCents: number;
  monthlyLimitCents: number;
  /** Purchases at or above this need a human even when under the limits. */
  requireApprovalAboveCents: number;
  mode: SpendMode;
  currency: string;
  /** Ledger-style category paths, e.g. `Software`. Empty means nothing is allowed. */
  allowlist: string[];
  /** Merchants that are always refused. */
  denylist: string[];
  /** Spend in these categories is refused outright. */
  hardBlocked: string[];
}

export const HARD_BLOCKED_CATEGORIES = ['Gambling', 'Crypto', 'CashAdvance', 'Loans', 'Insurance', 'Investments'];

export interface PurchaseRequest {
  purpose: string;
  merchant: string;
  amountCents: number;
  category: string;
  /** ISO timestamp of the purchase attempt. */
  at: string;
  /**
   * Set when this purchase would create an ongoing commitment (subscription,
   * contract, credit). Never unattended.
   */
  createsCommitment?: boolean;
}

export type Decision = 'allow' | 'needs_approval' | 'blocked';

export interface DecisionResult {
  decision: Decision;
  reason: string;
  /** Money already spent this calendar month in the policy currency. */
  spentThisMonthCents: number;
}

export function loadPolicy(path: string): SpendPolicy {
  const raw = readFileSync(path, 'utf8');
  return parsePolicy(raw);
}

/** Minimal YAML subset: `key: value`, lists as `- item`. Enough for one file. */
export function parsePolicy(text: string): SpendPolicy {
  const values: Record<string, unknown> = {};
  let currentList: string[] | null = null;
  for (const line of text.split('\n')) {
    const bare = line.replace(/#.*$/, '').trimEnd();
    if (!bare.trim()) continue;
    const item = /^\s+-\s?(.*)$/.exec(bare);
    if (item && currentList) {
      currentList.push(unquote(item[1]));
      continue;
    }
    const pair = /^([a-z_]+):\s*(.*)$/.exec(bare.trim());
    if (!pair) continue;
    const [, key, rest] = pair;
    if (rest === '') {
      currentList = [];
      values[key] = currentList;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      currentList = null;
      values[key] = rest.slice(1, -1).split(',').map((v) => unquote(v.trim())).filter(Boolean);
    } else {
      currentList = null;
      values[key] = unquote(rest);
    }
  }

  const money = (key: string, fallback: number): number => {
    const value = values[key];
    if (value === undefined || value === '') return fallback;
    return toCents(String(value));
  };
  const boolList = (key: string): string[] => (Array.isArray(values[key]) ? (values[key] as string[]) : []);
  const mode = String(values.mode ?? 'notify').trim();

  const policy: SpendPolicy = {
    perPurchaseLimitCents: money('per_purchase_limit', 0),
    perCallLimitCents: money('per_call_limit', 0),
    monthlyLimitCents: money('monthly_limit', 0),
    requireApprovalAboveCents: money('require_approval_above', 0),
    mode: mode === 'unattended' ? 'unattended' : 'notify',
    currency: String(values.currency ?? 'NZD').toUpperCase(),
    allowlist: boolList('allowlist'),
    denylist: boolList('denylist'),
    hardBlocked: [...HARD_BLOCKED_CATEGORIES, ...boolList('hard_blocked')],
  };
  if (policy.mode === 'unattended' && policy.perPurchaseLimitCents <= 0) {
    throw new Error('policy says unattended but per_purchase_limit is 0; set a limit or use notify');
  }
  if (policy.mode === 'unattended' && policy.allowlist.length === 0) {
    throw new Error('policy says unattended with an empty allowlist; that is an unbounded card, refuse it');
  }
  return policy;
}

/** Decimal dollars to integer cents, ties away from zero (matches the ledger). */
export function toCents(value: string | number): number {
  let s = String(value).trim();
  if (!s) return 0;
  const negative = s.startsWith('-');
  if (negative || s.startsWith('+')) s = s.slice(1);
  const [intPart = '0', fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '000').slice(0, 3);
  let cents = parseInt(intPart || '0', 10) * 100 + parseInt(frac.slice(0, 2), 10);
  if (parseInt(frac[2], 10) >= 5) cents += 1;
  return negative ? -cents : cents;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Whether `category` is inside an allowlist entry (`Software` covers `Software:Subscriptions`). */
export function categoryAllowed(allowlist: readonly string[], category: string): boolean {
  return allowlist.some((allowed) => category === allowed || category.startsWith(`${allowed}:`));
}

function normaliseMerchant(merchant: string): string {
  return merchant.trim().toLowerCase();
}

/**
 * Decide one purchase.
 *
 * Order matters: credentials, hard blocks and mode before limits, so the reason
 * returned is the most fundamental refusal rather than an incidental one.
 */
export function decide(
  policy: SpendPolicy,
  request: PurchaseRequest,
  spentThisMonthCents: number,
): DecisionResult {
  const money = { spentThisMonthCents };
  const blocked = (reason: string): DecisionResult => ({ decision: 'blocked', reason, ...money });

  if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) {
    return blocked('Amount must be a positive whole number of cents.');
  }
  if (request.createsCommitment) {
    return blocked('Purchases that create an ongoing commitment need a human, even under the limit.');
  }
  if (policy.hardBlocked.some((c) => categoryAllowed([c], request.category))) {
    return blocked(`Category ${request.category} is hard-blocked.`);
  }
  if (policy.denylist.map(normaliseMerchant).includes(normaliseMerchant(request.merchant))) {
    return blocked(`Merchant ${request.merchant} is on the denylist.`);
  }
  if (policy.mode === 'notify') {
    return blocked('Spending is in notify mode: nothing may be bought unattended.');
  }
  if (!categoryAllowed(policy.allowlist, request.category)) {
    return blocked(`Category ${request.category} is outside the allowlist (${policy.allowlist.join(', ') || 'empty'}).`);
  }

  const remaining = policy.monthlyLimitCents - spentThisMonthCents;
  if (request.amountCents > remaining) {
    return blocked(
      `Would exceed the monthly limit: ${formatCents(request.amountCents)} against ${formatCents(Math.max(remaining, 0))} remaining of ${formatCents(policy.monthlyLimitCents)}.`,
    );
  }
  if (request.amountCents > policy.perPurchaseLimitCents) {
    return blocked(
      `Above the per-purchase limit (${formatCents(policy.perPurchaseLimitCents)}); needs a human.`,
    );
  }
  if (request.amountCents > policy.perCallLimitCents) {
    return blocked(`Above the per-call limit (${formatCents(policy.perCallLimitCents)}); needs a human.`);
  }
  if (policy.requireApprovalAboveCents > 0 && request.amountCents >= policy.requireApprovalAboveCents) {
    return { decision: 'needs_approval', reason: `At or above the approval threshold (${formatCents(policy.requireApprovalAboveCents)}).`, ...money };
  }
  return { decision: 'allow', reason: 'Within the standing authority.', ...money };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Purchase ledger: append-only intents, then outcomes.

export interface Intent {
  id: string;
  at: string;
  purpose: string;
  merchant: string;
  amountCents: number;
  category: string;
  decision: Decision;
  reason: string;
  currency: string;
}

export interface Outcome {
  intentId: string;
  status: 'succeeded' | 'failed' | 'abandoned';
  externalRef: string | null;
  at: string;
  note: string | null;
}

export class PurchaseLedger {
  readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY, at TEXT NOT NULL, purpose TEXT NOT NULL, merchant TEXT NOT NULL,
        amount_cents INTEGER NOT NULL, category TEXT NOT NULL, decision TEXT NOT NULL,
        reason TEXT NOT NULL, currency TEXT NOT NULL, UNIQUE(at, purpose)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS outcomes (
        intent_id TEXT PRIMARY KEY REFERENCES intents(id), status TEXT NOT NULL,
        external_ref TEXT, at TEXT NOT NULL, note TEXT
      ) STRICT;
      CREATE INDEX IF NOT EXISTS intents_at ON intents(at);
    `);
  }

  close() { this.db.close(); }

  /**
   * Record the intent before any money moves. Idempotent on (at, purpose): a
   * retried run returns the existing id instead of a second purchase.
   */
  recordIntent(intent: Intent): { id: string; existing: boolean } {
    const existing = this.db.prepare('SELECT id FROM intents WHERE at = ? AND purpose = ?').get(intent.at, intent.purpose) as { id: string } | undefined;
    if (existing) return { id: existing.id, existing: true };
    this.db.prepare(
      `INSERT INTO intents (id, at, purpose, merchant, amount_cents, category, decision, reason, currency)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(intent.id, intent.at, intent.purpose, intent.merchant, intent.amountCents, intent.category, intent.decision, intent.reason, intent.currency);
    return { id: intent.id, existing: false };
  }

  recordOutcome(outcome: Outcome): void {
    this.db.prepare(
      `INSERT INTO outcomes (intent_id, status, external_ref, at, note) VALUES (?,?,?,?,?)
       ON CONFLICT(intent_id) DO UPDATE SET status = excluded.status, external_ref = excluded.external_ref,
         at = excluded.at, note = excluded.note`,
    ).run(outcome.intentId, outcome.status, outcome.externalRef, outcome.at, outcome.note);
  }

  /**
   * Money committed this calendar month. `succeeded` counts, `failed` does not,
   * and an intent with no outcome yet still counts: money that might be in
   * flight must never be spendable twice.
   */
  spentThisMonthCents(monthPrefix: string): number {
    const row = this.db.prepare(
      `SELECT COALESCE(SUM(i.amount_cents), 0) AS cents
         FROM intents i LEFT JOIN outcomes o ON o.intent_id = i.id
        WHERE i.decision = 'allow' AND substr(i.at, 1, 7) = ?
          AND (o.status IS NULL OR o.status = 'succeeded')`,
    ).get(monthPrefix) as { cents: number };
    return Number(row.cents);
  }

  /** Intent with no outcome: money possibly in flight, needs resolving. */
  unresolved(): Intent[] {
    return this.db.prepare(
      `SELECT i.* FROM intents i LEFT JOIN outcomes o ON o.intent_id = i.id
        WHERE i.decision = 'allow' AND o.status IS NULL ORDER BY i.at`,
    ).all() as unknown as Intent[];
  }

  history(limit = 50): Array<Intent & { status: string | null }> {
    return this.db.prepare(
      `SELECT i.*, o.status AS status FROM intents i LEFT JOIN outcomes o ON o.intent_id = i.id
        ORDER BY i.at DESC LIMIT ?`,
    ).all(limit) as unknown as Array<Intent & { status: string | null }>;
  }
}
