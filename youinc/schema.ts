import type { DatabaseSync } from 'node:sqlite';

/**
 * Schema for the agent-first ledger. Version 2.
 *
 * v1 was YouInc's dashboard schema. v2 adds the one thing the dashboard never
 * had: the bank's own reported balance as a first-class stored fact, so a
 * balance never has to be derived from transactions alone.
 *
 *   ledger_balance(account) = anchor_cents + sum(postings after anchored_at)
 *
 * where `anchor_cents` is the last balance the bank reported. Every stated
 * balance is recorded in account_balances (history, never overwritten) and
 * account_basis records which one is in force. That is what keeps the ledger
 * reconciled rather than drifting when a feed has a gap.
 */
export const SCHEMA_VERSION = 2;

const V2 = `
BEGIN IMMEDIATE;
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
INSERT INTO settings VALUES
  ('name','My money'), ('currency','NZD'), ('suspense','Expenses:Uncategorized:Suspense');

CREATE TABLE journal_transactions (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  transaction_date TEXT NOT NULL,
  description TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  status TEXT NOT NULL,
  rule_id TEXT
) STRICT;

CREATE TABLE journal_entries (
  id INTEGER PRIMARY KEY,
  journal_transaction_id TEXT NOT NULL REFERENCES journal_transactions(id),
  account TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('debit','credit')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0 AND amount_cents <= 9007199254740991),
  currency TEXT NOT NULL
) STRICT;
CREATE INDEX journal_entries_parent ON journal_entries(journal_transaction_id);
CREATE INDEX journal_entries_account ON journal_entries(account);

CREATE TABLE raw_transactions (
  idempotency_hash TEXT PRIMARY KEY,
  transaction_date TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  processed_at TEXT,
  skipped_reason TEXT
) STRICT;

CREATE TABLE classification_rules (
  id TEXT PRIMARY KEY, rule_key TEXT NOT NULL UNIQUE, seq INTEGER NOT NULL UNIQUE,
  priority INTEGER NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0,1)),
  match_description_regex TEXT, match_merchant_regex TEXT,
  match_amount_greater_than REAL, match_amount_abs_greater_than REAL,
  route_target_account TEXT NOT NULL, route_memo TEXT
) STRICT;

-- Metadata is Akahu's; ledger_account is ours. has_feed records whether Akahu
-- exposes transactions for the account at all (Sharesies Growth et al. do not),
-- because a balance-only account must never be "reconciled" against a feed that
-- does not exist.
CREATE TABLE account_mappings (
  id TEXT PRIMARY KEY,
  akahu_account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  ledger_account TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK(account_type IN ('asset','liability')),
  has_feed INTEGER NOT NULL DEFAULT 1 CHECK(has_feed IN (0,1)),
  connection TEXT,
  connection_id TEXT,
  -- 1 when any account in the same authorisation has a transaction feed.
  -- A pair proposed between two accounts of a feed-less institution (Sharesies
  -- Growth ↔ Emergencies) is invisible on both sides and must not be trusted.
  connection_has_feed INTEGER NOT NULL DEFAULT 1,
  formatted_account TEXT,
  credit_limit_cents INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;

-- Append-only history of what the bank said the balance was. Never mutated:
-- a later statement is a new row, so the reconciliation trail survives.
CREATE TABLE account_balances (
  id INTEGER PRIMARY KEY,
  akahu_account_id TEXT NOT NULL,
  balance_cents INTEGER NOT NULL,
  available_cents INTEGER,
  credit_limit_cents INTEGER,
  currency TEXT NOT NULL,
  overdrawn INTEGER,
  akahu_refreshed_at TEXT,
  fetched_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('akahu','manual','opening')),
  raw_json TEXT
) STRICT;
CREATE INDEX account_balances_lookup ON account_balances(akahu_account_id, fetched_at);

-- The anchor currently in force for each account, and why it moved.
CREATE TABLE account_basis (
  akahu_account_id TEXT PRIMARY KEY,
  anchor_cents INTEGER NOT NULL,
  anchored_at TEXT NOT NULL,
  anchor_balance_id INTEGER REFERENCES account_balances(id),
  reason TEXT NOT NULL CHECK(reason IN ('reported','opening','manual')),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE akahu_sync_log (
  id TEXT PRIMARY KEY, akahu_account_id TEXT NOT NULL, started_at TEXT NOT NULL,
  finished_at TEXT, from_date TEXT, to_date TEXT, transactions_ingested INTEGER,
  status TEXT NOT NULL, error_message TEXT
) STRICT;

-- Transfers between his own accounts: one transaction on each feed. The
-- pair is recorded once; the second sighting links to the same pair so the
-- postings never double-count.
CREATE TABLE transfer_pairs (
  id TEXT PRIMARY KEY,
  from_akahu_account_id TEXT NOT NULL,
  to_akahu_account_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  transfer_date TEXT NOT NULL,
  from_hash TEXT NOT NULL,
  to_hash TEXT NOT NULL,
  journal_id TEXT REFERENCES journal_transactions(id),
  created_at TEXT NOT NULL,
  UNIQUE(from_hash), UNIQUE(to_hash)
) STRICT;

PRAGMA user_version = ${SCHEMA_VERSION};
COMMIT;
`;

export function migrate(db: DatabaseSync): number {
  const current = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  if (current > SCHEMA_VERSION) {
    throw new Error(`This ledger needs a newer YouInc (schema v${current} > v${SCHEMA_VERSION}).`);
  }
  if (current < 2) {
    // v1 databases are the old dashboard's. Nothing depended on them, and the
    // ledger now requires balance anchors that v1 never stored, so a v1 file is
    // archived by the caller rather than migrated in place.
    if (current === 1) throw new Error('Schema v1 ledger found; it predates balance anchoring. Move it aside and sync fresh.');
    try {
      db.exec(V2);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
}
