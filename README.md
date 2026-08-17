# YouInc

A self-hosted personal ERP: an executive dashboard over a double-entry ledger,
with live bank sync via Akahu (NZ Open Finance).

**YouInc is not a service.** There is no hosted product, no account to create on
youinc.net, and nothing to buy. The public site publishes a sample-data demo and
the documentation; to use it on your own money, you run your own instance
against your own database and your own Akahu credentials.

## What it does

- Double-entry ledger in Postgres, with isolation enforced by Supabase
  Row-Level Security.
- Live bank sync via Akahu: you supply your own enduring user token, stored
  encrypted in Supabase Vault and never returned to the browser.
- Transactions run through the ledger engine (rules routing, NZFCC fallback,
  suspense safety) and post idempotently as `raw_transactions` + balanced
  `journal_transactions` / `journal_entries`.
- A configurable dashboard of widgets (net worth, runway, cashflow, balance
  sheet, ledger controls, and more).
- Public surface on youinc.net: landing (`/`), live demo on sample data
  (`/demo`), and a live widget catalogue (`/widgets`).

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

## Run it yourself

This is the supported way to use YouInc. You need
[Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```sh
supabase start          # from the repo root: local Postgres/Auth/Studio stack
supabase db reset       # apply all migrations (and re-run on migration changes)

cd frontend
pnpm install
pnpm dev                # http://localhost:3000
```

The frontend defaults (in `src/lib/supabaseConfig.ts`) point at the local
`supabase start` stack, so this works with no extra config. Create your account
at `/signup`; local Supabase has email confirmation off, so signup goes straight
to onboarding. On your own instance you are the only user — sign-up is open
because there is nobody else pointed at your database.

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

You connect your bank via **OAuth2**: a "Connect with Akahu" button on the
workspace launches the Akahu consent flow, returns an enduring user token to the
callback, and the app stores it encrypted in Supabase Vault (never in the client
bundle). The Akahu **app** credentials are server-side secrets on your instance.
There is no tier or trial gate on live sync — they are your credentials.

**Prerequisites:** Your Akahu app must be upgraded to a **Full App** with OAuth2
enabled. Personal Apps do not support OAuth token exchange. Contact Akahu support to
verify your app tier and enable OAuth if needed.

**Required env vars** (server-side secrets only):
- `AKAHU_APP_TOKEN` — App ID Token (also used as OAuth `client_id`)
- `AKAHU_SECRET` — App Secret (required for OAuth token exchange; `AKAHU_APP_SECRET` is also supported)
- `AKAHU_OAUTH_REDIRECT_URI` — Registered callback URI

**Optional overrides:**
- `AKAHU_BASE_URL` (default: `https://api.akahu.io/v1`)
- `AKAHU_APP_ID_TOKEN` (default: same as `AKAHU_APP_TOKEN`)
- `AKAHU_OAUTH_AUTHORIZE_URL` (default: `https://oauth.akahu.nz`)
- `AKAHU_OAUTH_SCOPES` (default: `ENDURING_CONSENT`, matching the URL registered by Akahu)

**Registering redirect URIs:** On the Akahu app dashboard, register both:
- Production: `https://youinc.net/api/akahu/callback`
- Local dev: `http://localhost:3000/api/akahu/callback`

Without valid app credentials the workspace shows a "live sync not configured" note;
manual accounts and sample data still work. If the Full App prerequisite is not met,
the OAuth flow will fail gracefully with a user-friendly error.

Disconnecting revokes the user token at Akahu before removing its encrypted Vault
copy. This both removes Akahu's access and frees one of the development app's five
user slots. If a user revokes access through Akahu first, the next API `401` removes
the now-invalid local token automatically.

## Feedback & variant voting

`FeedbackWidget.tsx` on the marketing pages randomly assigns each visitor variant A/B
(client-side, persisted in `localStorage`) and records 👍/👎 votes into `public.feedback`
via the anon-callable `record_feedback` RPC — write-only from the client's perspective.

Aggregated results are readable through `public.feedback_variant_stats(p_since)`, a
second SECURITY DEFINER RPC that self-enforces admin-only access (an `is_app_admin()`
allowlist check inside the function — there is no `service_role` key anywhere in this
app, so authorization has to live in Postgres, not app code). The signed-in owner views
results at **`/admin/feedback`** (not linked from any nav — go there directly), which
shows vote counts/up-rate per variant × source × path, and flags a statistically
significant leader (two-proportion z-test, requires ≥30 samples per variant and p < 0.05)
without acting on it.

**Promotion is intentionally not automated.** Variant assignment is still 100%
client-side `Math.random()`; there is no mechanism today to shift new visitors toward a
flagged winner. Doing so would mean either moving assignment server-side or having
`FeedbackWidget` read a remote config/feature-flag value at render time — reasonable
future work, but out of scope here. For now, a human reads the `/admin/feedback` flag and
manually edits `FeedbackWidget.tsx`'s variant copy/split if/when a result is convincing.

To grant the first admin in a fresh environment (the migration seeds `hamish@paychase.co.nz`
as a best-effort no-op if that user doesn't exist yet):

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com';
```

## Product analytics

The app has first-party, privacy-safe product analytics backed by Supabase. The
owner view is **`/admin/analytics`** and uses the same `app_admins` allowlist as
`/admin/feedback`. It shows the 30-day value funnel, 7-day engaged workspaces,
7-day activation, sync reliability, event ranking, and daily signal volume.

Durable outcomes (`signup_succeeded`, `email_confirmed`, `workspace_created`,
`manual_account_created`, `ledger_value_created`, `akahu_connection_created`, `sync_started`,
`sync_succeeded`, `sync_failed`) are emitted by database triggers. Application
telemetry is intentionally limited to coarse intent/view events:
`marketing_cta_clicked`, `signup_started`, `onboarding_started`,
`akahu_connect_started`, `akahu_oauth_failed`, `dashboard_viewed`,
`settings_opened`, and `sample_data_loaded`.

The event store must never contain email addresses, URLs/query strings, IPs,
user agents, transaction or merchant details, account/provider identifiers,
balances, tokens, or free text. Client roles cannot read raw events; the admin
RPC returns aggregates only. Apply migration
`20260715120000_product_analytics.sql` before deploying the instrumented app.

## Deployment

youinc.net runs the demo and docs on Fly.io (stateless, scale-to-zero) backed by
a Supabase project. The same setup works for your own instance —
see `docs/deploy_fly.md` for the full walkthrough.

## Licence

MIT — see [`LICENSE`](LICENSE). Fork it, run it, change it, ship it. The point of
publishing this is that you can own your own copy; a licence that made you ask
permission first would defeat that.

## Safety notes

- Pending transactions are cached but not posted by default.
- Every journal posting is validated so debits equal credits before commit.
- Unmatched transactions route to a suspense account.
- Real credentials are ignored by git; per-tenant data is isolated by RLS.
