import type { DatabaseSync } from 'node:sqlite';
import { rows, one, setting } from './database.ts';
import type { RoutingConfig } from './routing.ts';
import { DEFAULT_SUSPENSE } from './routing.ts';

/**
 * DB → routing config, the same assembly the dashboard's ingestion.ts did:
 * enabled rules in priority order, account mappings by Akahu id, and NZFCC
 * category fallbacks from a small YAML file.
 *
 * Rules live in the database (editable by `youinc rule add`), not in source,
 * so a new merchant can be handled without touching code.
 */
export function loadRoutingConfig(db: DatabaseSync): RoutingConfig {
  const rules = rows<{
    rule_key: string;
    priority: number;
    match_description_regex: string | null;
    match_merchant_regex: string | null;
    match_amount_greater_than: number | null;
    match_amount_abs_greater_than: number | null;
    route_target_account: string;
    route_memo: string | null;
  }>(
    db,
    `SELECT rule_key, priority, match_description_regex, match_merchant_regex,
            match_amount_greater_than, match_amount_abs_greater_than, route_target_account, route_memo
       FROM classification_rules WHERE is_enabled = 1 ORDER BY priority, seq`,
  );

  const mappings = rows<{ akahu_account_id: string; ledger_account: string; account_type: string }>(
    db,
    'SELECT akahu_account_id, ledger_account, account_type FROM account_mappings',
  );

  return {
    suspenseAccount: setting(db, 'suspense') || DEFAULT_SUSPENSE,
    rules: rules.map((r) => ({
      id: r.rule_key,
      priority: Number(r.priority),
      match: {
        ...(r.match_description_regex ? { description_regex: r.match_description_regex } : {}),
        ...(r.match_merchant_regex ? { merchant_regex: r.match_merchant_regex } : {}),
        ...(r.match_amount_greater_than !== null ? { amount_greater_than: Number(r.match_amount_greater_than) } : {}),
        ...(r.match_amount_abs_greater_than !== null ? { amount_abs_greater_than: Number(r.match_amount_abs_greater_than) } : {}),
      },
      route: { target_account: r.route_target_account, memo: r.route_memo ?? undefined },
    })),
    nzfccMappings: nzfccMappings(db),
    accountMappings: Object.fromEntries(
      mappings.map((m) => [
        m.akahu_account_id,
        { ledgerAccount: m.ledger_account, accountType: m.account_type === 'liability' ? 'liability' : 'asset' as const },
      ]),
    ),
  };
}

/** NZFCC category → ledger account, stored as settings rows (`nzfcc.<code>`). */
export function nzfccMappings(db: DatabaseSync): Record<string, string> {
  const stored = setting(db, 'nzfcc_mappings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, string>;
      return parsed;
    } catch {
      /* fall through to per-key rows */
    }
  }
  const out: Record<string, string> = {};
  for (const row of rows<{ key: string; value: string }>(db, "SELECT key, value FROM settings WHERE key LIKE 'nzfcc.%'")) {
    out[row.key.slice('nzfcc.'.length)] = row.value;
  }
  return out;
}

export interface RuleInput {
  key: string;
  priority?: number;
  /** Aliases accepted so the flag the CLI documents (`--match-regex`) is the one that works. */
  descriptionRegex?: string | null;
  matchRegex?: string | null;
  merchantRegex?: string | null;
  amountAbsGreaterThan?: number | null;
  targetAccount: string;
  memo?: string | null;
}

/** Add or replace a rule by key. One write, keyed so a retry cannot duplicate. */
export function upsertRule(db: DatabaseSync, input: RuleInput): void {
  const descriptionRegex = input.descriptionRegex ?? input.matchRegex ?? null;
  if (!descriptionRegex && !input.merchantRegex && input.amountAbsGreaterThan == null) {
    throw new Error('A rule needs at least one match condition (--match-regex, --merchant-regex or --amount-abs-greater-than).');
  }
  if (!input.targetAccount.includes(':')) {
    throw new Error('Target account must be a ledger path like Expenses:OpEx:Utilities');
  }
  const seq = Number(one<{ seq: number }>(db, 'SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM classification_rules')?.seq ?? 0);
  db.prepare(
    `INSERT INTO classification_rules
       (id, rule_key, seq, priority, is_enabled, match_description_regex, match_merchant_regex,
        match_amount_greater_than, match_amount_abs_greater_than, route_target_account, route_memo)
     VALUES (?,?,?,?,1,?,?,NULL,?,?,?)
     ON CONFLICT(rule_key) DO UPDATE SET
       priority = excluded.priority, is_enabled = 1,
       match_description_regex = excluded.match_description_regex,
       match_merchant_regex = excluded.match_merchant_regex,
       match_amount_abs_greater_than = excluded.match_amount_abs_greater_than,
       route_target_account = excluded.route_target_account,
       route_memo = excluded.route_memo`,
  ).run(
    input.key, input.key, seq, input.priority ?? 100,
    descriptionRegex, input.merchantRegex ?? null,
    input.amountAbsGreaterThan ?? null, input.targetAccount, input.memo ?? null,
  );
}

export function disableRule(db: DatabaseSync, key: string): boolean {
  return Boolean(db.prepare('UPDATE classification_rules SET is_enabled = 0 WHERE rule_key = ?').run(key).changes);
}

export function listRules(db: DatabaseSync): RuleRow[] {
  const raw = rows<Omit<RuleRow, 'enabled'> & { enabled: number }>(
    db,
    `SELECT rule_key AS key, priority, is_enabled AS enabled, match_description_regex AS descriptionRegex,
            match_merchant_regex AS merchantRegex, match_amount_abs_greater_than AS amountAbsGreaterThan,
            route_target_account AS targetAccount, route_memo AS memo
       FROM classification_rules ORDER BY priority, seq`,
  );
  return raw.map((r): RuleRow => ({
    key: r.key,
    priority: r.priority,
    enabled: Boolean(r.enabled),
    descriptionRegex: r.descriptionRegex,
    merchantRegex: r.merchantRegex,
    amountAbsGreaterThan: r.amountAbsGreaterThan,
    targetAccount: r.targetAccount,
    memo: r.memo,
  }));
}

export interface RuleRow {
  key: string;
  priority: number;
  enabled: boolean;
  descriptionRegex: string | null;
  merchantRegex: string | null;
  amountAbsGreaterThan: number | null;
  targetAccount: string;
  memo: string | null;
}
