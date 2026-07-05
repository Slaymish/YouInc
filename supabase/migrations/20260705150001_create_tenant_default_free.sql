-- =============================================================================
-- YouInc — create_tenant() defaults new self-registrations to 'free'
-- =============================================================================
-- Companion to 20260705150000_tenant_tier_free.sql. Self-serve (paid) live
-- Akahu sync funds the Akahu API costs, so it can no longer be handed out for
-- free at signup. New self-registered tenants now start on 'free' (manual
-- accounts only, full widget access, no live bank connection) and upgrade to
-- 'self-serve' through a separate, non-schema billing/upgrade step. Concierge
-- tenants remain operator-provisioned, unaffected by this RPC.
--
-- CREATE OR REPLACE FUNCTION preserves the function's OID, so the existing
-- `revoke ... from public` / `grant ... to authenticated` from
-- 20260704120005_self_registration.sql still apply — no need to repeat them.
-- Body is otherwise byte-for-byte identical to the original migration except
-- for the tier literal and its comment.
-- =============================================================================

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
      'free'   -- self-service signups start Free (manual accounts only); upgrade
               -- to self-serve is a separate billing step, not part of signup.
    )
    returning * into t;

  insert into public.memberships (tenant_id, user_id, role, status)
    values (t.id, caller, 'owner', 'active');

  return t;
end;
$$;
