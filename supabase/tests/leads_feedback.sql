-- =============================================================================
-- YouInc — Leads/Feedback RPC test
-- Run: docker exec -i supabase_db_YouInc \
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/leads_feedback.sql
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

-- ── record_lead upserts + dedupes by email (as the anon role) ────────────────
set local role anon;
do $$
begin
  perform public.record_lead('dup@b.com', null, 'self-serve', 'hero', 'ua1');
  perform public.record_lead('dup@b.com', null, 'concierge', 'pricing', 'ua2');
end $$;
set local role postgres;
do $$
declare n int; src text;
begin
  select count(*), max(source) into n, src from public.leads where email = 'dup@b.com';
  assert n = 1, 'record_lead must upsert, not duplicate';
  assert src = 'pricing', 'record_lead must update on conflict';
  raise notice 'PASS: record_lead upserts by email';
end $$;

-- ── record_feedback inserts (as the anon role) ───────────────────────────────
set local role anon;
select public.record_feedback('up', 'nice', 'A', 'landing', '/');
set local role postgres;
do $$
declare n int;
begin
  select count(*) into n from public.feedback where source = 'landing';
  assert n = 1, 'record_feedback must insert a row';
  raise notice 'PASS: record_feedback inserts';
end $$;

-- ── anon can call the RPCs but CANNOT read the tables directly ────────────────
set local role anon;
do $$
begin
  begin
    perform 1 from public.leads limit 1;
    raise exception 'anon must NOT be able to SELECT leads';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot SELECT leads';
  end;
  begin
    perform 1 from public.feedback limit 1;
    raise exception 'anon must NOT be able to SELECT feedback';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot SELECT feedback';
  end;
end $$;

rollback;
