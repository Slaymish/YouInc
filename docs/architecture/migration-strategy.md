# Migration Strategy — SQLite → Supabase (Phase 0)

Scope: move the existing single-owner install (three local SQLite DBs +
`config/rules.yaml` + `.env` Akahu tokens) into **one** Supabase tenant, on the
shared-schema + RLS model defined in `schema.sql` / `rls-policies.sql`. No app
code changes in this phase — this documents the plan the migration script will
implement later.

Source data on disk (`./data/`):

- `youinc-ledger.sqlite3` — the 6 ledger tables (~170 raw txns, ~173 journal txns, 2 sync_state rows).
- `youinc-leads.sqlite3` — waitlist `leads`.
- `youinc-auth.sqlite3` — hand-rolled WebAuthn (`credentials`, `sessions`, `challenges`).

## Key decision: auth is NOT a data backfill

- The `youinc-auth` DB holds RP-bound WebAuthn public keys. These **cannot** be
  imported into Supabase Auth — Supabase owns its own credential store and
  passkeys are relying-party bound. `sessions`/`challenges` are ephemeral.
- Therefore **decouple** tenant/ledger migration from user signup:
  1. Create the tenant + backfill all ledger rows to its `tenant_id`
     **independently** of any user (ledger rows key on `tenant_id`, not `user_id`).
  2. The owner **re-enrolls fresh** via Supabase Auth (passkey + magic-link).
  3. After signup, link the new `auth.users.id` → `profiles` row → an `owner`
     membership (`role='owner'`) → the existing tenant (whose `tier` was set
     at tenant creation).
- This means the migration script can run and be validated before the owner
  ever signs in.

## Migration steps (ordered)

1. **Provision Supabase project**; apply `schema.sql` then `rls-policies.sql`.
2. **Create the owner tenant**: one `tenants` row (name "You Inc.",
   `default_currency='NZD'`, `suspense_account` from `rules.yaml` defaults).
   Capture its `id` as `:TENANT`.
3. **Port `rules.yaml` → rows** (all scoped to `:TENANT`):
   - `defaults` → `tenants.default_currency` + `tenants.suspense_account` (step 2).
   - `account_mappings` → `account_mappings` rows (akahu id, ledger_account,
     account_type, optional credit_limit_cents).
   - `nzfcc_mappings` → `nzfcc_mappings` rows.
   - `rules` → `classification_rules`, **capturing insertion order as `seq`**
     (0,1,2,… in YAML order) so the `(priority, seq)` sort reproduces the
     Python router's `(priority, enumeration_index)` tiebreak exactly. Map
     `match.description_regex/merchant_regex/account_ids/amount_greater_than/
     amount_abs_greater_than` and `route.target_account/memo`.
4. **Backfill ledger tables** (all get `tenant_id = :TENANT`):
   `raw_transactions`, `journal_transactions`, `journal_entries` (denormalize
   `tenant_id` onto entries, matching parent), `sync_state`,
   `manual_classifications`, `manual_account_balances`. Copy
   `idempotency_hash` / `external_id` / `akahu_transaction_id` **verbatim** — do
   not recompute (see parity note). Convert SQLite `TEXT` ISO dates → `date`/
   `timestamptz`, `raw_json` TEXT → `jsonb`, integer epoch timestamps
   (leads/auth) → `timestamptz`. Note: `jsonb` reorders keys / strips whitespace,
   so it is NOT byte-identical to the source text — that is fine here because the
   idempotency hash never hashes `raw_json` (it hashes `akahu:{id}` or the
   pipe-joined raw fields). If literal fidelity to the engine's `stable_json`
   output is ever wanted, store `raw_json` as `text` instead.
5. **Move Akahu tokens → Vault**: read `AKAHU_USER_TOKEN` / `AKAHU_APP_TOKEN`
   from `.env`, write each as a `vault.secrets` entry, store the returned secret
   ids in an `akahu_connections` row (`tenant_id=:TENANT`, `user_id` set once the
   owner signs up). Never write the raw token into a business table. Then scrub
   the tokens from `.env` and rotate them.
6. **Port leads**: copy `youinc-leads` rows into `leads` (map `interest` →
   the checked `self-serve|concierge` values; `tenant_id`/`user_id` left null).
7. **Owner link (post-signup)**: create `profiles` + `owner` `memberships` row
   → `:TENANT`; set `akahu_connections.user_id`.

## Idempotency / re-runnability / rollback

- The script must be **re-runnable**: use deterministic upserts keyed on the
  natural keys — `ON CONFLICT (tenant_id, idempotency_hash)`,
  `(tenant_id, external_id)`, `(tenant_id, key)`, `(tenant_id, rule_key)`, etc.
  Re-running must converge, not duplicate.
- Make tenant creation idempotent via a fixed `slug` (`ON CONFLICT (slug)`), so
  the whole run keys off one stable `:TENANT`.
- **Rollback** = drop/truncate by `tenant_id` (single-tenant blast radius). Keep
  the original SQLite files untouched as the source of truth until parity is
  verified; the migration only reads them.
- **Verification gate**: after backfill, assert row counts match source, and run
  the ledger's balance/income-statement aggregates against both SQLite and
  Postgres — they must be identical before declaring success.

## Ordering vs the phase plan

- Phase 0 (this): schema + RLS + migration design only. No migration executed.
- The migration script itself runs at the start of the port phase, **before**
  the TS engine is trusted for writes, so parity can be checked against the
  frozen SQLite snapshot. Rules/mappings backfill (step 3) must precede any
  re-classification, and ledger backfill (step 4) must precede first live sync.

## Open questions / risks for the port

- **`idempotency_hash` parity (future ingestion, not the backfill).** The
  backfill copies stored hashes verbatim, so parity only bites when the TS
  engine ingests *new* Akahu txns. The hash input is subtle and must byte-match:
  `sha256("akahu:{id}")` when an Akahu id exists, else `sha256` of the
  pipe-joined `account_id|date[:10]|str(raw["amount"])|description|merchant`.
  It uses the **raw amount string** (`str(raw["amount"])`), **not** `amount_cents`,
  and `raw_json` is `stable_json` = `json.dumps(sort_keys=True,
  separators=(",",":"), ensure_ascii=False)`. **Recommended acceptance gate: a
  cross-language golden test** — feed identical Akahu payloads to Python and TS,
  assert identical `idempotency_hash` and identical stored `raw_json` bytes.
- **`sync_state` cursor semantics change per tenant.** Keys were global
  (`last_sync:{account_id}`); they become `(tenant_id, key)`. The sync loop must
  scope cursor reads/writes by tenant so one tenant's sync never advances
  another's cursor. Confirm no code assumes a single global cursor namespace.
- **`external_id` ↔ `idempotency_hash` linkage** is a logical (un-FK'd) join in
  the source; preserved as such. The port must keep using
  `journal_transactions.external_id = raw_transactions.idempotency_hash`.
- **Money/threshold types:** ledger amounts are integer cents (`bigint`); rule
  thresholds are decimals (`numeric`). The TS port must not conflate the two
  (thresholds compare against dollar amounts, not cents).
- **Decimal rounding parity:** Python uses `ROUND_HALF_UP` at 2dp for
  `decimal_to_cents`. The TS port must match this rounding mode exactly.
- **Tier placement (decided):** `tier` is a tenant-level billing/plan attribute,
  stored on `tenants`, not on individual `memberships`. All members of a tenant
  operate at the same tier. Middleware tier gating reads `tenants.tier`.

## Supabase specifics

- **SDK pin:** `@supabase/supabase-js` **v2.105.0+** for the native passkeys
  beta. Pin exactly and revisit as the beta moves. (Verify the exact minimum
  against current release notes before locking — passkey APIs are in flux.)
- **RP (relying-party) config** for WebAuthn/passkeys lives in Supabase Auth
  project settings (RP id / origin), **not** in app DB. Local dev vs prod
  origins must be registered there.
- **Vault usage pattern:** store secrets via `vault.create_secret(secret, name)`
  (or the dashboard/Management API); read back via the `vault.decrypted_secrets`
  view or the decrypt function — **server-side / service_role only**. Business
  tables store only the secret's uuid (see `akahu_connections.*_secret_id`).
  UNCERTAINTY FLAG: exact Vault function signatures and the decrypted-secrets
  access path are Supabase-version-specific — confirm against current docs.
- **Auth Hook custom claims (BETA — verify):** the active-tenant JWT claim is
  set by a custom access-token Auth Hook and must live in `app_metadata` (never
  `user_metadata`). Registration and payload shape are version-specific; do not
  treat the sketch in `rls-policies.sql` §5/§7 as final.
