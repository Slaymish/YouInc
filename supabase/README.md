# Supabase migrations — P1 (multi-tenant foundation)

Status: **VERIFIED against a local Supabase stack** (2026-07-04). All migrations
apply clean from scratch (`supabase db reset`), and the RLS tenant-isolation
test suite passes (8/8 assertions, exit 0). See "Verification" below to reproduce.

## Migrations (apply in order)

| File | What it does |
|------|--------------|
| `20260704120001_schema.sql` | 15 tables: tenancy (`tenants`, `profiles`, `memberships`, `invites`, `akahu_connections`), 6 ledger tables (all `tenant_id`-scoped, composite uniques), per-tenant rules config (`classification_rules` with `seq`, `account_mappings`, `nzfcc_mappings`), `leads`. `tier` lives on `tenants` only. |
| `20260704120002_rls_policies.sql` | `SECURITY DEFINER` helpers (`user_tenant_ids`, `is_tenant_member`, `has_tenant_role`), RLS enabled on every table, one tenant-scoped policy per business table, identity-table policies, leads anon-insert. |
| `20260704120003_accept_invite.sql` | `accept_invite(code)` RPC — role-only membership creation (tier comes from the tenant), email-binding check, concurrency-safe, on-conflict-safe. |
| `20260704120004_grants.sql` | Base table privileges for `anon`/`authenticated`. **Required** — RLS filters rows but a role still needs table GRANTs to touch a table at all; without this every authenticated query fails "permission denied for table" before RLS runs. (Found via the live apply — not caught by review.) |
| `20260704120005_self_registration.sql` | **Public self-service signup.** `handle_new_user()` AFTER-INSERT trigger on `auth.users` auto-provisions a `profiles` row for every new user (seeded from signup metadata / email local-part). `create_tenant(name, currency, suspense)` `SECURITY DEFINER` RPC lets a brand-new authenticated user (no membership yet) create their own tenant and become its `owner` atomically — always `tier='self-serve'`. This is what the onboarding flow calls. |
| `20260704120006_akahu_connection_secrets.sql` | **Vault-backed Akahu tokens.** Three `SECURITY DEFINER` RPCs (`connect_akahu`, `get_akahu_user_token`, `disconnect_akahu`), each membership-gated via `is_tenant_member`. They store/read/delete a tenant member's enduring Akahu USER token in Supabase **Vault** (`vault.create_secret`/`decrypted_secrets`), keeping only the secret uuid on `akahu_connections.user_token_secret_id` — the raw token never lands in a business table and is never returned to the browser (read is server-side sync only). |

## Verification

```sh
# needs Docker running
supabase start
supabase db reset        # applies all 6 migrations from scratch — must succeed clean

# RLS tenant-isolation suite (rolled-back, re-runnable). Container name is
# supabase_db_<project>; here supabase_db_YouInc:
docker exec -i supabase_db_YouInc \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/rls_isolation.sql
# expect: "ALL RLS ISOLATION TESTS PASSED", exit 0

# Self-registration suite (trigger + create_tenant RPC, rolled-back):
docker exec -i supabase_db_YouInc \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/self_registration.sql
# expect: "ALL SELF-REGISTRATION TESTS PASSED", exit 0

# Akahu connection / Vault token suite (rolled-back):
docker exec -i supabase_db_YouInc \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/akahu_connection.sql
# expect: "ALL AKAHU CONNECTION TESTS PASSED", exit 0
```

`supabase/tests/rls_isolation.sql` proves, against the real stack:
- a user sees only their own tenant's rows; cross-tenant reads return **zero**;
- `WITH CHECK` blocks writing a row into another tenant;
- an unaffiliated user sees nothing;
- `accept_invite` creates the membership with the invite's role, marks the invite
  accepted, and **rejects** an email-bound invite redeemed by the wrong user;
- a plain member cannot read the `invites` table (admin-only policy).

Confirmed on the live stack (only resolvable there, not on plain Postgres):
- `auth.users` FKs, `auth.uid()`, `auth.jwt()` all resolve.
- The `SECURITY DEFINER` helpers are owned by `postgres`, which **has
  `BYPASSRLS`** — so the memberships-read bypass holds and there is no RLS
  recursion. (If a future deploy runs migrations as a non-BYPASSRLS role,
  re-confirm helper ownership.)

## Done in P2 (Akahu connect)

- **Vault-backed Akahu tokens** — shipped in `20260704120006_akahu_connection_secrets.sql`
  and verified live by `supabase/tests/akahu_connection.sql`. Uses
  `vault.create_secret` / `vault.update_secret` / `vault.decrypted_secrets`,
  confirmed against the local stack (see the Vault note below is now resolved for
  our usage).

## Still uncertain — verify against current Supabase docs before relying on
- **Auth Hook** custom-claim shape for the active-tenant JWT selector
  (`app_metadata.active_tenant_id`) — see `rls_policies.sql` §7. Sketch only.
- **Passkeys** SDK minimum (`@supabase/supabase-js` ~v2.105.0+, beta) — pin exactly.

## Done in P4 (self-service signup)

- **Public signup / create-tenant RPC** — shipped in
  `20260704120005_self_registration.sql` (see the migration table above). A new
  user signs up via Supabase Auth (which fires `handle_new_user` to create their
  profile), then the onboarding flow calls `create_tenant(...)` to create their
  self-serve tenant and owner membership. Verified by
  `supabase/tests/self_registration.sql`.

## Deliberately deferred to P2 (not an omission)

- **The tenant-aware data-access layer.** `readLedgerDashboard()` is SQL
  aggregation over tables the Python engine *writes*, and mutations shell to
  Python→SQLite. Moving reads to Postgres while writes still hit SQLite would
  make the dashboard read an empty DB — reads and writes must migrate together,
  which is the P2 ledger-port work. Writing query code now (against a stack we
  can't run, that P2 rewrites) would be churn.
- **Concierge onboarding shape.** Assumption baked in: a concierge client gets
  their own `tier='concierge'` tenant (role=owner), NOT a membership in the
  operator's tenant — keeps client finances isolated. Confirm before P5.
