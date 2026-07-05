# YouInc

A multi-tenant personal ERP: a self-service executive dashboard over a per-user
double-entry ledger, with live bank sync via Akahu (NZ Open Finance).

## What it does

- Self-service signup + onboarding — anyone can create an account and their own
  isolated workspace (tenant).
- Per-tenant double-entry ledger in Postgres, with tenant isolation enforced by
  Supabase Row-Level Security.
- Live bank sync via Akahu: each user connects their own Akahu account with an
  enduring user token, stored encrypted in Supabase Vault and never returned to
  the browser.
- Transactions run through the ported ledger engine (rules routing, NZFCC
  fallback, suspense safety) and post idempotently as `raw_transactions` +
  balanced `journal_transactions` / `journal_entries`.
- A configurable dashboard of widgets (net worth, runway, cashflow, balance
  sheet, ledger controls, and more).
- Public marketing surface: landing (`/`), live demo on sample data (`/demo`),
  bespoke-service page (`/custom-builds`), and a live widget catalogue
  (`/widgets`).

See `docs/architecture_design.md`, `docs/persona_frontend_information_design.md`,
and `docs/research_competitors.md` for background, and
`docs/superpowers/specs/2026-07-05-production-hosting-design.md` for the current
hosting design.

## Architecture

- **Frontend:** TanStack Start (React 19 + Nitro server) in `frontend/`. Uses
  [pnpm](https://pnpm.io/).
- **Backend:** Supabase (Postgres + Auth + RLS + Vault) — the single source of
  truth. Schema and policies live in `supabase/migrations/`.
- **Stateless:** the app holds no local disk state. All persistence is Supabase
  over the network; there is no SQLite and no attached volume in production.

## Run locally

You need [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```sh
supabase start          # from the repo root: local Postgres/Auth/Studio stack
supabase db reset       # apply all migrations (and re-run on migration changes)

cd frontend
pnpm install
pnpm dev                # http://localhost:3000
```

The frontend defaults (in `src/lib/supabaseConfig.ts`) point at the local
`supabase start` stack, so dev works with no extra config. Create an account at
`/signup`; local Supabase has email confirmation off, so signup goes straight to
onboarding.

If `pnpm install` fails with `ECONNREFUSED` against `127.0.0.1:8080`, a local
proxy is configured but not running — re-run with proxy vars unset:

```sh
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u https_proxy -u http_proxy -u all_proxy pnpm install
```

## Tests

```sh
cd frontend
pnpm test        # vitest — pure logic (validation, ledger math, derivations)
pnpm test:e2e    # Playwright — public pages + signup/workspace flows (needs supabase running)
pnpm build       # vite build + tsc --noEmit (typecheck)
```

Database behavior (RLS isolation, RPCs) is verified by SQL tests in
`supabase/tests/` against the local stack, e.g.:

```sh
docker exec -i supabase_db_YouInc psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/rls_isolation.sql
```

## Live Akahu sync

The Akahu **app** token is a server-wide secret; each user supplies their own
**user** token via the `/workspace` connect form (stored encrypted in Vault).
Set on the server (env / host secrets):

- `AKAHU_APP_TOKEN`
- `AKAHU_BASE_URL` (optional, defaults to `https://api.akahu.io/v1`)

Without an app token the workspace shows a "live sync not enabled" note; manual
accounts and sample data still work.

## Deployment

Hosted on Fly.io (stateless, scale-to-zero) backed by a Supabase Cloud project.
See `docs/deploy_fly.md` for the full walkthrough.

## Safety notes

- Pending transactions are cached but not posted by default.
- Every journal posting is validated so debits equal credits before commit.
- Unmatched transactions route to a suspense account.
- Real credentials are ignored by git; per-tenant data is isolated by RLS.
