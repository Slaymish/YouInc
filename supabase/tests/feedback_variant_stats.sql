-- =============================================================================
-- YouInc — feedback_variant_stats RPC test
-- Run: docker exec -i supabase_db_YouInc \
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/feedback_variant_stats.sql
--
-- Proves the admin-only aggregate read path over public.feedback:
--   * anon cannot execute feedback_variant_stats at all (no EXECUTE grant);
--   * an authenticated-but-non-admin caller gets insufficient_privilege from
--     inside the function body (is_app_admin() check);
--   * an app_admins member CAN execute it and gets correct up/down/total/
--     up_rate aggregates for seeded variant/source/path combos;
--   * p_since filters out rows before the cutoff;
--   * the returned rows never carry `note` or `id` — aggregates only.
--
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

-- Seed two auth users: one will be an app admin, one won't.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('b0000000-0000-0000-0000-00000000000b', 'nonadmin@example.com');

insert into public.app_admins (user_id) values
  ('a0000000-0000-0000-0000-00000000000a');

-- Seed known feedback rows across two variants, two sources/paths.
insert into public.feedback (vote, note, variant, source, path) values
  ('up',   'love it', 'A', 'landing', '/'),
  ('up',   null,      'A', 'landing', '/'),
  ('down', 'meh',     'A', 'landing', '/'),
  ('up',   null,      'B', 'landing', '/'),
  ('down', null,      'B', 'landing', '/'),
  ('down', null,      'B', 'landing', '/'),
  ('up',   null,      'A', 'demo',    '/demo');

-- ── anon cannot execute feedback_variant_stats at all (no EXECUTE grant) ─────
set local role anon;
do $$
begin
  begin
    perform public.feedback_variant_stats();
    raise exception 'TEST FAILED: anon must NOT be able to call feedback_variant_stats';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon cannot execute feedback_variant_stats (permission denied)';
  end;
end $$;

-- ── authenticated-but-non-admin gets insufficient_privilege from is_app_admin() ─
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","email":"nonadmin@example.com"}', true);
do $$
begin
  begin
    perform public.feedback_variant_stats();
    raise exception 'TEST FAILED: non-admin must NOT be able to read feedback stats';
  exception
    when insufficient_privilege then
      raise notice 'PASS: non-admin authenticated user gets insufficient_privilege';
  end;
end $$;

-- ── admin user CAN execute it and gets correct aggregates ────────────────────
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","email":"admin@example.com"}', true);

do $$
declare
  r record;
begin
  select * into r from public.feedback_variant_stats()
    where variant = 'A' and source = 'landing' and path = '/';
  assert r.up_count = 2,   'A/landing// up_count should be 2';
  assert r.down_count = 1, 'A/landing// down_count should be 1';
  assert r.total = 3,      'A/landing// total should be 3';
  assert r.up_rate = round(2::numeric / 3, 4), 'A/landing// up_rate should be 2/3 rounded to 4dp';

  select * into r from public.feedback_variant_stats()
    where variant = 'B' and source = 'landing' and path = '/';
  assert r.up_count = 1,   'B/landing// up_count should be 1';
  assert r.down_count = 2, 'B/landing// down_count should be 2';
  assert r.total = 3,      'B/landing// total should be 3';
  assert r.up_rate = round(1::numeric / 3, 4), 'B/landing// up_rate should be 1/3 rounded to 4dp';

  select * into r from public.feedback_variant_stats()
    where variant = 'A' and source = 'demo' and path = '/demo';
  assert r.up_count = 1,   'A/demo//demo up_count should be 1';
  assert r.down_count = 0, 'A/demo//demo down_count should be 0';
  assert r.total = 1,      'A/demo//demo total should be 1';
  assert r.up_rate = 1,    'A/demo//demo up_rate should be 1 (all up)';

  assert (select count(*) from public.feedback_variant_stats()) = 3,
    'exactly 3 grouped rows expected for the seeded variant/source/path combos';

  raise notice 'PASS: admin gets correct aggregates for all seeded variant/source/path combos';
end $$;

-- p_since in the future should exclude every seeded row.
do $$
declare n int;
begin
  select count(*) into n from public.feedback_variant_stats(now() + interval '1 hour');
  assert n = 0, 'p_since in the future should exclude all seeded rows';
  raise notice 'PASS: p_since filters out rows created before the cutoff';
end $$;

-- ── returned rows never include note or any per-row/id data (aggregates only) ─
do $$
declare row_keys text[];
begin
  -- Limit to one row as a plain table first, THEN expand its keys — doing the
  -- LIMIT and jsonb_object_keys() in the same SELECT would zip the two
  -- set-returning expansions together and truncate to a single key.
  select array_agg(k) into row_keys
  from (
    select jsonb_object_keys(to_jsonb(one_row)) as k
    from (select * from public.feedback_variant_stats() limit 1) as one_row
  ) sub;
  assert not (row_keys @> array['note']), 'feedback_variant_stats must never expose note';
  assert not (row_keys @> array['id']),   'feedback_variant_stats must never expose id';
  assert row_keys @> array['variant','source','path','up_count','down_count','total','up_rate'],
    'feedback_variant_stats must expose exactly the documented aggregate columns';
  raise notice 'PASS: feedback_variant_stats returns aggregates only (no note/id/per-row data)';
end $$;

rollback;
