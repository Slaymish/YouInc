-- =============================================================================
-- YouInc — Role privilege grants  |  P1 migration 4/4
-- =============================================================================
-- RLS filters ROWS, but a role still needs base TABLE privileges to touch a
-- table at all. Supabase's API layer auto-grants these for tables created via
-- its tooling; tables created by raw SQL migrations do not get them, so we grant
-- explicitly here. The grant enables a command; the RLS policy (migration 2)
-- confines it to the caller's own tenant. Grant + policy are two halves of one
-- access rule — keep them in sync.
--
-- Verified against the local stack: without these grants, an authenticated user
-- gets "permission denied for table" before RLS is ever evaluated.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- ── Tenant-scoped business tables ────────────────────────────────────────────
-- Full DML for authenticated; the `for all` RLS policies confine every command
-- to rows in a tenant the user belongs to. (Hardening option for P2/P8: restrict
-- the ledger-core tables — raw_transactions, journal_*, sync_state — to SELECT
-- for authenticated and let the service_role backend own their writes, since
-- ledger ingestion is a trusted batch job. Left as full DML here so user-scoped
-- writes can go through the authenticated key with RLS applied, per the RLS
-- design §8.)
grant select, insert, update, delete on
  public.akahu_connections,
  public.raw_transactions,
  public.journal_transactions,
  public.journal_entries,
  public.sync_state,
  public.manual_classifications,
  public.manual_account_balances,
  public.classification_rules,
  public.account_mappings,
  public.nzfcc_mappings
  to authenticated;

-- ── Identity / tenancy tables ────────────────────────────────────────────────
-- tenants:     SELECT (member) + UPDATE (owner) via RLS. Creation is service_role.
-- profiles:    self SELECT/INSERT/UPDATE via RLS.
-- memberships: SELECT only — all writes go through accept_invite (SECURITY
--              DEFINER) or service_role, never a direct client write.
-- invites:     full DML; the admin-only `for all` policy governs who may act.
grant select, update on public.tenants to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.invites to authenticated;

-- ── Leads (public waitlist) ──────────────────────────────────────────────────
-- Anonymous signup inserts only; reads stay service_role-only (no SELECT grant),
-- matching the leads_anon_insert policy.
grant insert on public.leads to anon;
