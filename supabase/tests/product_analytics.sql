-- YouInc first-party product analytics contract test.
-- Run after applying 20260715120000_product_analytics.sql.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'analytics-admin@example.com', '', now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'analytics-user@example.com', '', now());

insert into public.app_admins (user_id)
values ('10000000-0000-0000-0000-000000000001');

-- Public intent events are write-only and strictly allowlisted.
set local role anon;
select public.record_analytics_event(
  'marketing_cta_clicked',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '{"placement":"pricing-table"}'::jsonb
);

do $$
begin
  begin
    perform public.record_analytics_event('unknown_event', null, null, '{}'::jsonb);
    raise exception 'TEST FAILED: unknown analytics event was accepted';
  exception when check_violation then
    raise notice 'PASS: unknown analytics events are rejected';
  end;

  begin
    perform 1 from public.analytics_events;
    raise exception 'TEST FAILED: anon read analytics_events';
  exception when insufficient_privilege then
    raise notice 'PASS: raw analytics are not client-readable';
  end;
end $$;

-- A signed-in user gets their auth identity and tenant inferred by the RPC.
reset role;
insert into public.tenants (id, name, slug, tier)
values ('40000000-0000-0000-0000-000000000001', 'Analytics Inc.', 'analytics-inc', 'free');
insert into public.memberships (tenant_id, user_id, role)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'owner');

do $$
declare before_count bigint;
declare after_count bigint;
begin
  select count(*) into before_count from public.analytics_events
  where event_name = 'workspace_created'
    and tenant_id = '40000000-0000-0000-0000-000000000001';
  insert into public.memberships (tenant_id, user_id, role)
  values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner');
  select count(*) into after_count from public.analytics_events
  where event_name = 'workspace_created'
    and tenant_id = '40000000-0000-0000-0000-000000000001';
  assert after_count = before_count, 'second owner emitted duplicate workspace_created';
  raise notice 'PASS: workspace creation is tied to tenant, not owner membership';
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.record_analytics_event(
  'dashboard_viewed',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  '{}'::jsonb
);

reset role;
insert into public.journal_transactions (
  tenant_id, external_id, transaction_date, description, source_account_id, status
) values
  ('40000000-0000-0000-0000-000000000001', 'analytics-value-1', current_date, 'test', 'test', 'SETTLED'),
  ('40000000-0000-0000-0000-000000000001', 'analytics-value-2', current_date, 'test', 'test', 'SETTLED');

do $$
begin
  assert (
    select count(*) from public.analytics_events
    where event_name = 'ledger_value_created'
      and tenant_id = '40000000-0000-0000-0000-000000000001'
  ) = 1, 'first ledger value event was not once-per-workspace';
  raise notice 'PASS: first ledger value is durable and deduplicated';
end $$;

do $$
begin
  assert exists (
    select 1 from public.analytics_events
    where event_name = 'dashboard_viewed'
      and user_id = '10000000-0000-0000-0000-000000000002'
      and tenant_id = '40000000-0000-0000-0000-000000000001'
  ), 'authenticated event identity was not inferred';
  raise notice 'PASS: authenticated identity and tenant are inferred';
end $$;

-- Only an app admin can read the aggregate decision dashboard.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform public.product_analytics_summary(now() - interval '30 days');
    raise exception 'TEST FAILED: non-admin read product analytics';
  exception when insufficient_privilege then
    raise notice 'PASS: non-admin cannot read analytics summary';
  end;
end $$;

set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare result jsonb;
begin
  select public.product_analytics_summary(now() - interval '30 days') into result;
  assert result ? 'kpis', 'summary missing kpis';
  assert result ? 'funnel', 'summary missing funnel';
  assert result ? 'top_events', 'summary missing top_events';
  assert result ? 'daily', 'summary missing daily';
  raise notice 'PASS: admin receives aggregate analytics only';
end $$;

rollback;
