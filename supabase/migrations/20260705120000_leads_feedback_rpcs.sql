-- =============================================================================
-- YouInc — Leads + Feedback via anon-callable SECURITY DEFINER RPCs
-- =============================================================================
-- Makes the app stateless: public marketing writes (waitlist leads, A/B feedback
-- votes) go to Postgres instead of local SQLite. Writes funnel through definer
-- RPCs owned by postgres so the anon role needs NO direct table privilege and
-- the tables are never client-readable. Mirrors the Akahu token RPC pattern
-- (migration 20260704120006). Verified by supabase/tests/leads_feedback.sql.
-- =============================================================================

-- feedback: A/B votes from public marketing pages (unauthenticated).
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  vote       text not null check (vote in ('up', 'down')),
  note       text,
  variant    text not null check (variant in ('A', 'B')),
  source     text not null,
  path       text not null,
  created_at timestamptz not null default now()
);
-- RLS on, NO policies: only the SECURITY DEFINER RPC (owned by postgres) writes;
-- nothing can be read/written by anon or authenticated directly.
alter table public.feedback enable row level security;

-- record_lead: upsert a waitlist/concierge lead by (lower-cased) email.
create or replace function public.record_lead(
  p_email      text,
  p_name       text,
  p_interest   text,
  p_source     text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leads (email, name, interest, source, user_agent)
  values (lower(btrim(p_email)), p_name, p_interest, p_source, p_user_agent)
  on conflict (email) do update set
    name       = excluded.name,
    interest   = excluded.interest,
    source     = excluded.source,
    user_agent = excluded.user_agent;
end;
$$;

-- record_feedback: insert one feedback vote.
create or replace function public.record_feedback(
  p_vote    text,
  p_note    text,
  p_variant text,
  p_source  text,
  p_path    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.feedback (vote, note, variant, source, path)
  values (p_vote, p_note, p_variant, p_source, p_path);
end;
$$;

-- Force all lead writes through record_lead: drop the direct anon INSERT path
-- added in the schema migration.
drop policy if exists leads_anon_insert on public.leads;
revoke insert on public.leads from anon;

-- Grant EXECUTE on the RPCs (public marketing pages call them unauthenticated).
revoke execute on function public.record_lead(text, text, text, text, text)     from public;
revoke execute on function public.record_feedback(text, text, text, text, text) from public;
grant  execute on function public.record_lead(text, text, text, text, text)     to anon, authenticated;
grant  execute on function public.record_feedback(text, text, text, text, text) to anon, authenticated;
