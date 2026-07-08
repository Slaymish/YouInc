-- =============================================================================
-- YouInc — passkey_credentials grants test
-- Run: docker exec -i supabase_db_YouInc \
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/passkey_credentials_grants.sql
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

-- fixture user (auth.users FK target for passkey_credentials.user_id)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'passkey-grant-test@example.com');

-- ── service_role CAN insert a credential (registration path) ─────────────────
set local role service_role;
do $$
begin
  insert into public.passkey_credentials (user_id, credential_id, public_key, counter)
    values ('00000000-0000-0000-0000-0000000000f1', 'cred-grant-test', '\x00', 0);
  raise notice 'PASS: service_role can insert passkey_credentials';
end $$;
set local role postgres;

-- ── anon still CANNOT insert (no policy, no grant) ────────────────────────────
set local role anon;
do $$
begin
  begin
    insert into public.passkey_credentials (user_id, credential_id, public_key, counter)
      values ('00000000-0000-0000-0000-0000000000f1', 'cred-anon-test', '\x00', 0);
    raise exception 'anon must NOT be able to INSERT passkey_credentials';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot insert passkey_credentials';
  end;
end $$;
set local role postgres;

-- ── authenticated still CANNOT insert (read/delete only, per the RLS design) ─
set local role authenticated;
do $$
begin
  begin
    insert into public.passkey_credentials (user_id, credential_id, public_key, counter)
      values ('00000000-0000-0000-0000-0000000000f1', 'cred-authed-test', '\x00', 0);
    raise exception 'authenticated must NOT be able to INSERT passkey_credentials';
  exception when insufficient_privilege then
    raise notice 'PASS: authenticated cannot insert passkey_credentials';
  end;
end $$;
set local role postgres;

rollback;
