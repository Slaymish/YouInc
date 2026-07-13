-- Phase B: 14-day, no-card free trial of live Akahu sync for Free-tier tenants.
--
-- Adds trial bookkeeping columns to `tenants` and a SECURITY DEFINER RPC that
-- arms the trial exactly once. Reads of these columns are already covered by the
-- existing `tenants_member_select` RLS policy (members can read the whole row);
-- writes go through start_trial (owner-only) rather than a direct client UPDATE,
-- matching the connect_akahu / create_tenant pattern.

alter table public.tenants
  add column if not exists trial_started_at  timestamptz,
  add column if not exists trial_ends_at     timestamptz,
  add column if not exists trial_reminded_at timestamptz;

-- Arm the caller's tenant trial: only for a Free tenant that has never trialed
-- (trial_ends_at is null). Idempotent-safe — a second call updates no row (the
-- `and trial_ends_at is null` guard) and raises, so a trial can't be extended or
-- re-armed. Owner-only, mirroring tenants_owner_update.
create or replace function public.start_trial(target_tenant uuid)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
  updated public.tenants;
begin
  if caller is null then
    raise exception 'must be authenticated to start a trial' using errcode = '28000';
  end if;

  if not public.has_tenant_role(target_tenant, array['owner']) then
    raise exception 'only the workspace owner can start the trial' using errcode = '42501';
  end if;

  update public.tenants
     set trial_started_at = now(),
         trial_ends_at    = now() + interval '14 days'
   where id = target_tenant
     and tier = 'free'
     and trial_ends_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'trial is not available for this workspace (already used, or not on the Free plan)'
      using errcode = '42501';
  end if;

  return updated;
end;
$$;

revoke execute on function public.start_trial(uuid) from public;
grant  execute on function public.start_trial(uuid) to authenticated;
