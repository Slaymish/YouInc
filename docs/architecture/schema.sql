-- =============================================================================
-- YouInc — Multi-tenant Postgres schema (Supabase)  |  PHASE 0 design artifact
-- =============================================================================
-- Shared-schema multi-tenancy: every business row carries `tenant_id` and is
-- isolated by Row-Level Security (see rls-policies.sql). Users live in Supabase
-- `auth.users`; app data layers on top of it via `profiles` + `memberships`.
--
-- Faithful port target: the 6 SQLite ledger tables + the global rules.yaml are
-- re-expressed here so a Python->TypeScript ledger-engine port can be verified
-- for golden parity. Money is stored as integer cents (matching the engine);
-- rule match thresholds are `numeric` because rules.yaml expresses them as
-- decimals (e.g. amount_abs_greater_than: 1000.00).
--
-- Conventions:
--   * uuid primary keys via gen_random_uuid() (pgcrypto, bundled with Supabase)
--   * timestamptz created_at/updated_at; updated_at maintained by trigger
--   * All FKs are explicit; tenant_id is the leading column on every index that
--     RLS will filter, so the planner uses it first.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- SECTION 1 — Tenancy & accounts
-- =============================================================================

-- A tenant is one "personal-finance entity" (e.g. the owner's "You Inc.").
-- Ledger rows key on tenant_id, NOT on any user, so a tenant exists
-- independently of who is signed in (important for migration — see
-- migration-strategy.md: the tenant + ledger backfill happen before the owner
-- re-enrolls in Supabase Auth).
create table public.tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  -- rules.yaml `defaults` block, promoted to first-class tenant settings.
  default_currency  text not null default 'NZD',
  suspense_account  text not null default 'Expenses:Uncategorized:Suspense',
  -- Product tier (billing/plan): self-serve vs concierge. Tenant-level attribute,
  -- applies to all members of the tenant.
  tier              text not null default 'self-serve'
                    check (tier in ('self-serve', 'concierge')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- 1:1 with auth.users. Holds display info only — credentials/email live in
-- auth.users (managed by Supabase Auth). The id IS the auth user id.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- User <-> tenant link with role.
--   role: owner has full control; admin can manage members; member is standard.
--   Product tier (self-serve vs concierge) is determined by the tenant, not per-member.
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member'
                check (role in ('owner', 'admin', 'member')),
  status      text not null default 'active'
                check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_memberships_user on public.memberships (user_id);
create index idx_memberships_tenant on public.memberships (tenant_id);
create trigger trg_memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- Invite/approval gate. An invite grants membership (role) in a specific tenant.
-- TIER IS NOT ON THE INVITE — tier is tenant-level (tenants.tier); an invitee
-- lands at the target tenant's tier. Concierge clients are invited into a tenant
-- created at tier='concierge'. Acceptance is handled by a SECURITY DEFINER RPC
-- (see accept_invite migration) because the accepting user has no membership yet.
create table public.invites (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  code           text not null unique,          -- opaque token shared with invitee
  role           text not null default 'member'
                   check (role in ('owner', 'admin', 'member')),
  invited_email  text,                           -- optional pre-binding to an address
  status         text not null default 'pending'
                   check (status in ('pending', 'accepted', 'expired')),
  invited_by     uuid references auth.users (id) on delete set null,
  accepted_by    uuid references auth.users (id) on delete set null,
  expires_at     timestamptz not null,
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_invites_tenant on public.invites (tenant_id);
create index idx_invites_status on public.invites (status);
create trigger trg_invites_updated_at
  before update on public.invites
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SECTION 2 — Akahu connections
-- =============================================================================
-- One enduring user_token + app token per connected user, stored ENCRYPTED in
-- Supabase Vault (vault.secrets). This table holds only metadata + references
-- to the Vault secret ids — never the raw token. See migration-strategy.md for
-- the Vault usage pattern.
create table public.akahu_connections (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants (id) on delete cascade,
  user_id                uuid not null references auth.users (id) on delete cascade,
  -- Akahu connection metadata (safe to store in plaintext).
  akahu_connection_id    text,       -- Akahu's identifier for the linked institution
  status                 text not null default 'active'
                           check (status in ('active', 'revoked', 'error')),
  -- References into Supabase Vault (uuid of the vault.secrets row). The secret
  -- VALUE (the token) is decryptable only by the backend via the Vault API.
  user_token_secret_id   uuid,       -- enduring per-user Akahu user_token
  app_token_secret_id    uuid,       -- Akahu app token
  connected_at           timestamptz not null default now(),
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_akahu_connections_tenant on public.akahu_connections (tenant_id);
create trigger trg_akahu_connections_updated_at
  before update on public.akahu_connections
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SECTION 3 — Ledger tables (ported from SQLite; each gains tenant_id)
-- =============================================================================
-- Uniqueness that was global in SQLite becomes composite on (tenant_id, ...) so
-- two tenants can hold the same akahu id / hash / account without collision.

-- raw_transactions — immutable-ish landing zone for Akahu payloads.
-- SQLite had global UNIQUE(idempotency_hash) and UNIQUE(akahu_transaction_id);
-- both become tenant-scoped.
create table public.raw_transactions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  akahu_transaction_id  text,
  idempotency_hash      text not null,
  account_id            text not null,          -- Akahu account id
  status                text not null,
  amount_cents          bigint not null,
  currency              text not null default 'NZD',
  transaction_date      date not null,
  settlement_date       date,
  description           text not null,
  merchant_name         text,
  nzfcc                 text,
  raw_json              jsonb not null,         -- was TEXT; jsonb here (not itself hashed — see migration-strategy.md)
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  processed_at          timestamptz,
  skipped_reason        text,
  unique (tenant_id, idempotency_hash),
  unique (tenant_id, akahu_transaction_id)
);
-- Mirrors SQLite idx_raw_transactions_account_date, tenant_id-first for RLS.
create index idx_raw_txn_tenant_account_date
  on public.raw_transactions (tenant_id, account_id, transaction_date);

-- journal_transactions — double-entry transaction header.
-- IMPORTANT: external_id == the raw txn's idempotency_hash (the engine joins
-- journal_transactions.external_id = raw_transactions.idempotency_hash). We keep
-- that logical linkage and enforce tenant-scoped uniqueness on external_id.
-- The extra UNIQUE(id, tenant_id) exists so journal_entries can carry a
-- composite FK that pins its tenant_id to the parent's (prevents drift).
create table public.journal_transactions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  external_id        text not null,             -- = raw_transactions.idempotency_hash
  transaction_date   date not null,
  description        text not null,
  source_account_id  text not null,             -- Akahu account id
  status             text not null,
  rule_id            text,                       -- classification_rules.rule_key that fired (nullable)
  created_at         timestamptz not null default now(),
  unique (tenant_id, external_id),
  unique (id, tenant_id)
);
create index idx_journal_txn_tenant_date
  on public.journal_transactions (tenant_id, transaction_date);

-- journal_entries — the debit/credit postings. tenant_id is denormalized here
-- (for straightforward RLS) and kept honest via the composite FK back to the
-- parent's (id, tenant_id).
create table public.journal_entries (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants (id) on delete cascade,
  journal_transaction_id  uuid not null,
  account                 text not null,
  side                    text not null check (side in ('debit', 'credit')),
  amount_cents            bigint not null check (amount_cents > 0),
  currency                text not null default 'NZD',
  foreign key (journal_transaction_id, tenant_id)
    references public.journal_transactions (id, tenant_id) on delete cascade
);
create index idx_journal_entries_tenant_account
  on public.journal_entries (tenant_id, account);
create index idx_journal_entries_txn
  on public.journal_entries (journal_transaction_id);

-- sync_state — Akahu cursor store. SQLite PK was global `key`
-- (e.g. 'last_sync:{account_id}'); now PK is composite (tenant_id, key) so each
-- tenant tracks its own per-account cursors independently.
create table public.sync_state (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  key         text not null,               -- e.g. 'last_sync:{account_id}'
  value       text not null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- manual_classifications — user override of a txn's target account.
-- external_id == raw idempotency_hash, same as journal_transactions. SQLite PK
-- was external_id; now composite (tenant_id, external_id).
-- DECISION: no FK to raw_transactions.idempotency_hash — the SQLite source has
-- none, and a manual classification may legitimately precede ingestion of the
-- raw txn. Kept as a logical link to preserve engine behaviour.
create table public.manual_classifications (
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  external_id     text not null,           -- = raw_transactions.idempotency_hash (logical link)
  target_account  text not null,
  memo            text,
  updated_at      timestamptz not null default now(),
  primary key (tenant_id, external_id)
);

-- manual_account_balances — snapshot balances for balance-only accounts
-- (e.g. Sharesies Growth, Blossom). SQLite PK was `account`; now composite.
create table public.manual_account_balances (
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  account        text not null,
  balance_cents  bigint not null,
  as_of_date     date not null,
  updated_at     timestamptz not null default now(),
  primary key (tenant_id, account)
);

-- =============================================================================
-- SECTION 4 — Per-tenant classification config (replaces global rules.yaml)
-- =============================================================================

-- classification_rules — the ordered `rules:` list from rules.yaml.
-- PARITY: the Python router sorts by (priority ASC, insertion_index ASC), i.e.
-- insertion order is the tiebreaker within equal priority. We reproduce that
-- with an explicit integer `seq` captured at import time. Ordering MUST be
-- ORDER BY priority, seq — never rely on uuid or timestamp ordering.
create table public.classification_rules (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants (id) on delete cascade,
  rule_key                      text not null,        -- rules.yaml `id` (e.g. 'ai_and_coding_tools')
  seq                           integer not null,     -- insertion-order tiebreaker for parity
  priority                      integer not null default 1000,
  is_enabled                    boolean not null default true,
  -- match.* fields (all optional; a rule matches when all present conditions pass)
  match_description_regex       text,
  match_merchant_regex          text,
  match_account_ids             text[],               -- rules.yaml match.account_ids
  match_amount_greater_than     numeric,              -- decimal dollars, as in yaml
  match_amount_abs_greater_than numeric,              -- decimal dollars, as in yaml
  -- route.* fields
  route_target_account          text not null,
  route_memo                    text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (tenant_id, rule_key),
  unique (tenant_id, seq)
);
create index idx_classification_rules_order
  on public.classification_rules (tenant_id, priority, seq);
create trigger trg_classification_rules_updated_at
  before update on public.classification_rules
  for each row execute function public.set_updated_at();

-- account_mappings — rules.yaml `account_mappings` (Akahu account id -> ledger
-- account + type). credit_limit_cents is optional (revolving liabilities only).
create table public.account_mappings (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  akahu_account_id   text not null,
  ledger_account     text not null,
  account_type       text not null default 'asset',   -- asset | liability | ...
  credit_limit_cents bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, akahu_account_id)
);
create trigger trg_account_mappings_updated_at
  before update on public.account_mappings
  for each row execute function public.set_updated_at();

-- nzfcc_mappings — rules.yaml `nzfcc_mappings` (NZFCC code -> target account),
-- the fallback used when no rule matches.
create table public.nzfcc_mappings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  nzfcc_code      text not null,
  target_account  text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, nzfcc_code)
);
create trigger trg_nzfcc_mappings_updated_at
  before update on public.nzfcc_mappings
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SECTION 5 — Waitlist leads (kept; optional tenant/user link added)
-- =============================================================================
-- Not tenant-scoped by nature (a lead has no tenant until converted). We add
-- nullable links so a converted lead can be traced to the tenant/user it became.
-- RLS: leads are written by an anonymous/edge path and read only by admins /
-- service-role — see rls-policies.sql.
create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  name         text,
  interest     text check (interest in ('self-serve', 'concierge')),
  source       text,
  user_agent   text,
  tenant_id    uuid references public.tenants (id) on delete set null,   -- nullable: set on conversion
  user_id      uuid references auth.users (id) on delete set null,       -- nullable: set on conversion
  created_at   timestamptz not null default now()
);
create index idx_leads_interest on public.leads (interest);
