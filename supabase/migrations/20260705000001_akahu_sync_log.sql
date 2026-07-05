-- =============================================================================
-- YouInc — Akahu sync log  |  P2 slice (per-sync detail log)
-- =============================================================================
-- Records one row per syncAkahuAccount() attempt (see
-- frontend/src/server/akahuConnection.ts) so a user can see recent sync
-- attempts — the date range requested, how many transactions were ingested,
-- and any error — instead of only the single akahu_connections.last_synced_at
-- timestamp. A row is inserted with status='running' when a sync starts and
-- updated in place to 'success' or 'error' when it finishes.
--
-- Follows the same tenant-scoped RLS + grant shape as every other business
-- table (see 20260704120002_rls_policies.sql SECTION 4 and
-- 20260704120004_grants.sql) — no new helpers needed, just the standard
-- tenant_id-membership policy.
--
-- Out of scope here (deferred, needs a hosting decision): scheduled/background
-- sync automation. This table only logs on-demand syncs triggered from
-- /workspace.
-- =============================================================================

create table public.akahu_sync_log (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants (id) on delete cascade,
  akahu_account_id       text not null,
  started_at             timestamptz not null default now(),
  finished_at            timestamptz,
  from_date              date,
  to_date                date,
  transactions_ingested  integer,
  status                 text not null default 'running',  -- running | success | error
  error_message          text,
  constraint akahu_sync_log_status_check
    check (status in ('running', 'success', 'error'))
);

-- Recent-first lookups scoped to a tenant (and optionally one account) are the
-- only access pattern (listSyncLog), so index on exactly that.
create index idx_akahu_sync_log_tenant_started
  on public.akahu_sync_log (tenant_id, started_at desc);
create index idx_akahu_sync_log_tenant_account_started
  on public.akahu_sync_log (tenant_id, akahu_account_id, started_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.akahu_sync_log enable row level security;

create policy akahu_sync_log_tenant on public.akahu_sync_log
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

-- ── Grants ────────────────────────────────────────────────────────────────────
-- Same rationale as 20260704120004_grants.sql: RLS filters rows, but the
-- authenticated role still needs base table privileges to touch the table at
-- all for a migration created outside Supabase's table-creation UI.
grant select, insert, update, delete on public.akahu_sync_log to authenticated;
