-- YouInc — remove the commercial layer.
--
-- YouInc is self-hosted and is not sold. Tenant tiers ('free' / 'self-serve' /
-- concierge') and the 14-day live-sync trial existed only to gate Akahu sync
-- behind a paid plan. With no plans, the gate has no meaning: whoever runs the
-- instance supplies their own Akahu credentials and is entitled to use them.
--
-- This drops the RPC first (it reads tenants.tier), then the trial columns,
-- then the tier column and its CHECK constraint. create_tenant is recreated
-- without the tier insert. Earlier migrations are left untouched — they are
-- already applied history.

drop function if exists public.start_trial(uuid);

alter table public.tenants
  drop column if exists trial_started_at,
  drop column if exists trial_ends_at,
  drop column if exists trial_reminded_at;

alter table public.tenants
  drop constraint if exists tenants_tier_check;

alter table public.tenants
  drop column if exists tier;

-- Recreate create_tenant without the tier column. Body is otherwise identical
-- to 20260705150001_create_tenant_default_free.sql.
-- Parameter names must match the existing function exactly; Postgres refuses to
-- rename an input parameter through CREATE OR REPLACE.
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

  insert into public.tenants (name, slug, default_currency, suspense_account)
    values (
      clean_name,
      public.generate_tenant_slug(clean_name),
      coalesce(nullif(btrim(default_currency), ''), 'NZD'),
      coalesce(nullif(btrim(suspense_account), ''), 'Expenses:Uncategorized:Suspense')
    )
    returning * into t;

  insert into public.memberships (tenant_id, user_id, role, status)
    values (t.id, caller, 'owner', 'active');

  return t;
end;
$$;

revoke execute on function public.create_tenant(text, text, text) from public;
grant  execute on function public.create_tenant(text, text, text) to authenticated;
