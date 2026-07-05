-- =============================================================================
-- YouInc — Free tenant tier test
-- Run: docker exec -i supabase_db_YouInc \
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/tenant_tier_free.sql
--
-- Proves the migrations in 20260705150000_tenant_tier_free.sql and
-- 20260705150001_create_tenant_default_free.sql:
--   * tenants.tier accepts 'free' (in addition to 'self-serve'/'concierge');
--   * the tenants_tier_check constraint still rejects any other value;
--   * create_tenant() now defaults brand-new self-registered tenants to 'free',
--     not 'self-serve' — the paid tier that funds live Akahu sync must be an
--     explicit upgrade, never the signup default;
--   * a tenant can still be provisioned directly at 'self-serve' or
--     'concierge' (operator-provisioned path, unaffected by the RPC default).
--
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

-- ── tenants.tier accepts all three values ────────────────────────────────────
insert into public.tenants (id, name, slug, tier) values
  ('f1111111-1111-1111-1111-111111111111', 'Free Co',      'free-co',      'free'),
  ('f2222222-2222-2222-2222-222222222222', 'Self-serve Co','self-serve-co','self-serve'),
  ('f3333333-3333-3333-3333-333333333333', 'Concierge Co', 'concierge-co', 'concierge');

do $$ begin
  assert (select tier from public.tenants where slug = 'free-co') = 'free',
    'tenants.tier should accept ''free''';
  assert (select tier from public.tenants where slug = 'self-serve-co') = 'self-serve',
    'tenants.tier should still accept ''self-serve''';
  assert (select tier from public.tenants where slug = 'concierge-co') = 'concierge',
    'tenants.tier should still accept ''concierge''';
  raise notice 'PASS: tenants.tier accepts free / self-serve / concierge';
end $$;

-- ── tenants_tier_check still rejects anything else ───────────────────────────
do $$ begin
  begin
    insert into public.tenants (name, slug, tier) values ('Bad Co', 'bad-co', 'trial');
    raise exception 'TEST FAILED: an invalid tier value was accepted';
  exception
    when check_violation then
      raise notice 'PASS: tenants_tier_check rejects an unrecognized tier value';
  end;
end $$;

-- ── create_tenant() now defaults to 'free', not 'self-serve' ─────────────────
insert into auth.users (id, email) values
  ('f4444444-4444-4444-4444-444444444444', 'freda@example.com');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f4444444-4444-4444-4444-444444444444","role":"authenticated","email":"freda@example.com"}', true);

do $$
declare t public.tenants;
begin
  t := public.create_tenant('Freda Holdings');
  assert t.tier = 'free',
    'create_tenant: new self-registered tenants must default to the free tier, '
    'not self-serve — self-serve is the paid tier that funds live Akahu sync';
  raise notice 'PASS: create_tenant defaults new signups to the free tier (tenant=%)', t.id;
end $$;

reset role;

do $$ begin raise notice '===================================='; end $$;
do $$ begin raise notice 'ALL FREE TIER TESTS PASSED'; end $$;
do $$ begin raise notice '===================================='; end $$;

rollback;
