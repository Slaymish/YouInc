-- =============================================================================
-- YouInc — classification_rules RLS tenant-isolation test (per-tenant rules editor)
-- =============================================================================
-- Proves the classification_rules_tenant policy (migration 20260704120002)
-- actually confines rule CRUD to the caller's own tenant, matching the
-- guarantees already proven for raw_transactions in rls_isolation.sql. Run
-- against a local Supabase stack:
--
--   docker exec -i supabase_db_YouInc \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/classification_rules_isolation.sql
--
-- Any failed assertion aborts with a nonzero exit. "ALL CLASSIFICATION_RULES
-- ISOLATION TESTS PASSED" prints only if every assertion held. Wrapped in a
-- rolled-back transaction so it leaves no residue and is re-runnable.
--
-- Note on mechanics: the table's policy is `for all using (...) with check
-- (...)`. Those two clauses fail differently for a cross-tenant actor:
--   * INSERT (or an UPDATE that would move a row into another tenant) trips
--     WITH CHECK and raises.
--   * UPDATE/DELETE of a row that already belongs to another tenant never
--     raises — USING makes the row invisible, so the statement just matches
--     zero rows. We assert on rowcount + "value unchanged", not on an
--     exception, for that direction.
-- =============================================================================
begin;

-- ── Setup (as postgres; BYPASSRLS, so seeding ignores policies) ──────────────
insert into public.tenants (id, name, slug, tier) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A', 'rules-a', 'self-serve'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B', 'rules-b', 'self-serve');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- Seed rules directly: 2 for A, 1 for B (bypassing RLS as postgres).
insert into public.classification_rules
  (tenant_id, rule_key, seq, priority, route_target_account, match_description_regex)
values
  ('11111111-1111-1111-1111-111111111111', 'a_rule_1', 0, 100, 'Expenses:A1', 'coffee'),
  ('11111111-1111-1111-1111-111111111111', 'a_rule_2', 1, 200, 'Expenses:A2', 'lunch'),
  ('22222222-2222-2222-2222-222222222222', 'b_rule_1', 0, 100, 'Expenses:B1', 'groceries');

-- ── Anonymous: no grant on classification_rules at all ───────────────────────
set local role anon;
do $$ begin
  begin
    perform count(*) from public.classification_rules;
    raise exception 'TEST FAILED: anon was able to read classification_rules';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no SELECT privilege on classification_rules';
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: anon read blocked (%)', sqlerrm;
  end;
end $$;
reset role;

-- ── User A context ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"a@example.com"}', true);

do $$ begin
  assert (select count(*) from public.classification_rules) = 2,
    'A: should see only its own 2 rules';
  assert (select count(*) from public.classification_rules
          where tenant_id = '22222222-2222-2222-2222-222222222222') = 0,
    'A: must see ZERO of tenant B rules';
  raise notice 'PASS: user A sees only tenant A rules (2 rules, 0 cross-tenant)';
end $$;

-- A can create a rule in its own tenant (the requireTenantId() + createRule
-- happy path this editor relies on).
do $$ begin
  insert into public.classification_rules
    (tenant_id, rule_key, seq, priority, route_target_account, match_merchant_regex)
  values ('11111111-1111-1111-1111-111111111111', 'a_rule_3', 2, 300, 'Expenses:A3', 'spark');
  assert (select count(*) from public.classification_rules
          where tenant_id = '11111111-1111-1111-1111-111111111111') = 3,
    'A: insert into its own tenant should succeed and be visible';
  raise notice 'PASS: A can insert a rule into its own tenant';
end $$;

-- WITH CHECK: A must not be able to insert a rule into tenant B.
do $$ begin
  begin
    insert into public.classification_rules
      (tenant_id, rule_key, seq, priority, route_target_account, match_merchant_regex)
    values ('22222222-2222-2222-2222-222222222222', 'evil', 99, 1, 'Expenses:Evil', 'x');
    raise exception 'TEST FAILED: A was able to insert a rule into tenant B (WITH CHECK breach)';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: WITH CHECK blocked A inserting a rule into tenant B';
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: cross-tenant rule insert rejected (%)', sqlerrm;
  end;
end $$;

-- USING: A's UPDATE/DELETE of tenant B's rule matches zero rows (B's row is
-- invisible to A), not an exception — and B's row is left untouched.
do $$
declare
  b_rule_id uuid;
  b_target_before text;
begin
  select id, route_target_account into b_rule_id, b_target_before
  from public.classification_rules
  where tenant_id = '22222222-2222-2222-2222-222222222222' and rule_key = 'b_rule_1';

  update public.classification_rules
  set route_target_account = 'Expenses:Hijacked'
  where id = b_rule_id;
  if found then
    raise exception 'TEST FAILED: A''s UPDATE matched tenant B''s row';
  end if;
  raise notice 'PASS: A''s UPDATE of tenant B''s rule matched zero rows';

  delete from public.classification_rules where id = b_rule_id;
  if found then
    raise exception 'TEST FAILED: A''s DELETE matched tenant B''s row';
  end if;
  raise notice 'PASS: A''s DELETE of tenant B''s rule matched zero rows';
end $$;

-- Confirm as postgres (bypassing RLS) that B's row is completely untouched.
do $$ begin
  set local role postgres;
  assert (select route_target_account from public.classification_rules
          where tenant_id = '22222222-2222-2222-2222-222222222222' and rule_key = 'b_rule_1')
         = 'Expenses:B1',
    'B''s rule must be unchanged after A''s blocked update attempt';
  assert exists (
    select 1 from public.classification_rules
    where tenant_id = '22222222-2222-2222-2222-222222222222' and rule_key = 'b_rule_1'
  ), 'B''s rule must still exist after A''s blocked delete attempt';
  raise notice 'PASS: tenant B''s rule is unchanged and still exists';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","email":"a@example.com"}', true);
end $$;

-- ── User B context (owner of tenant B) ───────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","email":"b@example.com"}', true);

do $$ begin
  assert (select count(*) from public.classification_rules) = 1,
    'B should see only its own 1 rule';
  update public.classification_rules
  set priority = 50
  where tenant_id = '22222222-2222-2222-2222-222222222222' and rule_key = 'b_rule_1';
  assert (select priority from public.classification_rules where rule_key = 'b_rule_1') = 50,
    'B should be able to update its own rule';
  raise notice 'PASS: owner B sees + can update its own rule';
end $$;

-- ── User C context (no memberships) — unaffiliated / "unauthenticated app
--    logic" analogue: requireTenantId() would 401/409 in the app layer for a
--    user like this; at the RLS layer they simply see nothing. ──────────────
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","email":"c@example.com"}', true);

do $$ begin
  assert (select count(*) from public.classification_rules) = 0,
    'C: unaffiliated user should see ZERO classification_rules';
  begin
    insert into public.classification_rules
      (tenant_id, rule_key, seq, priority, route_target_account, match_merchant_regex)
    values ('11111111-1111-1111-1111-111111111111', 'c_evil', 50, 1, 'Expenses:Evil', 'x');
    raise exception 'TEST FAILED: unaffiliated C was able to insert a rule into tenant A';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: WITH CHECK blocked unaffiliated C inserting into tenant A';
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: unaffiliated insert rejected (%)', sqlerrm;
  end;
end $$;

reset role;

do $$ begin raise notice '====================================================='; end $$;
do $$ begin raise notice 'ALL CLASSIFICATION_RULES ISOLATION TESTS PASSED'; end $$;
do $$ begin raise notice '====================================================='; end $$;

rollback;
