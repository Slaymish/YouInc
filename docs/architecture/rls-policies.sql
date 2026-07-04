-- =============================================================================
-- YouInc — Row-Level Security design  |  PHASE 0 design artifact
-- =============================================================================
-- Isolation backbone: every business table has RLS enabled, and access is
-- granted only to rows whose tenant_id is one the current user is a member of.
--
-- TWO-LAYER TENANT CONTEXT (both layers, not either/or):
--   * ENFORCER (always on, zero external dependency): membership check —
--     "does a membership row exist linking auth.uid() to this tenant_id?".
--     This alone makes the system safe.
--   * SELECTOR (optional narrowing): the *active* tenant travels in the JWT as
--     an app_metadata claim (set by a custom-access-token Auth Hook). It only
--     PICKS AMONG tenants the user already belongs to — a stale/forged claim
--     cannot grant access the membership backbone doesn't already allow.
--
-- The selector layer depends on Supabase Auth Hooks / custom claims, which are
-- evolving; treat the code in SECTION 5 as a sketch to validate against current
-- Supabase docs before relying on it. The enforcer layer (SECTIONS 1-4) is the
-- part that must ship.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1 — Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- -----------------------------------------------------------------------------
-- RECURSION TRAP (the #1 Supabase RLS footgun): a policy on a business table
-- that does `tenant_id IN (SELECT tenant_id FROM memberships ...)` will, if
-- memberships itself has RLS, recurse — Postgres evaluates the memberships
-- policy, which... you get the idea. Fix: read memberships from inside a
-- SECURITY DEFINER function, which runs as the function owner and bypasses RLS
-- on that read. Business-table policies call the helper; they never subquery
-- memberships directly.
--
-- SCHEMA CHOICE: these helpers live in `public`, NOT `auth`. Supabase's `auth`
-- schema is service-managed — custom objects there can be clobbered by Auth
-- migrations and do not get EXECUTE granted to `authenticated` by default. So
-- we define them in public and grant execute explicitly (see grants below).
--
-- OWNER REQUIREMENT: SECURITY DEFINER only bypasses RLS if the function OWNER
-- has BYPASSRLS. Create/own these as a superuser-equivalent role (Supabase's
-- `postgres`). State the owner explicitly at deploy time (ALTER FUNCTION ...
-- OWNER TO postgres) so the RLS-bypass on the memberships read actually holds.

-- Returns the set of tenant_ids the current user belongs to (active only).
create or replace function public.user_tenant_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

-- Membership predicate for a specific tenant — convenient in policies.
create or replace function public.is_tenant_member(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.tenant_id = target
      and m.status = 'active'
  );
$$;

-- Role predicate (owner/admin) for management operations.
create or replace function public.has_tenant_role(target uuid, roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.tenant_id = target
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

-- Grant execute to the authenticated role; revoke the default public grant so
-- only signed-in users can call them.
revoke execute on function public.user_tenant_ids()            from public;
revoke execute on function public.is_tenant_member(uuid)       from public;
revoke execute on function public.has_tenant_role(uuid, text[]) from public;
grant execute on function public.user_tenant_ids()            to authenticated;
grant execute on function public.is_tenant_member(uuid)       to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

-- PERFORMANCE: helpers and auth.uid() are wrapped as `(select ...)` at their
-- call sites in policies below so the planner hoists them to a one-time initPlan
-- rather than re-evaluating per row.

-- =============================================================================
-- SECTION 2 — Enable RLS on every business table
-- =============================================================================
alter table public.tenants                enable row level security;
alter table public.profiles               enable row level security;
alter table public.memberships            enable row level security;
alter table public.invites                enable row level security;
alter table public.akahu_connections      enable row level security;
alter table public.raw_transactions       enable row level security;
alter table public.journal_transactions   enable row level security;
alter table public.journal_entries        enable row level security;
alter table public.sync_state             enable row level security;
alter table public.manual_classifications enable row level security;
alter table public.manual_account_balances enable row level security;
alter table public.classification_rules   enable row level security;
alter table public.account_mappings       enable row level security;
alter table public.nzfcc_mappings         enable row level security;
alter table public.leads                  enable row level security;

-- =============================================================================
-- SECTION 3 — Identity tables (non-recursive policies)
-- =============================================================================

-- profiles: a user sees/edits only their own profile row.
create policy profiles_self_select on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_self_upsert on public.profiles
  for insert with check (id = (select auth.uid()));
create policy profiles_self_update on public.profiles
  for update using (id = (select auth.uid()))
             with check (id = (select auth.uid()));

-- memberships: the SELECT policy MUST be non-recursive — it references
-- auth.uid() directly, NOT a self-referential subquery on memberships (which
-- would recurse). A user sees their own membership rows; owners/admins see the
-- full roster of their tenant (via the SECURITY DEFINER role helper, which does
-- not re-trigger this policy).
create policy memberships_self_select on public.memberships
  for select using (
    user_id = (select auth.uid())
    or (select public.has_tenant_role(tenant_id, array['owner','admin']))
  );
-- Writes to memberships go through SECURITY DEFINER RPCs (invite acceptance,
-- role changes) or service_role — no direct client INSERT/UPDATE/DELETE policy
-- is granted, so those are denied by default.

-- tenants: members can read their tenant; only owners can update it.
create policy tenants_member_select on public.tenants
  for select using ((select public.is_tenant_member(id)));
create policy tenants_owner_update on public.tenants
  for update using ((select public.has_tenant_role(id, array['owner'])))
             with check ((select public.has_tenant_role(id, array['owner'])));
-- Tenant creation is done by service_role / a signup RPC, not direct client insert.

-- =============================================================================
-- SECTION 4 — Tenant-scoped business tables
-- =============================================================================
-- Uniform shape: read/write allowed iff the row's tenant_id is one the user is
-- a member of. USING gates existing rows (SELECT/UPDATE/DELETE); WITH CHECK
-- gates new/changed rows (INSERT/UPDATE) so a user cannot move a row into a
-- tenant they don't belong to.
--
-- Applied identically to: akahu_connections, raw_transactions,
-- journal_transactions, journal_entries, sync_state, manual_classifications,
-- manual_account_balances, classification_rules, account_mappings,
-- nzfcc_mappings. Written out per-table below (one FOR ALL policy each).

create policy akahu_connections_tenant on public.akahu_connections
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy raw_transactions_tenant on public.raw_transactions
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy journal_transactions_tenant on public.journal_transactions
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy journal_entries_tenant on public.journal_entries
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy sync_state_tenant on public.sync_state
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy manual_classifications_tenant on public.manual_classifications
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy manual_account_balances_tenant on public.manual_account_balances
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy classification_rules_tenant on public.classification_rules
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy account_mappings_tenant on public.account_mappings
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

create policy nzfcc_mappings_tenant on public.nzfcc_mappings
  for all using (tenant_id in (select public.user_tenant_ids()))
          with check (tenant_id in (select public.user_tenant_ids()));

-- NOTE: `for all` covers SELECT/INSERT/UPDATE/DELETE. If finer control is later
-- needed (e.g. members may read but only admins may delete rules), split into
-- per-command policies keyed on auth.has_tenant_role(tenant_id, ...).

-- =============================================================================
-- SECTION 5 — Invites (chicken-and-egg: accepter has no membership yet)
-- =============================================================================
-- Owners/admins of the tenant manage invites directly:
create policy invites_admin_all on public.invites
  for all using ((select public.has_tenant_role(tenant_id, array['owner','admin'])))
          with check ((select public.has_tenant_role(tenant_id, array['owner','admin'])));

-- ACCEPTANCE cannot go through membership-based RLS: the accepting user has no
-- membership for the tenant yet, so any membership predicate locks them out of
-- their own invite. Acceptance is therefore a SECURITY DEFINER RPC that (a)
-- looks the invite up by its opaque `code`, (b) validates status='pending' and
-- expires_at > now(), (c) creates the membership with the invite's role (tier is
-- determined by the tenant), (d) marks the invite accepted — all bypassing RLS
-- inside the function.
-- Sketch (validate against current Supabase before shipping):
--
--   create function public.accept_invite(invite_code text)
--   returns public.memberships
--   language plpgsql security definer set search_path = public as $$
--   declare inv public.invites; m public.memberships;
--   begin
--     select * into inv from public.invites
--       where code = invite_code and status = 'pending' and expires_at > now()
--       for update;
--     if not found then raise exception 'invite invalid or expired'; end if;
--     insert into public.memberships (tenant_id, user_id, role)
--       values (inv.tenant_id, auth.uid(), inv.role)
--       on conflict (tenant_id, user_id) do nothing
--       returning * into m;
--     update public.invites
--       set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
--       where id = inv.id;
--     return m;
--   end; $$;
--   grant execute on function public.accept_invite(text) to authenticated;

-- =============================================================================
-- SECTION 6 — Leads (waitlist)
-- =============================================================================
-- Public signup writes leads from an anonymous/edge path. Prefer routing writes
-- through an Edge Function or RPC using service_role (with rate limiting +
-- honeypot) rather than granting the anon role broad INSERT. If a direct anon
-- insert IS used, gate it tightly:
create policy leads_anon_insert on public.leads
  for insert to anon
  with check (interest in ('self-serve', 'concierge'));
-- Reads are restricted to service_role / admin tooling only — no SELECT policy
-- for anon/authenticated means reads are denied by default.

-- =============================================================================
-- SECTION 7 — Selector layer: active tenant from the JWT (BETA — verify)
-- =============================================================================
-- The brief requires the session to "carry tenant_id". Implement via a custom
-- access-token Auth Hook that, at token issuance, writes the user's active
-- tenant into the JWT. UNCERTAINTY FLAG: the exact hook registration, payload
-- shape, and claim-reading helper are Supabase-version-specific and the passkey
-- path is beta — confirm against current docs before relying on this.
--
-- CRITICAL: put the claim in `app_metadata`, NEVER `user_metadata`.
-- user_metadata is user-writable, so using it for authorization is a privilege-
-- escalation hole. app_metadata is server-controlled.
--
-- To NARROW access to a single active tenant (selector), a policy can AND the
-- claim onto the enforcer, e.g.:
--
--   create policy raw_transactions_active_tenant on public.raw_transactions
--     for all using (
--       tenant_id in (select public.user_tenant_ids())            -- enforcer
--       and tenant_id = (auth.jwt() -> 'app_metadata' ->> 'active_tenant_id')::uuid  -- selector
--     ) with check ( ... same ... );
--
-- The selector is a convenience/scoping filter; the membership enforcer is the
-- security boundary. Never rely on the claim alone.

-- =============================================================================
-- SECTION 8 — Service-role (ledger backend) — RLS does NOT protect you here
-- =============================================================================
-- The TS ledger backend connects as `service_role`, which BYPASSES RLS
-- entirely. Consequences:
--   * Every backend query MUST include an explicit `WHERE tenant_id = $1`.
--     RLS is not a safety net for service_role — tenant scoping is the app's
--     responsibility on every read and write. Treat this as a hard code-review
--     gate for the port.
--   * NEVER expose the service_role key to the browser or any client bundle.
--     It lives only in server-side env (the ingest/ledger service).
--   * Prefer running per-request user-scoped queries through the anon/authed
--     key + user JWT (so RLS applies) and reserve service_role for trusted
--     batch jobs (Akahu sync, migration) that set tenant_id explicitly.
