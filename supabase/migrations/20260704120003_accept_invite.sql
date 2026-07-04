-- =============================================================================
-- YouInc — accept_invite RPC  |  P1 migration 3/3
-- =============================================================================
-- ✅  VERIFIED (2026-07-04): exercised by supabase/tests/rls_isolation.sql on a
--     local Supabase stack — creates the membership with the invite's role, marks
--     the invite accepted, and rejects an email-bound invite for the wrong user.
--
-- Turns the "chicken-and-egg" invite acceptance (accepter has no membership yet,
-- so RLS would lock them out of their own invite) into a SECURITY DEFINER RPC.
--
-- TIER: an invite grants a ROLE in a specific tenant. It never carries tier —
-- tier is a tenant-level attribute (tenants.tier). The invitee lands at whatever
-- tier the target tenant already has.
--
-- ── CONCIERGE-ONBOARDING ASSUMPTION (confirm before P5) ──────────────────────
-- The intended shape for a concierge client is: create a NEW tenant at
-- tier='concierge', then issue an invite into THAT tenant with role='owner'.
-- The client accepts and becomes owner of their own isolated concierge tenant —
-- NOT a member of the operator's tenant. This keeps each client's finances
-- isolated (RLS scopes on tenant_id). This RPC works for either shape, but the
-- per-client-tenant model is the assumption; the tenant-creation half is P4/P5
-- work, not defined here. If instead you want concierge clients to share one
-- operator tenant, that is a deliberate (and privacy-sensitive) choice — flag it.
-- =============================================================================

create or replace function public.accept_invite(invite_code text)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  inv          public.invites;
  m            public.memberships;
  caller       uuid := (select auth.uid());
  caller_email text := (select auth.jwt() ->> 'email');
begin
  if caller is null then
    raise exception 'must be authenticated to accept an invite'
      using errcode = '28000';
  end if;

  -- Lock the invite row so two concurrent accepts cannot both consume it.
  select * into inv
  from public.invites
  where code = invite_code
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite invalid, already used, or expired'
      using errcode = 'P0001';
  end if;

  -- If the invite was pre-bound to an email, the accepting user must match it.
  -- Case-insensitive; the JWT email claim is server-controlled.
  if inv.invited_email is not null
     and lower(inv.invited_email) <> lower(coalesce(caller_email, '')) then
    raise exception 'invite is bound to a different email address'
      using errcode = 'P0001';
  end if;

  -- Create the membership (role from the invite; tier lives on the tenant).
  -- If the user is already a member of this tenant, keep the existing row
  -- rather than returning null (the sketch's on-conflict-do-nothing bug).
  insert into public.memberships (tenant_id, user_id, role)
    values (inv.tenant_id, caller, inv.role)
    on conflict (tenant_id, user_id)
      do update set updated_at = now()
    returning * into m;

  update public.invites
    set status = 'accepted',
        accepted_by = caller,
        accepted_at = now()
    where id = inv.id;

  return m;
end;
$$;

-- Only signed-in users may call it; revoke the implicit public grant first.
revoke execute on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
