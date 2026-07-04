-- =============================================================================
-- YouInc — RLS tenant-isolation test (P1 verification)
-- =============================================================================
-- Proves the multi-tenant isolation backbone actually holds. Run against a local
-- Supabase stack:
--
--   docker exec -i supabase_db_YouInc \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/rls_isolation.sql
--
-- Any failed assertion aborts with a nonzero exit. "ALL RLS ISOLATION TESTS
-- PASSED" prints only if every assertion held. Wrapped in a rolled-back
-- transaction so it leaves no residue and is re-runnable.
-- =============================================================================
begin;

-- ── Setup (as postgres; BYPASSRLS, so seeding ignores policies) ──────────────
insert into public.tenants (id, name, slug, tier) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'tenant-a', 'self-serve'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'tenant-b', 'concierge');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@example.com');

-- profiles are auto-created by the on_auth_user_created trigger (migration 5);
-- just set display names on the rows it already inserted.
update public.profiles set display_name = 'User A' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.profiles set display_name = 'User B' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
update public.profiles set display_name = 'User C' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- A owns tenant A; B owns tenant B; C belongs to nothing (yet).
insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- Seed ledger rows: 2 for A, 3 for B.
insert into public.raw_transactions
  (tenant_id, idempotency_hash, account_id, status, amount_cents, transaction_date, description, raw_json)
values
  ('11111111-1111-1111-1111-111111111111', 'a-hash-1', 'acc-a', 'posted', 100, '2026-01-01', 'A txn 1', '{}'),
  ('11111111-1111-1111-1111-111111111111', 'a-hash-2', 'acc-a', 'posted', 200, '2026-01-02', 'A txn 2', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'b-hash-1', 'acc-b', 'posted', 300, '2026-01-01', 'B txn 1', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'b-hash-2', 'acc-b', 'posted', 400, '2026-01-02', 'B txn 2', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'b-hash-3', 'acc-b', 'posted', 500, '2026-01-03', 'B txn 3', '{}');

-- Invites into tenant B: one open (role member), one bound to a specific email.
insert into public.invites (tenant_id, code, role, invited_email, status, expires_at) values
  ('22222222-2222-2222-2222-222222222222', 'OPEN-INVITE-B', 'member', null, 'pending', now() + interval '7 days'),
  ('22222222-2222-2222-2222-222222222222', 'BOUND-TO-B',    'member', 'b@example.com', 'pending', now() + interval '7 days');

-- ── User A context ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"a@example.com"}', true);

do $$ begin
  assert (select count(*) from public.user_tenant_ids()) = 1,
    'A: user_tenant_ids should return exactly 1 tenant';
  assert (select array_agg(user_tenant_ids) from public.user_tenant_ids())
         = array['11111111-1111-1111-1111-111111111111'::uuid],
    'A: user_tenant_ids should be tenant A only';
  assert (select count(*) from public.raw_transactions) = 2,
    'A: should see only its own 2 raw_transactions';
  assert (select count(*) from public.raw_transactions
          where tenant_id = '22222222-2222-2222-2222-222222222222') = 0,
    'A: must see ZERO of tenant B raw_transactions';
  assert (select count(*) from public.tenants) = 1,
    'A: should see only its own tenant row';
  raise notice 'PASS: user A sees only tenant A (2 txns, 0 cross-tenant)';
end $$;

-- WITH CHECK: A must not be able to write a row into tenant B.
do $$ begin
  begin
    insert into public.raw_transactions
      (tenant_id, idempotency_hash, account_id, status, amount_cents, transaction_date, description, raw_json)
    values ('22222222-2222-2222-2222-222222222222', 'evil', 'x', 'posted', 1, '2026-01-01', 'x', '{}');
    raise exception 'TEST FAILED: A was able to insert into tenant B (WITH CHECK breach)';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: WITH CHECK blocked A writing into tenant B';
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: cross-tenant insert rejected (%)', sqlerrm;
  end;
end $$;

-- ── User B context (owner of tenant B) — the ALLOW path ──────────────────────
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"b@example.com"}', true);

do $$ begin
  assert (select public.has_tenant_role('22222222-2222-2222-2222-222222222222', array['owner'])),
    'B: has_tenant_role(owner) should be TRUE for its own tenant';
  assert (select count(*) from public.invites) = 2,
    'B (owner) should see both tenant B invites (admin-only policy allows owner)';
  assert (select count(*) from public.raw_transactions) = 3,
    'B should see tenant B''s 3 raw_transactions';
  assert (select count(*) from public.memberships) = 1,
    'B should see the tenant B roster (its own membership)';
  raise notice 'PASS: owner B sees invites + roster + ledger (allow path)';
end $$;

-- ── User C context (no memberships) ──────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","email":"c@example.com"}', true);

do $$ begin
  assert (select count(*) from public.user_tenant_ids()) = 0,
    'C: unaffiliated user should belong to no tenants';
  assert (select count(*) from public.raw_transactions) = 0,
    'C: unaffiliated user should see ZERO raw_transactions';
  assert (select count(*) from public.tenants) = 0,
    'C: unaffiliated user should see ZERO tenants';
  raise notice 'PASS: unaffiliated user C sees nothing';
end $$;

-- accept_invite: C redeems the open invite into tenant B as a member.
do $$
declare m public.memberships;
begin
  m := public.accept_invite('OPEN-INVITE-B');
  assert m.tenant_id = '22222222-2222-2222-2222-222222222222',
    'accept_invite: membership should be in tenant B';
  assert m.role = 'member', 'accept_invite: role should come from the invite (member)';
  raise notice 'PASS: accept_invite created C''s membership in tenant B (role=member)';
end $$;

-- After acceptance C can see tenant B''s data (membership grants tenant scope).
do $$ begin
  assert (select count(*) from public.raw_transactions) = 3,
    'C: after accepting, should see tenant B''s 3 raw_transactions';
  raise notice 'PASS: post-acceptance C sees tenant B (3 txns)';
end $$;

-- A plain member (C) must NOT be able to read the invites table — that policy is
-- owner/admin only. Confirms invites are not leaked to rank-and-file members.
do $$ begin
  assert (select count(*) from public.invites) = 0,
    'C (member, not admin) should see ZERO invite rows';
  raise notice 'PASS: member C cannot read invites (admin-only policy holds)';
end $$;

-- Email-binding: C (c@example.com) must NOT redeem an invite bound to b@example.com.
do $$ begin
  begin
    perform public.accept_invite('BOUND-TO-B');
    raise exception 'TEST FAILED: email-bound invite accepted by wrong user';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: email-bound invite rejected for wrong user (%)', sqlerrm;
  end;
end $$;

-- ── Anonymous (public waitlist) path ─────────────────────────────────────────
set local role anon;

do $$ begin
  insert into public.leads (email, interest) values ('lead@example.com', 'self-serve');
  raise notice 'PASS: anon can insert a valid lead';
end $$;

-- anon has no SELECT grant on leads — reads must be blocked (service_role only).
do $$ begin
  begin
    if (select count(*) from public.leads) >= 0 then
      raise exception 'TEST FAILED: anon was able to read leads';
    end if;
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon cannot read leads (no SELECT grant)';
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: anon leads read blocked (%)', sqlerrm;
  end;
end $$;

reset role;

-- Back as postgres (BYPASSRLS): confirm the RPC really did mark the accepted
-- invite, and left the rejected email-bound invite pending.
do $$ begin
  assert (select status from public.invites where code = 'OPEN-INVITE-B') = 'accepted',
    'accept_invite: OPEN-INVITE-B should be marked accepted';
  assert (select status from public.invites where code = 'BOUND-TO-B') = 'pending',
    'accept_invite: rejected email-bound invite should stay pending';
  raise notice 'PASS: OPEN-INVITE-B accepted; BOUND-TO-B still pending';
end $$;

-- ── Fail-open guard: EVERY table reachable by anon/authenticated must have RLS
--    enabled AND at least one policy. A granted table with RLS off (or no
--    policy) reads/writes across all tenants — catastrophic and invisible to a
--    single-table test. This catches the whole class at once. ──────────────────
do $$
declare bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (has_table_privilege('authenticated', c.oid, 'SELECT')
         or has_table_privilege('authenticated', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'SELECT'))
    and (not c.relrowsecurity
         or not exists (select 1 from pg_policy p where p.polrelid = c.oid));
  assert bad is null,
    'FAIL-OPEN: table(s) granted to anon/authenticated without RLS+policy: ' || coalesce(bad, '');
  raise notice 'PASS: all anon/authenticated-granted tables have RLS + a policy (no fail-open)';
end $$;

do $$ begin raise notice '===================================='; end $$;
do $$ begin raise notice 'ALL RLS ISOLATION TESTS PASSED'; end $$;
do $$ begin raise notice '===================================='; end $$;

rollback;
