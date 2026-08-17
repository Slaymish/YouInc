-- =============================================================================
-- YouInc — Self-registration test (P4 verification)
-- =============================================================================
-- Proves the public signup path works end to end under RLS:
--   * inserting an auth.users row auto-creates a public.profiles row (trigger);
--   * create_tenant() lets a brand-new authenticated user (no membership yet)
--     create their own tenant and become its owner;
--   * after creation the owner sees exactly their tenant and nothing else;
--   * a second user's tenant is fully isolated from the first;
--   * create_tenant rejects a blank name and an unauthenticated caller;
--   * generated slugs are unique even for identical tenant names.
--
--   docker exec -i supabase_db_YouInc \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/self_registration.sql
--
-- Wrapped in a rolled-back transaction — re-runnable, leaves no residue.
-- =============================================================================
begin;

-- ── Trigger: a new auth user gets a profile automatically ────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dana@example.com',
   '{"display_name":"Dana Owner"}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'evan@example.com', '{}'::jsonb);

do $$ begin
  assert (select display_name from public.profiles
          where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') = 'Dana Owner',
    'trigger: profile display_name should come from raw_user_meta_data.display_name';
  assert (select display_name from public.profiles
          where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') = 'evan',
    'trigger: profile display_name should fall back to the email local-part';
  raise notice 'PASS: handle_new_user auto-provisions profiles from signup metadata';
end $$;

-- ── User D self-registers a tenant ───────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated","email":"dana@example.com"}', true);

do $$
declare t public.tenants;
begin
  t := public.create_tenant('Dana Holdings');
  assert t.name = 'Dana Holdings', 'create_tenant: name should be stored verbatim';
  assert t.slug like 'dana-holdings-%', 'create_tenant: slug should derive from the name';
  assert t.default_currency = 'NZD', 'create_tenant: default currency should be NZD';
  raise notice 'PASS: create_tenant created Dana''s tenant (slug=%)', t.slug;
end $$;

-- D is now the owner and sees exactly their own tenant + membership.
do $$ begin
  assert (select count(*) from public.tenants) = 1,
    'D: should see exactly the tenant they just created';
  assert (select count(*) from public.user_tenant_ids()) = 1,
    'D: should belong to exactly one tenant after self-registration';
  assert (select public.has_tenant_role(
            (select id from public.tenants limit 1), array['owner'])),
    'D: should be owner of the tenant they created';
  raise notice 'PASS: self-registered user is owner of their new tenant';
end $$;

-- ── User E self-registers a tenant with the SAME name — slugs must differ ─────
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated","email":"evan@example.com"}', true);

do $$
declare t public.tenants;
begin
  t := public.create_tenant('Dana Holdings');   -- deliberately identical name
  raise notice 'PASS: second identical-name signup succeeded (slug=%)', t.slug;
end $$;

-- E sees only their own tenant — full isolation from D's identically-named one.
do $$ begin
  assert (select count(*) from public.tenants) = 1,
    'E: must see only their own tenant, not D''s (isolation)';
  assert (select count(*) from public.raw_transactions) = 0,
    'E: brand-new tenant has no ledger rows';
  raise notice 'PASS: two same-named self-registered tenants are fully isolated';
end $$;

-- ── Validation: blank name is rejected ───────────────────────────────────────
do $$ begin
  begin
    perform public.create_tenant('   ');
    raise exception 'TEST FAILED: blank tenant name was accepted';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: blank tenant name rejected (%)', sqlerrm;
  end;
end $$;

-- ── Slug uniqueness holds across the whole table ─────────────────────────────
reset role;
do $$ begin
  assert (select count(*) from public.tenants)
       = (select count(distinct slug) from public.tenants),
    'slugs must be unique across all tenants';
  raise notice 'PASS: all generated tenant slugs are unique';
end $$;

-- ── Unauthenticated caller is rejected ───────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform public.create_tenant('Anon Co');
    raise exception 'TEST FAILED: anonymous caller created a tenant';
  exception
    when others then
      if sqlerrm like 'TEST FAILED%' then raise; end if;
      raise notice 'PASS: unauthenticated create_tenant rejected (%)', sqlerrm;
  end;
end $$;

reset role;

do $$ begin raise notice '===================================='; end $$;
do $$ begin raise notice 'ALL SELF-REGISTRATION TESTS PASSED'; end $$;
do $$ begin raise notice '===================================='; end $$;

rollback;
