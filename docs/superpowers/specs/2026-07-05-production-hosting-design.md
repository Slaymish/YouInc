# YouInc Production Hosting — Design

**Date:** 2026-07-05
**Status:** Approved (design), pending implementation plan
**Goal:** Stand up a real, secure production environment for YouInc and get it hosted properly at `youinc.hamishburke.dev`.

## Context

The product has moved (recent commits) from a local-first, single-user SQLite ledger
to a **multi-tenant, Supabase-backed self-service app**:

- Frontend: TanStack Start (React 19 + Nitro server) in `frontend/`.
- All tenant data (auth, ledger, Akahu tokens, rules, sync log) lives in **Supabase**
  (Postgres + Auth + Row-Level Security + Vault), defined by 7 migrations in
  `supabase/migrations/`.
- The server client (`server/supabaseServer.ts`) uses the **anon key + the signed-in
  user's session cookie** — every query runs under that user's RLS context. There is
  **no `service_role` key** anywhere in the app.
- The legacy passkey/WebAuthn "owner" gate is now a **no-op** (`start.ts`
  `PROTECTED_PREFIXES` is empty); the owner uses `/workspace` as a normal tenant.
  Passkey code (`server/auth.ts`, `/login`) remains dormant, not torn out.

The deployment artifacts (`Dockerfile`, `fly.toml`, `docs/deploy_fly.md`, `README.md`)
still describe the **old** SQLite local-first + Basic Auth model and are stale.

### Decisions (from brainstorming)

- **Domain:** `youinc.hamishburke.dev` (subdomain of an owned domain).
- **Data:** production starts **clean** — no SQLite→Supabase migration; the old
  `data/youinc-ledger.sqlite3` (possibly deleted, migration never run) is not needed.
- **Email:** configure **real SMTP now** (Resend) — the public signup funnel requires
  working confirmation email.

## Architecture

Two managed services, both in the `syd` region (closest to NZ):

### Supabase Cloud
Holds all multi-tenant state:
- Postgres schema, RLS policies, RPCs (from `supabase/migrations/`).
- Supabase Auth (email/password + email confirmation) for `/signup` `/signin`
  `/onboarding` `/workspace`.
- Vault-backed encrypted Akahu **user** tokens (SECURITY DEFINER RPCs from
  `20260704120006_akahu_connection_secrets.sql`).

### Fly.io
One scale-to-zero Machine (`shared-cpu-1x`, 512 MB) running the built Nitro server
(`frontend/.output/server/index.mjs`) via `docker/entrypoint.sh`.

- **Fly Volume (1 GB) at `/data`** holds the *only* remaining runtime SQLite files:
  - `youinc-leads.sqlite3` — concierge lead capture (business-critical; must persist).
  - `youinc-feedback.sqlite3` — feedback submissions.
  - `youinc-auth.sqlite3` — dormant passkey store; pointed at `/data` defensively so a
    stray `/login` request cannot crash on an ephemeral/read-only path.

  (`server/analytics.ts` is *financial* analytics — pure recurring/category math on
  rows passed in; it opens no database and is not a runtime SQLite dependency.)
- `min_machines_running = 0`, `auto_stop_machines = "stop"`, `auto_start_machines`:
  suspends when idle, wakes on request. Single machine (SQLite volume attaches to one).

### Public URL / TLS
`youinc.hamishburke.dev` → CNAME to the Fly app; Fly provisions and renews the TLS
certificate. `force_https = true`.

## The critical correctness item: build-time vs runtime env

`frontend/src/lib/supabaseConfig.ts` reads `import.meta.env.VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`. **Vite inlines these at `pnpm build` time** — which happens
in Dockerfile **stage 1**. Fly *secrets* are runtime-only and will NOT reach the build.

If deployed as-is, the image bakes in the localhost fallbacks
(`http://127.0.0.1:54321` + the local publishable key) and the deployed app silently
talks to nothing — a green build and a broken prod that no local-stack test catches.

**Fix:** add `ARG VITE_SUPABASE_URL` / `ARG VITE_SUPABASE_ANON_KEY` (→ `ENV`) to the
Dockerfile `frontend-build` stage, and pass them from `fly.toml [build.args]`. Both
values are public-safe (anon key is gated by RLS), so baking them into the image is
correct, not a secret leak.

Both the browser client and the server client consume these same build-time constants,
so build-args are **sufficient** — no runtime Supabase env is required.

## Configuration split

| Kind | Values | Where set |
|---|---|---|
| **Build args** (baked into image; public-safe) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `fly.toml [build.args]` |
| **Runtime secrets** | `AKAHU_APP_TOKEN`; optional `YOUINC_LEADS_WEBHOOK_URL`, `YOUINC_FEEDBACK_WEBHOOK_URL` | `fly secrets set` |
| **Runtime env** | `NODE_ENV=production`, `PORT=3000`, SQLite paths → `/data` (`YOUINC_LEADS_DB_PATH`, `YOUINC_FEEDBACK_DB_PATH`, `YOUINC_AUTH_DB_PATH`) | `fly.toml [env]` + `entrypoint.sh` |
| **Deliberately NOT set** | `service_role` key (unused), `YOUINC_ENROLLMENT_TOKEN` (keeps passkey enrolment disabled), `YOUINC_RP_ID`/`YOUINC_RP_ORIGIN` (derived; passkey dormant) | — |

Note: `entrypoint.sh` currently only forces `YOUINC_DB_PATH`/`YOUINC_RULES_PATH` onto
`/data`; the leads/feedback/auth SQLite paths default to `../data/...` which
resolves onto `/data` only by cwd coincidence. Make all SQLite paths explicit onto
`$DATA_DIR` so persistence does not depend on the process working directory.

## Email (Resend → Supabase custom SMTP)

- Sign up for Resend (free tier: ample for a soft launch).
- Verify `hamishburke.dev` in Resend via DNS (SPF/DKIM records, typically on a `send.`
  subdomain — additive, does not disturb any existing mail/MX on the domain).
- Configure Supabase Auth **custom SMTP** to point at Resend.
- Sender: `no-reply@youinc.hamishburke.dev`.
- Set Supabase Auth **Site URL** and **redirect URLs** to `https://youinc.hamishburke.dev`
  so confirmation links resolve to prod.

## Security gates (must pass before real tenant data)

- Run `supabase/tests/rls_isolation.sql`, `classification_rules_isolation.sql`,
  `self_registration.sql`, `akahu_connection.sql`, `akahu_sync_log.sql` **against the
  cloud project** post-migration — verifying RLS is *enforced*, not merely present.
- Confirm Vault-backed Akahu token RPCs work on cloud (Vault available on all projects).
- Confirm no `service_role` key is shipped to the client bundle or committed.

## Implementation sequence (tightest constraint first)

1. **Supabase Cloud**: create project (`syd`) → `supabase link` → `supabase db push`
   → run RLS/isolation SQL tests against cloud → configure Auth (Site URL, redirect
   URLs) → configure custom SMTP (after step 2).
2. **Resend**: sign up, verify `hamishburke.dev`, get API key.
3. **Repo changes**: Dockerfile build-args (`VITE_SUPABASE_*`); `entrypoint.sh` explicit
   SQLite paths onto `/data`; fix `fly.toml` (`[build.args]`, drop stale Basic Auth
   framing, confirm mounts/env).
4. **Fly app**: create app + 1 GB volume (`syd`), set runtime secrets.
5. **Manual `fly deploy`**: add `youinc.hamishburke.dev` custom domain + DNS CNAME,
   verify end-to-end — signup → confirmation email → onboarding → workspace; concierge
   leads form persists; live RLS isolation between two test tenants.
6. **CI**: create scoped `FLY_API_TOKEN`, add as GitHub Actions secret — **last**, so a
   push to `main` (e.g. the docs commit) doesn't auto-deploy before prod is verified.
7. **Docs**: rewrite `README.md` + `docs/deploy_fly.md` to the Supabase + Fly reality;
   remove the "local-first SQLite ledger" and Basic Auth framing.

## Interactive hand-offs (owner runs; assistant guides)

Account- and machine-level steps that require the owner's interactive login/credentials:

- `supabase login` + create the cloud project (+ set/confirm DB password, billing if needed).
- Resend account signup + API key generation.
- Adding DNS records (Fly custom-domain CNAME/A+AAAA; Resend SPF/DKIM; any Supabase records).
- `fly auth login` + payment method on the Fly account.
- Creating the GitHub `FLY_API_TOKEN` Actions secret.

The assistant owns: migrations, Dockerfile/`fly.toml`/`entrypoint.sh` edits, secrets
*wiring* (commands), verification steps, and the docs rewrite.

## Out of scope (explicitly deferred)

- Scheduled/background Akahu sync (currently on-demand per account). Needs its own
  hosting decision (GH Actions cron vs Supabase Edge Function + pg_cron vs Fly scheduled
  machine).
- Email summary / "Monday Brief" delivery feature.
- Migrating leads/feedback from SQLite to Supabase (possible future
  simplification to make the app fully stateless and drop the Fly volume).
- Recovering the deleted `data/youinc-ledger.sqlite3` (prod starts clean).

## Success criteria

- `https://youinc.hamishburke.dev` serves the app over valid TLS.
- A new user can sign up, receive + click a confirmation email, complete onboarding, and
  reach `/workspace` with their own RLS-isolated data.
- Two tenants cannot see each other's data (verified live).
- A concierge lead submitted via the site persists across a Machine stop/start.
- Live Akahu sync works for a tenant who supplies their user token.
- Push to `main` (passing tests) auto-deploys via CI.
- README/deploy docs accurately describe the deployed architecture.
