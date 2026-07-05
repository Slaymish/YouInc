-- =============================================================================
-- YouInc — Add the 'free' tenant tier
-- =============================================================================
-- Business context: self-serve (paid, $15/mo) live Akahu sync funds the API
-- costs, so it can no longer be the default landing tier for a brand-new
-- self-registered tenant. This migration introduces a THIRD tier, 'free':
-- full widget access, manual accounts only, no live bank connection. Tenants
-- upgrade to 'self-serve' to unlock live sync (billing/upgrade flow is a
-- separate, non-schema concern — out of scope here).
--
-- tenants.tier is a plain `text` column with an inline CHECK constraint (see
-- 20260704120001_schema.sql), NOT a native Postgres enum — so widening the
-- allowed value set is a single, fully-transactional ALTER TABLE (no
-- `ALTER TYPE ... ADD VALUE` non-transactional caveat applies here; that
-- caveat is only relevant to native `create type ... as enum` columns, which
-- this schema deliberately does not use for tier).
--
-- Postgres auto-names an inline, unnamed column CHECK constraint
-- "<table>_<column>_check" (tenants_tier_check here); drop-then-recreate by
-- that name is safe and idempotent to re-run.
-- =============================================================================

alter table public.tenants
  drop constraint if exists tenants_tier_check;

alter table public.tenants
  add constraint tenants_tier_check
    check (tier in ('free', 'self-serve', 'concierge'));

comment on column public.tenants.tier is
  'Product tier (billing/plan), tenant-level attribute applying to all members. '
  '''free'' = manual accounts only, all widgets, no live Akahu sync (new default '
  'for self-registered tenants — see create_tenant). ''self-serve'' = paid, adds '
  'live Akahu bank sync. ''concierge'' = bespoke, operator-provisioned.';
