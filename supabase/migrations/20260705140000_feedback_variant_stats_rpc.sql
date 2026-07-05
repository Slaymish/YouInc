-- =============================================================================
-- YouInc — Variant voting stats: app_admins table + is_app_admin() + aggregate RPC
-- =============================================================================
-- Makes public.feedback (write-only since migration 20260705120000) readable
-- in aggregate, for exactly one person: an app admin. Authorization is
-- self-enforced INSIDE feedback_variant_stats() via is_app_admin() — there is
-- no service_role client in this codebase (every server fn uses the anon-key
-- session client), so the boundary has to live in Postgres, not app code.
-- Aggregates only: no raw `note` text and no per-row/id data ever leaves the
-- function. Verified by supabase/tests/feedback_variant_stats.sql.
-- =============================================================================

-- app_admins: allowlist of user_ids permitted to read feedback aggregates.
create table public.app_admins (
  user_id uuid primary key references auth.users(id)
);
-- RLS on, NO policies: only is_app_admin() (SECURITY DEFINER, owned by
-- postgres) reads this table; nothing can be read/written by anon or
-- authenticated directly. Same pattern as leads/feedback.
alter table public.app_admins enable row level security;

-- Defense in depth: Supabase's Data API auto-grants table privileges to
-- anon/authenticated on tables created by postgres — revoke them explicitly,
-- same as migration 20260705130000 does for leads/feedback.
revoke all on public.app_admins from anon, authenticated;

-- Best-effort seed of the current owner as the first admin. This is a no-op
-- if that auth.users row doesn't exist yet in this environment (e.g. a fresh
-- local/CI database created before the user ever signs up) — the on conflict
-- guard just prevents a duplicate-key error on re-run. A fresh environment
-- with no matching user needs a manual
-- `insert into public.app_admins (user_id) select id from auth.users where email = '...';`
-- once that user exists, to grant the first admin.
insert into public.app_admins (user_id)
select id from auth.users where email = 'hamish@paychase.co.nz'
on conflict (user_id) do nothing;

-- is_app_admin: membership predicate for the allowlist above. Only ever
-- called internally from other SECURITY DEFINER functions (never from an RLS
-- policy or directly by a client role), so it does not need an EXECUTE grant
-- to anon/authenticated — see grants below.
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins where user_id = (select auth.uid())
  );
$$;

-- feedback_variant_stats: aggregated variant/source/path stats for the admin
-- view. Self-enforces authorization by calling is_app_admin() before
-- touching public.feedback; raises insufficient_privilege for non-admins
-- (including anon, whose auth.uid() is null and so is never an admin).
create or replace function public.feedback_variant_stats(p_since timestamptz default null)
returns table (
  variant    text,
  source     text,
  path       text,
  up_count   bigint,
  down_count bigint,
  total      bigint,
  up_rate    numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
    select
      f.variant,
      f.source,
      f.path,
      count(*) filter (where f.vote = 'up')   as up_count,
      count(*) filter (where f.vote = 'down') as down_count,
      count(*)                                as total,
      round(
        count(*) filter (where f.vote = 'up')::numeric / nullif(count(*), 0),
        4
      ) as up_rate
    from public.feedback f
    where p_since is null or f.created_at >= p_since
    group by f.variant, f.source, f.path;
end;
$$;

-- Grants: feedback_variant_stats is authenticated-only (never anon — least
-- privilege, and doubly enforced by is_app_admin() anyway). is_app_admin()
-- itself gets NO grant at all: it is only ever invoked from inside another
-- SECURITY DEFINER function's body, and for the duration of that call
-- current_user is the caller function's owner (postgres), not the original
-- client role — so no caller-side EXECUTE privilege on is_app_admin() is
-- needed for the internal call to succeed. (Contrast with the RLS-helper
-- predicates in migration 20260704120002, which ARE granted to authenticated
-- because RLS policy USING clauses run as the querying role itself.)
revoke execute on function public.feedback_variant_stats(timestamptz) from public;
grant  execute on function public.feedback_variant_stats(timestamptz) to authenticated;
revoke execute on function public.is_app_admin() from public;
