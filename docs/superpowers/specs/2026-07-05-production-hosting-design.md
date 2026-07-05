# YouInc Production Hosting — Design

**Date:** 2026-07-05
**Status:** Approved (design), pending implementation plan
**Goal:** Stand up a real, secure, **fully stateless** production environment for YouInc
and get it hosted properly at `youinc.hamishburke.dev`.

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

Two things still write to **local SQLite** at runtime, which is what blocks a stateless
deploy:
- `server/leads.ts` — concierge / waitlist lead capture (public, unauthenticated).
- `server/feedback.ts` — A/B feedback votes (public, unauthenticated).

Dormant/legacy SQLite that is not on any live path: `server/auth.ts` (passkey store) and
`server/migration/migrateSqliteToSupabase.ts` (one-off SQLite→Supabase importer).

The deployment artifacts (`Dockerfile`, `fly.toml`, `docs/deploy_fly.md`, `README.md`)
still describe the **old** SQLite local-first + Basic Auth model and are stale.

### Decisions (from brainstorming)

- **Domain:** `youinc.hamishburke.dev` (subdomain of an owned domain).
- **Data:** production starts **clean** — no SQLite→Supabase migration; the old
  `data/youinc-ledger.sqlite3` (possibly deleted, migration never run) is not needed.
- **Email:** configure **real SMTP now** (Resend) — the public signup funnel requires
  working confirmation email.
- **Stateless:** the app must hold **no local disk state**. Move `leads` + `feedback`
  into Supabase, retire the dormant passkey/SQLite path, drop `better-sqlite3` entirely,
  and deploy with **no Fly volume**.

## Architecture

Two managed services, both in the `syd` region (closest to NZ):

### Supabase Cloud
The single source of truth for all persistent state:
- Postgres schema, RLS policies, RPCs (from `supabase/migrations/`).
- Supabase Auth (email/password + email confirmation) for `/signup` `/signin`
  `/onboarding` `/workspace`.
- Vault-backed encrypted Akahu **user** tokens (SECURITY DEFINER RPCs from
  `20260704120006_akahu_connection_secrets.sql`).
- **New:** `leads` + `feedback` tables (see "Statelessness" below).

### Fly.io
One scale-to-zero Machine (`shared-cpu-1x`, 512 MB) running the built Nitro server
(`frontend/.output/server/index.mjs`) via `docker/entrypoint.sh`.

- **No Fly Volume, no mounts.** The container holds nothing that must survive a restart;
  all writes go to Supabase over the network.
- `min_machines_running = 0`, `auto_stop_machines = "stop"`, `auto_start_machines`:
  suspends when idle, wakes on request.
- Being stateless, it can also safely run more than one Machine (horizontal scale) later
  with no code change; the default stays a single scale-to-zero Machine for cost.

### Public URL / TLS
`youinc.hamishburke.dev` → CNAME to the Fly app; Fly provisions and renews the TLS
certificate. `force_https = true`.

## Statelessness: what moves and what is removed

### `leads` + `feedback` → Supabase
These are **public, unauthenticated** writes, so they follow the codebase's existing
`SECURITY DEFINER` RPC pattern (as used for Akahu tokens) rather than direct table grants:

- New migration adds `leads` and `feedback` tables (mirroring the current SQLite columns)
  and two **`anon`-callable `SECURITY DEFINER` RPCs**: `record_lead(...)` and
  `record_feedback(...)` that perform the insert (leads keeps its email upsert + honeypot
  short-circuit inside the function).
- The tables have **no anon SELECT/INSERT policy** — anon can only reach them through the
  RPCs, so lead/feedback data is never client-readable. The owner reads via the Supabase
  dashboard (or an authenticated/owner query).
- `server/leads.ts` and `server/feedback.ts` are rewritten to call these RPCs via the
  request-scoped Supabase client instead of opening a SQLite file. Best-effort webhook
  notification (`YOUINC_LEADS_WEBHOOK_URL` / `YOUINC_FEEDBACK_WEBHOOK_URL`) is preserved.
- Their unit tests are rewritten as integration tests against the local `supabase start`
  stack (matching the other Supabase-backed server modules).

### Retire the dormant SQLite path
- Remove the passkey path that no live route uses: `server/auth.ts`, the `/login` route,
  and the `YOUINC_ENROLLMENT_TOKEN` / `YOUINC_RP_ID` / `YOUINC_RP_ORIGIN` handling.
- Remove the obsolete one-off importer `server/migration/` (prod starts clean; there is
  no SQLite source left to import from).
- Remove the vestigial `better-sqlite3` type import in `server/analytics.ts` (it opens no
  database — it is pure recurring/category math on rows passed in).
- Drop `better-sqlite3` (and `@types/better-sqlite3`) from `package.json` and the
  `onlyBuiltDependencies` native-compile list once nothing imports it.

### Docker image simplification
With no native module to compile, the `frontend-build` stage no longer needs
`python3 make g++` or the native rebuild, yielding a smaller, faster, more reliable image.
`docker/entrypoint.sh` loses all volume-seeding logic and just launches the server.

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
| **Runtime env** | `NODE_ENV=production`, `PORT=3000` | `fly.toml [env]` |
| **Deliberately NOT set** | `service_role` key (unused), all `YOUINC_*_DB_PATH` (no SQLite), `YOUINC_ENROLLMENT_TOKEN` / `YOUINC_RP_*` (passkey retired) | — |

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
- Add a test for the new `leads`/`feedback` tables: anon can call the RPCs but **cannot**
  `SELECT` the tables directly.
- Confirm Vault-backed Akahu token RPCs work on cloud (Vault available on all projects).
- Confirm no `service_role` key is shipped to the client bundle or committed.

## Implementation sequence (tightest constraint first)

1. **Repo — statelessness refactor (local, test against `supabase start`):**
   new migration for `leads`/`feedback` tables + anon-callable RPCs; rewrite
   `server/leads.ts` + `server/feedback.ts` onto Supabase; retire passkey path
   (`auth.ts`, `/login`, enrolment/RP env) + `server/migration/`; drop `better-sqlite3`;
   simplify Dockerfile (no native toolchain) + `entrypoint.sh` (no volume seeding); add
   Dockerfile build-args; fix `fly.toml` (`[build.args]`, remove `[[mounts]]`, drop stale
   Basic Auth framing). `pnpm build` + `pnpm test` green.
2. **Supabase Cloud:** create project (`syd`) → `supabase link` → `supabase db push`
   (now includes the leads/feedback migration) → run all SQL isolation tests against
   cloud → configure Auth (Site URL, redirect URLs).
3. **Resend:** sign up, verify `hamishburke.dev`, get API key → set Supabase custom SMTP.
4. **Fly app:** create app (no volume), set build-args (via `fly.toml`) and runtime
   secrets.
5. **Manual `fly deploy`:** add `youinc.hamishburke.dev` custom domain + DNS CNAME,
   verify end-to-end — signup → confirmation email → onboarding → workspace; a concierge
   lead + a feedback vote land in Supabase; live RLS isolation between two test tenants;
   confirm the deployed bundle points at the cloud Supabase URL (not localhost).
6. **CI:** create scoped `FLY_API_TOKEN`, add as GitHub Actions secret — **last**, so a
   push to `main` (e.g. the docs commit) doesn't auto-deploy before prod is verified.
7. **Docs:** rewrite `README.md` + `docs/deploy_fly.md` to the stateless Supabase + Fly
   reality; remove the "local-first SQLite ledger", Basic Auth, and volume framing.

## Interactive hand-offs (owner runs; assistant guides)

Account- and machine-level steps that require the owner's interactive login/credentials:

- `supabase login` + create the cloud project (+ set/confirm DB password, billing if needed).
- Resend account signup + API key generation.
- Adding DNS records (Fly custom-domain CNAME/A+AAAA; Resend SPF/DKIM).
- `fly auth login` + payment method on the Fly account.
- Creating the GitHub `FLY_API_TOKEN` Actions secret.

The assistant owns: the statelessness refactor + new migration, Dockerfile/`fly.toml`/
`entrypoint.sh` edits, secrets *wiring* (commands), verification steps, and the docs rewrite.

## Out of scope (explicitly deferred)

- Scheduled/background Akahu sync (currently on-demand per account). Needs its own
  hosting decision (GH Actions cron vs Supabase Edge Function + pg_cron vs Fly scheduled
  machine). Now genuinely easy to add given a stateless app.
- Email summary / "Monday Brief" delivery feature.
- Recovering the deleted `data/youinc-ledger.sqlite3` (prod starts clean).

## Success criteria

- `https://youinc.hamishburke.dev` serves the app over valid TLS.
- The deployed bundle talks to the **cloud** Supabase project (not `127.0.0.1`).
- A new user can sign up, receive + click a confirmation email, complete onboarding, and
  reach `/workspace` with their own RLS-isolated data.
- Two tenants cannot see each other's data (verified live).
- A concierge lead and a feedback vote submitted via the site are stored in Supabase and
  are **not** readable by the anon key directly.
- Live Akahu sync works for a tenant who supplies their user token.
- The container has **no volume** and no local SQLite; a Machine restart loses nothing.
- Push to `main` (passing tests) auto-deploys via CI.
- README/deploy docs accurately describe the deployed architecture.
