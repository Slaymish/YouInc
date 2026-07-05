-- =============================================================================
-- YouInc — Multi-step auth flows + WebAuthn passkeys  |  P2 migration 12
-- =============================================================================
-- Backs the multi-step signin/signup redesign (one field per screen, a
-- step-scoped URL that survives refresh/back). Two tables + a small set of
-- SECURITY DEFINER RPCs, following the same "deny-all table, all access via
-- owned functions" pattern as akahu_connection_secrets (migration 6).
--
--   1. auth_flows          — short-lived pre-auth continuation token. RLS deny-all.
--                            Reached only through start/get/update RPCs.
--   2. passkey_credentials — a user's registered WebAuthn credentials. RLS lets
--                            a signed-in user READ/DELETE their own; all writes
--                            go through service-role (registration) or the
--                            SECURITY DEFINER counter-bump RPC (signin).
--
-- The flow RPCs and the passkey lookup RPCs are granted to BOTH anon and
-- authenticated: the whole point is that they run *before* a session exists.
-- Security rests on the flow token being an unguessable uuid, exactly like a
-- pre-auth continuation token, not on the caller's identity.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. auth_flows
-- -----------------------------------------------------------------------------
create table if not exists public.auth_flows (
  token       uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('signup', 'signin')),
  email       text,
  first_name  text,
  last_name   text,
  step        text not null,
  has_passkey boolean,            -- signin only: does this email have a credential?
  user_id     uuid,               -- filled once the Supabase account exists (signup)
  challenge   text,               -- pending WebAuthn challenge (registration/authn)
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 minutes'
);

alter table public.auth_flows enable row level security;
-- No policies: deny-all direct access. All reads/writes go through the
-- SECURITY DEFINER RPCs below, matching the akahu_connections secret pattern.

-- Step ordering per kind. A flow may advance at most one step at a time (or move
-- back / stay), never jump ahead. Returns the 0-based rank, or null if the step
-- is not valid for the kind.
create or replace function public.auth_flow_step_rank(flow_kind text, flow_step text)
returns int
language sql
immutable
as $$
  select case
    when flow_kind = 'signup' then case flow_step
      when 'email' then 0
      when 'name' then 1
      when 'credential' then 2
      when 'password' then 3
      else null end
    when flow_kind = 'signin' then case flow_step
      when 'email' then 0
      when 'password' then 1
      else null end
    else null
  end;
$$;

-- start_auth_flow: create a fresh flow row at step 1 ('email'), return its token.
create or replace function public.start_auth_flow(flow_kind text, flow_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid;
  clean_email text := nullif(btrim(lower(flow_email)), '');
begin
  if flow_kind not in ('signup', 'signin') then
    raise exception 'invalid flow kind' using errcode = 'P0001';
  end if;

  insert into public.auth_flows (kind, email, step)
    values (flow_kind, clean_email, 'email')
    returning token into new_token;

  return new_token;
end;
$$;

-- get_auth_flow: return the row, or NULL if missing/expired. Expired rows are
-- simply excluded (not deleted synchronously; a periodic cleanup can be added
-- later without changing this API).
create or replace function public.get_auth_flow(flow_token uuid)
returns public.auth_flows
language sql
security definer
set search_path = public
as $$
  select *
  from public.auth_flows
  where token = flow_token
    and expires_at > now();
$$;

-- update_auth_flow: patch fields and (optionally) advance the step, validating
-- the transition server-side. Any NULL patch argument leaves that field
-- unchanged; `patch_*_set` booleans allow explicitly nulling first/last name.
create or replace function public.update_auth_flow(
  flow_token         uuid,
  next_step          text default null,
  patch_email        text default null,
  patch_first_name   text default null,
  patch_last_name    text default null,
  patch_has_passkey  boolean default null,
  patch_user_id      uuid default null,
  patch_challenge    text default null
)
returns public.auth_flows
language plpgsql
security definer
set search_path = public
as $$
declare
  flow public.auth_flows;
  cur_rank int;
  next_rank int;
  updated public.auth_flows;
begin
  select * into flow
  from public.auth_flows
  where token = flow_token and expires_at > now();

  if not found then
    raise exception 'flow not found or expired' using errcode = 'P0002';
  end if;

  if next_step is not null then
    cur_rank := public.auth_flow_step_rank(flow.kind, flow.step);
    next_rank := public.auth_flow_step_rank(flow.kind, next_step);
    if next_rank is null then
      raise exception 'invalid step % for %', next_step, flow.kind
        using errcode = 'P0001';
    end if;
    -- Can advance at most one step; may stay or go back. Never jump ahead.
    if next_rank > cur_rank + 1 then
      raise exception 'cannot skip steps' using errcode = 'P0001';
    end if;
  end if;

  update public.auth_flows
    set step        = coalesce(next_step, step),
        email       = coalesce(nullif(btrim(lower(patch_email)), ''), email),
        first_name  = coalesce(patch_first_name, first_name),
        last_name   = coalesce(patch_last_name, last_name),
        has_passkey = coalesce(patch_has_passkey, has_passkey),
        user_id     = coalesce(patch_user_id, user_id),
        challenge   = coalesce(patch_challenge, challenge)
    where token = flow_token
    returning * into updated;

  return updated;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. passkey_credentials
-- -----------------------------------------------------------------------------
create table if not exists public.passkey_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key    bytea not null,
  counter       bigint not null default 0,
  transports    text[],
  device_label  text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

alter table public.passkey_credentials enable row level security;

create policy "read own credentials" on public.passkey_credentials
  for select using (user_id = (select auth.uid()));
create policy "delete own credentials" on public.passkey_credentials
  for delete using (user_id = (select auth.uid()));
-- No insert/update policy for authenticated/anon: writes only via service-role
-- (registration) or the SECURITY DEFINER RPC below (counter bump on signin).

-- passkey_exists_for_email: does this email have at least one credential? Used
-- by signin step 1 to decide whether to offer "Continue with passkey".
-- (Reveals account existence — same disclosure category as Supabase's own
-- signup errors; noted in the design, not solved.)
create or replace function public.passkey_exists_for_email(flow_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.passkey_credentials pc
    join auth.users u on u.id = pc.user_id
    where lower(u.email) = nullif(btrim(lower(flow_email)), '')
  );
$$;

-- find_passkey_credential: look up a credential by its credential_id, returning
-- everything needed to verify an assertion and bridge to a session. Needed
-- pre-auth (no session yet to scope an RLS read). public_key is base64-encoded
-- for a clean JSON boundary; JS decodes it before verification.
create or replace function public.find_passkey_credential(cred_id text)
returns table (
  id            uuid,
  user_id       uuid,
  email         text,
  public_key_b64 text,
  counter       bigint,
  transports    text[]
)
language sql
security definer
set search_path = public
as $$
  select
    pc.id,
    pc.user_id,
    u.email,
    encode(pc.public_key, 'base64') as public_key_b64,
    pc.counter,
    pc.transports
  from public.passkey_credentials pc
  join auth.users u on u.id = pc.user_id
  where pc.credential_id = cred_id;
$$;

-- bump_passkey_credential: after a verified assertion, advance the stored
-- counter and stamp last_used_at. Same no-session-yet reasoning as the lookup.
create or replace function public.bump_passkey_credential(cred_id text, new_counter bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.passkey_credentials
    set counter = new_counter, last_used_at = now()
    where credential_id = cred_id;
$$;

-- -----------------------------------------------------------------------------
-- Grants — these all run pre-auth, so anon needs them too. Revoke the implicit
-- public grant first, then grant to anon + authenticated explicitly.
-- -----------------------------------------------------------------------------
revoke execute on function public.start_auth_flow(text, text)                      from public;
revoke execute on function public.get_auth_flow(uuid)                              from public;
revoke execute on function public.update_auth_flow(uuid, text, text, text, text, boolean, uuid, text) from public;
revoke execute on function public.passkey_exists_for_email(text)                   from public;
revoke execute on function public.find_passkey_credential(text)                    from public;
revoke execute on function public.bump_passkey_credential(text, bigint)            from public;

grant execute on function public.start_auth_flow(text, text)                       to anon, authenticated;
grant execute on function public.get_auth_flow(uuid)                               to anon, authenticated;
grant execute on function public.update_auth_flow(uuid, text, text, text, text, boolean, uuid, text) to anon, authenticated;
grant execute on function public.passkey_exists_for_email(text)                    to anon, authenticated;
grant execute on function public.find_passkey_credential(text)                     to anon, authenticated;
grant execute on function public.bump_passkey_credential(text, bigint)             to anon, authenticated;

-- Table grants: RLS filters rows, but a role still needs base privileges to
-- touch the table at all. passkey_credentials: authenticated may SELECT/DELETE
-- (scoped by the policies above). auth_flows: no direct grants — RPCs only.
grant select, delete on public.passkey_credentials to authenticated;
