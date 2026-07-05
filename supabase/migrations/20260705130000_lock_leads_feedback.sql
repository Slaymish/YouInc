-- =============================================================================
-- YouInc — Lock down leads + feedback table privileges (defense in depth)
-- =============================================================================
-- leads/feedback are written ONLY through the record_lead / record_feedback
-- SECURITY DEFINER RPCs (owned by postgres, which bypass grants + RLS). No
-- client role should touch the tables directly. RLS already returns zero rows,
-- but Supabase's Data API auto-grants table privileges to anon/authenticated on
-- tables created by postgres — so revoke them explicitly. This makes a stray
-- future RLS policy non-exploitable and matches the hard-deny the local SQL
-- test asserts (supabase/tests/leads_feedback.sql).
-- =============================================================================

revoke all on public.leads    from anon, authenticated;
revoke all on public.feedback from anon, authenticated;

-- The RPCs remain callable (grants on the functions are unaffected); they run as
-- their definer (postgres) and are the only write path.
