-- =============================================================================
-- YouInc — Akahu connection secrets test (P2 verification)
-- =============================================================================
-- Proves the Vault-backed Akahu token flow under RLS:
--   * connect_akahu stores the user token in Vault (only the secret uuid lands
--     on akahu_connections; the raw token is never in a business column);
--   * get_akahu_user_token decrypts it back for the connected member;
--   * re-connecting replaces the value in place (no orphan secrets);
--   * a non-member cannot connect / read / disconnect another tenant;
--   * disconnect_akahu deletes the Vault secret and marks the row revoked.
--
--   docker exec -i supabase_db_YouInc \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/akahu_connection.sql
--
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

insert into public.tenants (id, name, slug, tier) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'akahu-a', 'self-serve'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'akahu-b', 'self-serve');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- ── User A connects Akahu to tenant A ────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"a@example.com"}', true);

do $$
declare conn uuid;
begin
  conn := public.connect_akahu('11111111-1111-1111-1111-111111111111', 'user_token_A_v1');
  assert conn is not null, 'connect_akahu should return a connection id';
  assert public.get_akahu_user_token('11111111-1111-1111-1111-111111111111') = 'user_token_A_v1',
    'get_akahu_user_token should decrypt the stored token';
  raise notice 'PASS: A connected Akahu and token round-trips through Vault';
end $$;

-- The business row must hold only the secret uuid, NEVER the raw token.
do $$
declare sid uuid;
begin
  set local role postgres;  -- bypass RLS to inspect the stored row
  select user_token_secret_id into sid
  from public.akahu_connections
  where tenant_id = '11111111-1111-1111-1111-111111111111';
  assert sid is not null, 'connection row should carry a Vault secret id';
  assert not exists (
    select 1 from public.akahu_connections
    where tenant_id = '11111111-1111-1111-1111-111111111111'
      and (akahu_connection_id = 'user_token_A_v1')
  ), 'raw token must not be stored in any akahu_connections text column';
  raise notice 'PASS: akahu_connections stores only the Vault secret uuid';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"a@example.com"}', true);
end $$;

-- Re-connecting replaces the value in place (same secret id, new value).
do $$
declare sid_before uuid; sid_after uuid;
begin
  select user_token_secret_id into sid_before from public.akahu_connections
    where tenant_id = '11111111-1111-1111-1111-111111111111';
  perform public.connect_akahu('11111111-1111-1111-1111-111111111111', 'user_token_A_v2');
  select user_token_secret_id into sid_after from public.akahu_connections
    where tenant_id = '11111111-1111-1111-1111-111111111111';
  assert sid_before = sid_after, 're-connect should reuse the same Vault secret id';
  assert public.get_akahu_user_token('11111111-1111-1111-1111-111111111111') = 'user_token_A_v2',
    're-connect should replace the token value';
  raise notice 'PASS: re-connect replaces the token in place (no orphan secret)';
end $$;

-- ── Isolation: A must NOT connect/read/disconnect tenant B ───────────────────
do $$ begin
  begin
    perform public.connect_akahu('22222222-2222-2222-2222-222222222222', 'evil');
    raise exception 'TEST FAILED: A connected Akahu to tenant B';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    raise notice 'PASS: A cannot connect Akahu to tenant B (%))', sqlerrm;
  end;
end $$;

do $$ begin
  begin
    perform public.get_akahu_user_token('22222222-2222-2222-2222-222222222222');
    raise exception 'TEST FAILED: A read tenant B token';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    raise notice 'PASS: A cannot read tenant B token (%))', sqlerrm;
  end;
end $$;

-- ── Disconnect removes the secret and marks the row revoked ──────────────────
do $$
declare sid uuid;
begin
  select user_token_secret_id into sid from public.akahu_connections
    where tenant_id = '11111111-1111-1111-1111-111111111111';
  perform public.disconnect_akahu('11111111-1111-1111-1111-111111111111');
  assert public.get_akahu_user_token('11111111-1111-1111-1111-111111111111') is null,
    'after disconnect, token read should return null';
  set local role postgres;
  assert not exists (select 1 from vault.secrets where id = sid),
    'disconnect should delete the Vault secret';
  assert (select status from public.akahu_connections
          where tenant_id = '11111111-1111-1111-1111-111111111111') = 'revoked',
    'disconnect should mark the connection revoked';
  raise notice 'PASS: disconnect deletes the Vault secret and revokes the connection';
end $$;

reset role;

do $$ begin raise notice '===================================='; end $$;
do $$ begin raise notice 'ALL AKAHU CONNECTION TESTS PASSED'; end $$;
do $$ begin raise notice '===================================='; end $$;

rollback;
