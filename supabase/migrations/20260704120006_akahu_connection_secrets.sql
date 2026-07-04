-- =============================================================================
-- YouInc — Akahu connection secrets (Vault-backed)  |  P2 migration 6
-- =============================================================================
-- Lets a signed-in user connect their Akahu account by storing their enduring
-- Akahu USER token encrypted in Supabase Vault, keeping only the secret's uuid
-- on the akahu_connections row (per the schema's *_secret_id design). The raw
-- token NEVER lands in a business table and is NEVER returned to the client.
--
-- Why SECURITY DEFINER RPCs (not direct client access):
--   The `vault` schema is service-managed; the `authenticated` role has no
--   grants there and RLS can't scope it. So token write/read go through
--   SECURITY DEFINER functions owned by postgres, which (a) verify the caller
--   is an active member of the tenant they name (the same enforcer used by RLS
--   helpers), then (b) create/read the Vault secret. This keeps tenant
--   isolation intact while giving the app a minimal, auditable token surface.
--
-- Three functions:
--   * connect_akahu(tenant, user_token) -> upserts the akahu_connections row and
--     stores the user_token in Vault; returns the connection id. Owner/member of
--     the tenant only.
--   * get_akahu_user_token(tenant) -> decrypts and returns the token. Intended
--     for server-side sync ONLY (the app calls it with the user's session, but
--     never exposes the result to the browser). Membership-gated.
--   * disconnect_akahu(tenant) -> deletes the Vault secret + marks the row revoked.
--
-- Verified against a local Supabase stack (supabase/tests/akahu_connection.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- connect_akahu: store/replace the tenant's Akahu user token in Vault
-- -----------------------------------------------------------------------------
create or replace function public.connect_akahu(
  target_tenant uuid,
  user_token    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller     uuid := (select auth.uid());
  existing   public.akahu_connections;
  secret_id  uuid;
  clean_tok  text := nullif(btrim(user_token), '');
  secret_nm  text;
begin
  if caller is null then
    raise exception 'must be authenticated' using errcode = '28000';
  end if;
  -- Enforcer: caller must be an active member of the tenant (same rule as RLS).
  if not public.is_tenant_member(target_tenant) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;
  if clean_tok is null then
    raise exception 'Akahu user token is required' using errcode = 'P0001';
  end if;

  select * into existing
  from public.akahu_connections
  where tenant_id = target_tenant and user_id = caller;

  -- Unique, stable secret name per (tenant,user) so re-connecting replaces the
  -- prior secret rather than accumulating orphans.
  secret_nm := 'akahu_user_token:' || target_tenant::text || ':' || caller::text;

  if found and existing.user_token_secret_id is not null then
    -- Replace the secret value in place, keep the same id.
    perform vault.update_secret(existing.user_token_secret_id, clean_tok);
    secret_id := existing.user_token_secret_id;
  else
    secret_id := vault.create_secret(clean_tok, secret_nm, 'Akahu enduring user token');
  end if;

  insert into public.akahu_connections (
    tenant_id, user_id, status, user_token_secret_id, connected_at, updated_at
  )
  values (target_tenant, caller, 'active', secret_id, now(), now())
  on conflict (tenant_id, user_id) do update
    set status = 'active',
        user_token_secret_id = excluded.user_token_secret_id,
        connected_at = now(),
        updated_at = now()
  returning id into secret_id;  -- reuse var: now holds the connection id

  return secret_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_akahu_user_token: decrypt the tenant's token (server-side sync only)
-- -----------------------------------------------------------------------------
create or replace function public.get_akahu_user_token(target_tenant uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
  sid    uuid;
  tok    text;
begin
  if caller is null then
    raise exception 'must be authenticated' using errcode = '28000';
  end if;
  if not public.is_tenant_member(target_tenant) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;

  select user_token_secret_id into sid
  from public.akahu_connections
  where tenant_id = target_tenant and user_id = caller and status = 'active';

  if sid is null then
    return null;  -- not connected
  end if;

  select decrypted_secret into tok
  from vault.decrypted_secrets
  where id = sid;

  return tok;
end;
$$;

-- -----------------------------------------------------------------------------
-- disconnect_akahu: remove the Vault secret + mark the connection revoked
-- -----------------------------------------------------------------------------
create or replace function public.disconnect_akahu(target_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
  sid    uuid;
begin
  if caller is null then
    raise exception 'must be authenticated' using errcode = '28000';
  end if;
  if not public.is_tenant_member(target_tenant) then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;

  select user_token_secret_id into sid
  from public.akahu_connections
  where tenant_id = target_tenant and user_id = caller;

  if sid is not null then
    delete from vault.secrets where id = sid;
  end if;

  update public.akahu_connections
    set status = 'revoked', user_token_secret_id = null, updated_at = now()
    where tenant_id = target_tenant and user_id = caller;
end;
$$;

-- Only signed-in users may call these; revoke the implicit public grant first.
revoke execute on function public.connect_akahu(uuid, text)     from public;
revoke execute on function public.get_akahu_user_token(uuid)    from public;
revoke execute on function public.disconnect_akahu(uuid)        from public;
grant execute on function public.connect_akahu(uuid, text)      to authenticated;
grant execute on function public.get_akahu_user_token(uuid)     to authenticated;
grant execute on function public.disconnect_akahu(uuid)         to authenticated;
