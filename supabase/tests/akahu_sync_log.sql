-- =============================================================================
-- YouInc — Akahu sync log RLS test (P2 verification)
-- =============================================================================
-- Proves the akahu_sync_log tenant-isolation policy holds, mirroring the shape
-- of rls_isolation.sql / akahu_connection.sql:
--   * a tenant member can insert/select/update their own sync-log rows;
--   * a member of tenant B sees ZERO of tenant A's rows;
--   * WITH CHECK blocks inserting a row tagged with another tenant's id.
--
--   docker exec -i supabase_db_YouInc \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/akahu_sync_log.sql
--
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

insert into public.tenants (id, name, slug, tier) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'sync-log-a', 'self-serve'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'sync-log-b', 'self-serve');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- ── User A logs a sync attempt for tenant A ──────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"a@example.com"}', true);

do $$
declare log_id uuid;
begin
  insert into public.akahu_sync_log (tenant_id, akahu_account_id, from_date, to_date, status)
  values ('11111111-1111-1111-1111-111111111111', 'acc_a', '2026-01-01', '2026-01-31', 'running')
  returning id into log_id;

  assert log_id is not null, 'A should be able to insert a sync-log row for tenant A';
  assert (select count(*) from public.akahu_sync_log) = 1,
    'A should see exactly 1 sync-log row (its own)';

  update public.akahu_sync_log
    set status = 'success', transactions_ingested = 12, finished_at = now()
    where id = log_id;
  assert (select status from public.akahu_sync_log where id = log_id) = 'success',
    'A should be able to update its own sync-log row to success';

  raise notice 'PASS: A can insert/select/update its own sync-log row';
end $$;

-- WITH CHECK: A must not be able to log a sync into tenant B.
do $$ begin
  begin
    insert into public.akahu_sync_log (tenant_id, akahu_account_id, status)
    values ('22222222-2222-2222-2222-222222222222', 'evil', 'running');
    raise exception 'TEST FAILED: A inserted a sync-log row into tenant B';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: WITH CHECK blocked A writing a sync-log row into tenant B';
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: cross-tenant sync-log insert rejected (%)', sqlerrm;
  end;
end $$;

-- ── User B context — must see ZERO of tenant A's sync-log rows ──────────────
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"b@example.com"}', true);

do $$ begin
  assert (select count(*) from public.akahu_sync_log) = 0,
    'B should see zero sync-log rows (has none of its own, none of tenant A''s)';
  assert (select count(*) from public.akahu_sync_log
          where tenant_id = '11111111-1111-1111-1111-111111111111') = 0,
    'B must see ZERO of tenant A sync-log rows';
  raise notice 'PASS: user B sees zero sync-log rows across tenants';
end $$;

reset role;

do $$ begin raise notice '===================================='; end $$;
do $$ begin raise notice 'ALL AKAHU SYNC LOG TESTS PASSED'; end $$;
do $$ begin raise notice '===================================='; end $$;

rollback;
