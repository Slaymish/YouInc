-- =============================================================================
-- YouInc — Self-service signup (public self-registration)  |  P4 migration 5/5
-- =============================================================================
-- Closes the gap the P1 README called out: "Public signup / create-tenant RPC —
-- that is P4 self-registration." P1 could only onboard via invite (accept_invite)
-- into a pre-existing tenant; a brand-new user had no way to create their own.
--
-- Two pieces, both SECURITY DEFINER so they can write rows the caller's RLS
-- policies would otherwise block (the caller has no membership yet, and profiles
-- must exist before the client ever runs a query):
--
--   1. handle_new_user()  — AFTER INSERT trigger on auth.users. Every new auth
--      user automatically gets a public.profiles row, seeded from signup
--      metadata (display_name) or their email local-part. Idempotent.
--   2. create_tenant()    — the self-registration RPC. Creates a tenant, makes
--      the caller its owner, and returns the tenant. This is what the onboarding
--      "name your entity" step calls. Tier defaults to 'self-serve' (concierge
--      tenants are still provisioned operator-side, per accept_invite's note).
--
-- Verified against a local Supabase stack (supabase db reset + the extended
-- rls_isolation.sql suite).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 — Auto-provision a profile for every new auth user
-- -----------------------------------------------------------------------------
-- Runs as the function owner (postgres) so it can insert into public.profiles
-- regardless of the RLS INSERT policy (which requires id = auth.uid(), and there
-- is no auth.uid() during the auth.users insert). ON CONFLICT DO NOTHING keeps
-- it safe if a profile was somehow already created (e.g. by an RPC).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2 — Slug helper: derive a URL-safe, collision-free tenant slug
-- -----------------------------------------------------------------------------
-- Lowercases, collapses any run of non-alphanumerics to a single hyphen, trims
-- leading/trailing hyphens, falls back to 'entity' if empty, then appends a
-- short random suffix so concurrent signups with the same name never collide on
-- the tenants.slug unique constraint.
create or replace function public.generate_tenant_slug(raw_name text)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  base text;
begin
  base := lower(coalesce(raw_name, ''));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then
    base := 'entity';
  end if;
  base := left(base, 40);
  -- Short random suffix (first 8 hex chars of a v4 uuid) guarantees uniqueness
  -- against the tenants.slug constraint without depending on pgcrypto's schema.
  return base || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3 — create_tenant(): the self-registration RPC
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER because the caller has no membership yet, so the tenants
-- INSERT (no client insert policy) and memberships INSERT (writes go through
-- SECURITY DEFINER only) are both denied to them directly. This function creates
-- both atomically and makes the caller the owner.
--
-- Concurrency: the whole body is one statement-group in an implicit transaction;
-- if the memberships insert fails the tenant insert rolls back with it.
create or replace function public.create_tenant(
  tenant_name       text,
  default_currency  text default 'NZD',
  suspense_account  text default 'Expenses:Uncategorized:Suspense'
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
  t      public.tenants;
  clean_name text := nullif(btrim(tenant_name), '');
begin
  if caller is null then
    raise exception 'must be authenticated to create a tenant'
      using errcode = '28000';
  end if;

  if clean_name is null then
    raise exception 'tenant name is required'
      using errcode = 'P0001';
  end if;

  -- Make sure the caller's profile exists (the trigger normally handles this,
  -- but a client could call create_tenant before the profile row is visible).
  insert into public.profiles (id)
    values (caller)
    on conflict (id) do nothing;

  insert into public.tenants (name, slug, default_currency, suspense_account, tier)
    values (
      clean_name,
      public.generate_tenant_slug(clean_name),
      coalesce(nullif(btrim(default_currency), ''), 'NZD'),
      coalesce(nullif(btrim(suspense_account), ''), 'Expenses:Uncategorized:Suspense'),
      'self-serve'   -- self-service signups are always self-serve; concierge is operator-provisioned
    )
    returning * into t;

  insert into public.memberships (tenant_id, user_id, role, status)
    values (t.id, caller, 'owner', 'active');

  return t;
end;
$$;

-- Only signed-in users may self-register a tenant; revoke the implicit public
-- grant first (matches accept_invite's grant discipline).
revoke execute on function public.create_tenant(text, text, text) from public;
grant execute on function public.create_tenant(text, text, text) to authenticated;

-- generate_tenant_slug is a pure helper only ever called from create_tenant
-- (which runs as its owner); keep it off the client surface.
revoke execute on function public.generate_tenant_slug(text) from public;
