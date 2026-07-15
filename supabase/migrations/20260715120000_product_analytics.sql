-- =============================================================================
-- YouInc — privacy-safe first-party product analytics
-- =============================================================================
-- Append-only business events for the acquisition -> activation -> recurring
-- value funnel. Raw rows are never client-readable. Browser writes are limited
-- to a small allowlist of coarse intent/view events; durable success outcomes
-- are captured from database triggers, so the dashboard does not rely on a
-- browser claiming that a signup, connection, or sync succeeded.

create table public.analytics_events (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),
  event_name    text not null,
  event_version smallint not null default 1,
  user_id       uuid references auth.users (id) on delete set null,
  tenant_id     uuid references public.tenants (id) on delete set null,
  anonymous_id  uuid,
  session_id    uuid,
  source        text not null check (source in ('client', 'server', 'backfill')),
  properties    jsonb not null default '{}'::jsonb,
  constraint analytics_events_properties_object check (jsonb_typeof(properties) = 'object')
);

create index analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at desc);
create index analytics_events_tenant_time_idx
  on public.analytics_events (tenant_id, occurred_at desc)
  where tenant_id is not null;
create index analytics_events_user_time_idx
  on public.analytics_events (user_id, occurred_at desc)
  where user_id is not null;
create unique index analytics_events_first_ledger_value_idx
  on public.analytics_events (tenant_id)
  where event_name = 'ledger_value_created' and tenant_id is not null;
create unique index analytics_events_client_session_dedupe_idx
  on public.analytics_events (event_name, anonymous_id, session_id, properties)
  where source = 'client' and anonymous_id is not null and session_id is not null;

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

-- Public/client event boundary. Identity and tenant are inferred from the
-- session; callers can never choose a user_id or tenant_id. Values are short,
-- coarse labels only: URLs, emails, account ids, balances and free text do not
-- belong in this table.
create or replace function public.record_analytics_event(
  p_event_name   text,
  p_anonymous_id uuid default null,
  p_session_id   uuid default null,
  p_properties   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
  caller_tenant uuid;
  allowed_keys text[];
  property_key text;
  property_value text;
  property_type text;
begin
  case p_event_name
    when 'marketing_cta_clicked' then allowed_keys := array['placement']::text[];
    when 'signup_started' then allowed_keys := array['entrypoint']::text[];
    when 'onboarding_started' then allowed_keys := array[]::text[];
    when 'sample_data_loaded' then allowed_keys := array['source']::text[];
    when 'akahu_connect_started' then allowed_keys := array['source']::text[];
    when 'akahu_oauth_failed' then allowed_keys := array['reason']::text[];
    when 'dashboard_viewed' then allowed_keys := array[]::text[];
    when 'settings_opened' then allowed_keys := array[]::text[];
    else raise sqlstate '23514' using message = 'unknown analytics event';
  end case;

  if p_properties is null or jsonb_typeof(p_properties) <> 'object'
     or pg_column_size(p_properties) > 1024 then
    raise sqlstate '23514' using message = 'invalid analytics properties';
  end if;

  for property_key, property_value, property_type in
    select key, value #>> '{}', jsonb_typeof(value) from jsonb_each(p_properties)
  loop
    if not (property_key = any(allowed_keys))
       or property_type <> 'string'
       or property_value is null
       or not (
         (p_event_name = 'marketing_cta_clicked' and property_key = 'placement'
           and property_value in ('pricing-table', 'quiz-reveal'))
         or (p_event_name = 'signup_started' and property_key = 'entrypoint'
           and property_value = 'signup')
         or (p_event_name = 'sample_data_loaded' and property_key = 'source'
           and property_value = 'workspace')
         or (p_event_name = 'akahu_connect_started' and property_key = 'source'
           and property_value = 'settings')
         or (p_event_name = 'akahu_oauth_failed' and property_key = 'reason'
           and property_value in ('denied', 'state', 'identity', 'exchange'))
       ) then
      raise sqlstate '23514' using message = 'invalid analytics property value';
    end if;
  end loop;

  if caller is not null then
    select m.tenant_id into caller_tenant
    from public.memberships m
    where m.user_id = caller and m.status = 'active'
    order by m.created_at
    limit 1;
  end if;

  if caller is null and (p_anonymous_id is null or p_session_id is null) then
    raise sqlstate '23514' using message = 'anonymous analytics identity is required';
  end if;

  insert into public.analytics_events (
    event_name, user_id, tenant_id, anonymous_id, session_id, source, properties
  ) values (
    p_event_name, caller, caller_tenant, p_anonymous_id, p_session_id, 'client', p_properties
  ) on conflict do nothing;
end;
$$;

revoke execute on function public.record_analytics_event(text, uuid, uuid, jsonb) from public;
grant execute on function public.record_analytics_event(text, uuid, uuid, jsonb)
  to anon, authenticated;

-- Internal trigger helper. It deliberately has no client EXECUTE grant.
create or replace function public.capture_product_event(
  p_event_name text,
  p_user_id uuid,
  p_tenant_id uuid,
  p_properties jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now(),
  p_source text default 'server'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.analytics_events (
    event_name, user_id, tenant_id, source, properties, occurred_at
  ) values (
    p_event_name, p_user_id, p_tenant_id, p_source, p_properties, p_occurred_at
  );
$$;
revoke execute on function public.capture_product_event(text, uuid, uuid, jsonb, timestamptz, text)
  from public;

create or replace function public.analytics_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.capture_product_event('signup_succeeded', new.id, null, '{}', new.created_at);
  if new.email_confirmed_at is not null then
    perform public.capture_product_event('email_confirmed', new.id, null, '{}', new.email_confirmed_at);
  end if;
  return new;
end;
$$;
create trigger on_auth_user_analytics_created
  after insert on auth.users for each row execute function public.analytics_auth_user_created();

create or replace function public.analytics_auth_user_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.capture_product_event('email_confirmed', new.id, null, '{}', new.email_confirmed_at);
  end if;
  return new;
end;
$$;
create trigger on_auth_user_analytics_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.analytics_auth_user_confirmed();

create or replace function public.analytics_tenant_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.capture_product_event(
    'workspace_created', (select auth.uid()), new.id, '{}', new.created_at
  );
  return new;
end;
$$;
create trigger trg_analytics_tenant_created
  after insert on public.tenants
  for each row execute function public.analytics_tenant_created();

create or replace function public.analytics_manual_account_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.capture_product_event('manual_account_created', (select auth.uid()), new.tenant_id);
  return new;
end;
$$;
create trigger trg_analytics_manual_account_created
  after insert on public.manual_account_balances
  for each row execute function public.analytics_manual_account_created();

-- First real ledger value, regardless of whether it came from sample data or
-- Akahu. The partial unique index makes this a once-per-workspace milestone.
create or replace function public.analytics_first_ledger_value()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.analytics_events (
    event_name, user_id, tenant_id, source, occurred_at
  ) values (
    'ledger_value_created', (select auth.uid()), new.tenant_id, 'server', new.created_at
  )
  on conflict (tenant_id) where event_name = 'ledger_value_created' and tenant_id is not null
  do nothing;
  return new;
end;
$$;
create trigger trg_analytics_first_ledger_value
  after insert on public.journal_transactions
  for each row execute function public.analytics_first_ledger_value();

create or replace function public.analytics_akahu_connection_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    perform public.capture_product_event('akahu_connection_created', new.user_id, new.tenant_id, '{}', new.connected_at);
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status is distinct from 'active' then
    perform public.capture_product_event('akahu_connection_created', new.user_id, new.tenant_id, '{}', new.connected_at);
  end if;
  return new;
end;
$$;
create trigger trg_analytics_akahu_connection_changed
  after insert or update of status on public.akahu_connections
  for each row execute function public.analytics_akahu_connection_changed();

create or replace function public.analytics_sync_log_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.capture_product_event('sync_started', (select auth.uid()), new.tenant_id, '{}', new.started_at);
  elsif old.status = 'running' and new.status in ('success', 'error') then
    perform public.capture_product_event(
      case new.status when 'success' then 'sync_succeeded' else 'sync_failed' end,
      (select auth.uid()), new.tenant_id, '{}', coalesce(new.finished_at, now())
    );
  end if;
  return new;
end;
$$;
create trigger trg_analytics_sync_log_changed
  after insert or update of status on public.akahu_sync_log
  for each row execute function public.analytics_sync_log_changed();

-- Seed existing lifecycle outcomes so the admin page is useful immediately.
insert into public.analytics_events (event_name, user_id, source, occurred_at)
select 'signup_succeeded', id, 'backfill', created_at from auth.users;
insert into public.analytics_events (event_name, user_id, source, occurred_at)
select 'email_confirmed', id, 'backfill', email_confirmed_at
from auth.users where email_confirmed_at is not null;
insert into public.analytics_events (event_name, user_id, tenant_id, source, occurred_at)
select 'workspace_created', owner.user_id, t.id, 'backfill', t.created_at
from public.tenants t
left join lateral (
  select m.user_id from public.memberships m
  where m.tenant_id = t.id and m.role = 'owner'
  order by m.created_at limit 1
) owner on true;
insert into public.analytics_events (event_name, tenant_id, source, occurred_at)
select distinct on (tenant_id) 'ledger_value_created', tenant_id, 'backfill', created_at
from public.journal_transactions
order by tenant_id, created_at;
insert into public.analytics_events (event_name, user_id, tenant_id, source, occurred_at)
select 'akahu_connection_created', user_id, tenant_id, 'backfill', connected_at
from public.akahu_connections where status = 'active';
insert into public.analytics_events (event_name, tenant_id, source, occurred_at)
select case status when 'success' then 'sync_succeeded' else 'sync_failed' end,
       tenant_id, 'backfill', coalesce(finished_at, started_at)
from public.akahu_sync_log where status in ('success', 'error');

-- One aggregate payload for the owner dashboard. No raw IDs, properties, or
-- per-user rows cross this boundary.
create or replace function public.product_analytics_summary(
  p_since timestamptz default (now() - interval '30 days')
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  p_since := coalesce(p_since, now() - interval '30 days');

  if not public.is_app_admin() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  with
  workspace_counts as (
    select
      count(distinct tenant_id) filter (
        where event_name = 'workspace_created' and occurred_at >= p_since
      ) as created,
      count(distinct tenant_id) filter (
        where event_name = 'workspace_created'
          and occurred_at >= p_since
          and occurred_at <= now() - interval '7 days'
      ) as activation_eligible,
      count(distinct tenant_id) filter (
        where event_name = 'workspace_created' and occurred_at >= now() - interval '7 days'
      ) as created_7d
    from public.analytics_events
  ),
  activated as (
    select count(distinct created.tenant_id) as total
    from public.analytics_events created
    where created.event_name = 'workspace_created'
      and created.occurred_at >= p_since
      and created.occurred_at <= now() - interval '7 days'
      and exists (
        select 1 from public.analytics_events value_event
        where value_event.tenant_id = created.tenant_id
          and value_event.event_name in ('manual_account_created', 'ledger_value_created')
          and value_event.occurred_at between created.occurred_at and created.occurred_at + interval '7 days'
      )
  ),
  engaged as (
    select count(distinct view_event.tenant_id) as total
    from public.analytics_events view_event
    where view_event.event_name = 'dashboard_viewed'
      and view_event.occurred_at >= now() - interval '7 days'
      and view_event.tenant_id is not null
      and exists (
        select 1 from public.analytics_events value_event
        where value_event.tenant_id = view_event.tenant_id
          and value_event.event_name in ('manual_account_created', 'ledger_value_created')
          and value_event.occurred_at <= view_event.occurred_at
      )
  ),
  signup_cohort as (
    select user_id, min(occurred_at) as signed_up_at
    from public.analytics_events
    where event_name = 'signup_succeeded' and occurred_at >= p_since and user_id is not null
    group by user_id
  ),
  confirmed_users as (
    select s.user_id, s.signed_up_at
    from signup_cohort s
    where exists (
      select 1 from public.analytics_events e
      where e.event_name = 'email_confirmed' and e.user_id = s.user_id
        and e.occurred_at >= s.signed_up_at
    )
  ),
  workspace_cohort as (
    select distinct on (s.user_id)
      s.user_id, e.tenant_id, e.occurred_at as workspace_created_at
    from confirmed_users s
    join public.analytics_events e
      on e.event_name = 'workspace_created' and e.user_id = s.user_id
      and e.occurred_at >= s.signed_up_at and e.tenant_id is not null
    order by s.user_id, e.occurred_at
  ),
  valued_cohort as (
    select w.user_id, w.tenant_id, min(e.occurred_at) as valued_at
    from workspace_cohort w
    join public.analytics_events e
      on e.tenant_id = w.tenant_id
      and e.event_name in ('manual_account_created', 'ledger_value_created')
      and e.occurred_at >= w.workspace_created_at
    group by w.user_id, w.tenant_id
  ),
  viewed_value_cohort as (
    select v.user_id, v.tenant_id
    from valued_cohort v
    where exists (
      select 1 from public.analytics_events e
      where e.event_name = 'dashboard_viewed' and e.tenant_id = v.tenant_id
        and e.occurred_at >= v.valued_at
    )
  ),
  sync_health as (
    select
      count(*) filter (where event_name = 'sync_succeeded') as succeeded,
      count(*) filter (where event_name = 'sync_failed') as failed
    from public.analytics_events where occurred_at >= p_since
  ),
  funnel(position, event_name, label, total) as (
    select 1, 'signup_succeeded', 'Account created', count(*) from signup_cohort
    union all select 2, 'email_confirmed', 'Email confirmed', count(*) from confirmed_users
    union all select 3, 'workspace_created', 'Workspace created', count(*) from workspace_cohort
    union all select 4, 'value_created', 'First financial value', count(*) from valued_cohort
    union all select 5, 'dashboard_after_value', 'Returned to dashboard', count(*) from viewed_value_cohort
  ),
  value_events(position, event_name, label) as (values
    (1, 'ledger_value_created', 'Live ledger reached first value'),
    (2, 'sync_succeeded', 'Bank sync succeeded'),
    (3, 'dashboard_viewed', 'Dashboard used'),
    (4, 'akahu_connection_created', 'Bank connection completed'),
    (5, 'manual_account_created', 'Manual account added'),
    (6, 'workspace_created', 'Workspace created'),
    (7, 'email_confirmed', 'Email confirmed'),
    (8, 'signup_succeeded', 'Account created')
  ),
  top_events as (
    select v.position, v.event_name, v.label, count(e.id) as total
    from value_events v
    left join public.analytics_events e
      on e.event_name = v.event_name and e.occurred_at >= p_since
    group by v.position, v.event_name, v.label
    order by v.position
  ),
  days as (
    select generate_series(
      date_trunc('day', greatest(p_since, now() - interval '13 days')),
      date_trunc('day', now()), interval '1 day'
    ) as day
  ),
  daily as (
    select d.day, count(e.id) as total
    from days d
    left join public.analytics_events e
      on e.occurred_at >= d.day and e.occurred_at < d.day + interval '1 day'
      and e.event_name in (
        'ledger_value_created', 'sync_succeeded', 'dashboard_viewed',
        'akahu_connection_created', 'manual_account_created', 'workspace_created'
      )
    group by d.day order by d.day
  )
  select jsonb_build_object(
    'since', p_since,
    'generated_at', now(),
    'kpis', jsonb_build_object(
      'engaged_workspaces_7d', (select total from engaged),
      'workspaces_created', (select created from workspace_counts),
      'activation_eligible_workspaces', (select activation_eligible from workspace_counts),
      'workspaces_created_7d', (select created_7d from workspace_counts),
      'activated_workspaces', (select total from activated),
      'activation_rate', (
        select case when wc.activation_eligible = 0 then null
          else round(a.total::numeric / wc.activation_eligible, 4) end
        from workspace_counts wc cross join activated a
      ),
      'sync_succeeded', (select succeeded from sync_health),
      'sync_failed', (select failed from sync_health),
      'sync_success_rate', (
        select case when succeeded + failed = 0 then null
          else round(succeeded::numeric / (succeeded + failed), 4) end
        from sync_health
      )
    ),
    'funnel', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_name', event_name, 'label', label, 'count', total
      ) order by position), '[]'::jsonb) from funnel
    ),
    'top_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_name', event_name, 'label', label, 'count', total
      ) order by position), '[]'::jsonb)
      from top_events
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day::date, 'count', total) order by day), '[]'::jsonb)
      from daily
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.product_analytics_summary(timestamptz) from public;
grant execute on function public.product_analytics_summary(timestamptz) to authenticated;

comment on table public.analytics_events is
  'Privacy-safe product telemetry only. Never store email, URLs, transaction/account details, balances, tokens, IPs, user agents, or free text.';
