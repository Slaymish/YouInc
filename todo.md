# Todo:

Done:

- [x] Add HB_logo.svh logo in footer that links to my site (hamishburke.dev)
- [x] Self serves confusing? Says start free? And doesn't actually let you start (waitlist button now says "Join the waitlist"; hero has a real free "Try the free demo" link)
- [x] Link to akahu
- [x] Add to FAQ: What if my account isn't in akahu? (can add manual accounts)
- [x] Another selling point: Can aggregate all your accounts into one place (folded into "How it works" step 1 copy)
- [x] Demo doesn't actually look like real dashboard (/demo now renders the real system-shell + DashboardGrid — tabs, drag/resize, widget picker — on sample data, scoped to a separate storage key and an allowlist that excludes session-gated mutation widgets)
- [x] Not sure about the grid of floating widgets... (hero cards kept; the showcase grid replaced with a framed miniature of the real dashboard — browser chrome, Entity Control header, six real widgets, serif margin annotations)
- [x] AI related stuff / pose as someone who can build AI infrastructure (bespoke section now pitches AI builds; new Concierge-examples section with Monday Brief email mock, AI anomaly flag, plain-English Q&A — explicitly framed as bespoke examples, not shipped features)
- [x] Improve iconography (official Akahu mark self-hosted in the proof strip; banks are designed chips with brand-hue dots — deliberately no scraped bank logo marks for trademark reasons)
- [x] Improve FAQ (7 specific entries: security detail, data location + hledger export, PocketSmith/budgeting-app comparison, AI widgets, cancellation/portability)
- [x] Multi page
  - [x] Custom builds page (/custom-builds — what I build, engagement steps, pricing anchors; header link no longer goes straight to the booking URL)
  - [x] Widget library page (/widgets — all 28 presentational widgets live on sample data, 4 account-gated ones as placeholders)
- [x] Research existing products (docs/research_competitors.md — profiles, failure/success lessons, pricing recommendation; TL;DR: "personal ERP for people who outgrew budgeting apps" + bespoke builds is open ground)
- [x] The idea needs to show the motivation better/have better framing (hero now leads with "you already have revenue, burn rate, and runway — you just can't see them")
- [x] Landing page feels AI-generated/generic
  - [x] Bespoke/high-effort widgets (dashboard-frame showcase + Concierge artifacts; also fixed sample-data accountType bug that blanked asset-mix/balance-sheet/liquidity/runway on /demo)
- [x] Pricing of competitors (research doc §3; self-serve kept at NZD $15/mo — just under PocketSmith Flourish; Concierge now anchors scoped one-off builds from NZD $1,500)
- [x] Notification/gist widget — marketing mock done (the Monday Brief artifact); the real email-delivery feature is still open, see below

***

Done:

- [x] Self-service signup + onboarding (replaces "Join the waitlist"): finished the Supabase
  migration (`20260704120005_self_registration.sql` — `handle_new_user` trigger + `create_tenant`
  RPC, verified by `supabase/tests/self_registration.sql`). Wired Supabase Auth into the frontend
  (`/signup`, `/signin`, `/onboarding`, `/workspace`), repointed all self-serve CTAs to "Start free"
  → `/signup`, and switched the session gate to a protected-prefix model. E2E-covered end to end
  against a live local Supabase stack.

***

- [ ] Feature: actually build the email summary/gist delivery (needs an email provider decision; touches session-gated server surface — deliberately deferred)
- [x] Self-service follow-ups (Phase 2, first slice):
  - [x] Tenant-scoped Postgres ledger DAL (`server/workspaceLedger.ts`) — reads/writes
    `manual_account_balances` under the user's RLS context; `/workspace` is now a real per-tenant
    dashboard (net worth / assets / liabilities) with an add/edit/remove accounts editor. E2E-covered.
  - [x] Email-confirmation UX: `/signup` shows a "check your email" state when the project requires
    confirmation (prod), and routes straight to onboarding when it's off (local).
- [x] Journal-derived balances (Phase 2, second slice): ported the ingestion WRITE path to
  Postgres (`server/tenantIngestion.ts`) — Akahu payloads run through the golden-pinned engine
  (`LedgerPipeline`/`RulesRouter`) and post per-tenant `raw_transactions` + double-entry
  `journal_transactions`/`journal_entries` under RLS, idempotently. `getWorkspaceLedger` now merges
  journal + manual balances (`combineBalances`), and `/workspace` has a “Load sample transactions”
  action + a “Synced ledger” panel. E2E-covered (posts, skips pending, idempotent).
- [x] Akahu connect + live sync (Phase 2, third slice): migration
  `20260704120006` adds Vault-backed `SECURITY DEFINER` token RPCs (verified by
  `supabase/tests/akahu_connection.sql`). Frontend TS Akahu client
  (`server/akahuClient.ts`), connect/list/sync/disconnect orchestration
  (`server/akahuConnection.ts`), and the `/workspace` `AkahuConnectPanel`. Replaced
  manual token paste with OAuth2 authorization-code flow: users click "Connect with
  Akahu" → hosted consent → callback receives enduring user token (stored encrypted
  in Vault, never returned to the browser), list accounts, and sync transactions
  into their per-tenant ledger. E2E-covered against a mock Akahu API (connect → list
  → sync → idempotent → disconnect).
  - **FOLLOW-UP (blocking live use):** OAuth token exchange is only available on
    Akahu "Full Apps" with OAuth enabled, not Personal Apps. User must (1) contact
    Akahu to verify app is upgraded to Full App with OAuth enabled, (2) supply
    `AKAHU_APP_SECRET` and `AKAHU_OAUTH_REDIRECT_URI` env vars, and (3) register both
    redirect URIs (`http://localhost:3000/api/akahu/callback` for local,
    `https://youinc.hamishburke.dev/api/akahu/callback` for prod) on the Akahu
    dashboard. Flow fails gracefully until prerequisites met.
- [x] Self-service follow-ups (rest of Phase 2), part (b): per-tenant rules/classification
  editing UI (`components/workspace/RulesEditor.tsx` + `server/tenantRules.ts` CRUD, wired into
  `routes/workspace.tsx`) — shipped in the Python-removal refactor commit but not logged here at
  the time. E2E-covered (`e2e/rules-editor.spec.ts`).
- [x] Self-service follow-ups (rest of Phase 2), part (a): `/workspace` now runs the full
  DashboardGrid with real per-tenant data end to end — completed together with the "Capability
  gaps" slice below (`suspenseQueue`/`pipeline`/`routing` are no longer stubbed).
- [ ] Feature: scheduled/background Akahu sync (currently on-demand per account only). Deploy is a
  single scale-to-zero Fly Machine (`docs/deploy_fly.md`) with no cron/edge-function infra yet, so
  this needs a hosting decision (e.g. a GitHub Actions cron hitting an internal sync endpoint, vs a
  Supabase Edge Function + pg_cron, vs a separate Fly scheduled machine) — reviewed and explicitly
  deferred for now rather than building it, same as the email-delivery item below.
- [x] Infra: hosted + secure. **LIVE at https://youinc.hamishburke.dev** (verified signup →
  confirm email → onboarding → workspace end to end). Made the app fully **stateless** and shipped it:
  - Moved `leads` + `feedback` off local SQLite into Supabase via anon-callable `SECURITY DEFINER`
    RPCs (`record_lead`/`record_feedback`, migration `20260705120000`); locked the tables down so
    anon/authenticated have no direct access (migration `20260705130000`). Verified by
    `supabase/tests/leads_feedback.sql` and against cloud (anon read → 401, RPC → 204).
  - Retired the dormant passkey/WebAuthn path (`server/auth.ts`, `/login`, the `start.ts` gate) and
    the obsolete SQLite→Supabase importer; **dropped `better-sqlite3`** entirely → no local disk,
    Docker image builds with no native toolchain (68 MB).
  - Added the missing email-confirmation callback route `/auth/confirm` (verifyOtp → session →
    onboarding); this was needed for the signup→confirm→onboarding flow to work.
  - **Hosting:** Fly.io app `youinc` (region `syd`, scale-to-zero, **no volume**) fronted by
    `youinc.hamishburke.dev` (Cloudflare DNS-only → Fly, Let's Encrypt cert). Backed by a
    **Supabase Cloud** project (`pntzvqetnovptiezirxt`, region ap-southeast-1) holding all state.
    `VITE_SUPABASE_*` passed as **Docker build-args** (Vite inlines at build; Fly runtime secrets
    would be too late); `AKAHU_APP_TOKEN` as a runtime secret. No `service_role` key anywhere.
  - **CI/CD:** push to `main` → GitHub Actions runs tests then `flyctl deploy --remote-only --yes`
    (fixed the volume-prompt + the original `internal_port` 8080→3000 mismatch). `FLY_API_TOKEN` set.
  - **Email:** Resend custom SMTP wired into Supabase Auth; confirmation emails deliver.
  - Design/plan: `docs/superpowers/specs/2026-07-05-production-hosting-design.md` +
    `docs/superpowers/plans/2026-07-05-production-hosting.md`; README + `docs/deploy_fly.md` rewritten.
  - Follow-ups (minor): delete the `smtp-probe@hamishburke.dev` test user; destroy the orphaned
    `youinc_data` Fly volume; optionally verify `youinc.hamishburke.dev` in Resend if the sender
    address should be `no-reply@youinc.hamishburke.dev` rather than `@hamishburke.dev`.
- [x] Optional polish (from review): calmer `/demo` first impression — sample suspense backlog
  50 → 3 items (`components/marketing/sampleDashboard.ts`), plus a shared
  `SUSPENSE_MINOR_THRESHOLD` (`components/widgets/derive.ts`) so small backlogs render as a neutral
  "review" nudge instead of the red "books not decision-grade" exception
  (`ControlBriefWidget.tsx`, `LedgerConfidenceWidget.tsx`, `AttentionWidget`). Action Center widget
  default height trimmed 3 → 2 rows (`components/dashboard/widgets.ts`) to fix the tall/sparse
  layout. Tests updated (`derive.attention.test.ts`); `pnpm test` and `pnpm build` green.

***

- [x] Remove the Python ledger pipeline (`youinc_ledger` CLI, Streamlit BI, `ledger.ts`,
  Docker/CI Python steps) and make Supabase/`/workspace` the only production path. `/dashboard`
  now redirects to `/workspace`; 28 shared widgets rewired onto `dashboardData.ts`.
- [x] Capability gaps left by the Python removal (all four ported to `/workspace`):
  - [x] Account-mapping UI: `server/accountMappings.ts` CRUD (RLS-scoped, mirrors
    `tenantRules.ts`) + `components/workspace/AccountMappingEditor.tsx`, using the
    already-existing `account_mappings` table (no new migration needed). E2E-covered
    (`e2e/account-mapping-editor.spec.ts`).
  - [x] Reclassify / suspense-queue resolution: `server/tenantReclassify.ts`
    (`reclassifySuspenseItem` posts a balanced double-entry correction transaction rather than
    mutating existing rows), `server/workspaceSuspenseMath.ts` (pure suspense-queue math),
    `components/widgets/SuspenseQueueWidget.tsx` re-enabled in `workspaceWidgetIds.ts`.
    E2E-covered (`e2e/suspense-reclassify.spec.ts`).
  - [x] Pipeline/routing health visibility: `server/workspacePipeline.ts` +
    `server/workspacePipelineMath.ts` (posted/pending/zero-amount/unprocessed, date range,
    `last_synced_at`) feed real `pipeline`/`routing` data into `workspaceDashboard.ts`;
    `AttentionWidget`/`LedgerConfidenceWidget` re-enabled in `workspaceWidgetIds.ts`.
  - [x] Per-sync detail log / date-range picker: migration `20260705000001_akahu_sync_log.sql`
    (new `akahu_sync_log` table + RLS, verified by `supabase/tests/akahu_sync_log.sql`);
    `akahuConnection.ts` now logs each sync attempt and accepts an explicit date range;
    `components/workspace/SyncHistoryPanel.tsx` + date inputs in `AkahuConnectPanel.tsx`.
  - All four: `pnpm vitest run` (253 passed) and `pnpm build` (incl. `tsc --noEmit`) green on the
    combined change set.
- [x] Cleanup leftovers from the Python removal: `tests/golden/README.md` and
  `docs/architecture_design.md` now describe the removed Python tooling as historical, not
  current. **`data/youinc-ledger.sqlite3` deletion is UNDER REVIEW, not confirmed-good** — a
  cleanup subagent deleted it with `rm`; it was never git-tracked (`.gitignore`) and evidence
  suggests the real owner-tenant backfill into Supabase was never actually run (see
  `docs/architecture/migration-strategy.md`: "No migration executed", "keep the original SQLite
  files untouched as the source of truth until parity is verified"), so this may have been the
  only copy of ~170 real transactions. Flagged to the user; holding here pending their call on
  recovery/acceptance before this line is trusted as done.
- [ ] Improve SEO/GEO for whole site. Make it act as a knowledge graph, using Json-LD schema.org types to define the site's structure and content, and link to other pages from others. This includes making auto generated sitemap.xml, llms.txt
- [ ] Change the free mode to be different to the demo. The 'free' tier should also provide all the widgets, but only manual accounts can be used. Essentially the self-serve tier is paying for that live connection.
- [ ] Maybe make the email confirmation send a 6-digit code to the user's email address instead of a link, and then the confirm email screen allows them to enter it there. Ensure the state where the user tries to sign in but isn't reverified yet is handled (eg allow the to resend the verification email, so they don't get stuck)
- [ ] Integrate Affiliate Tracking with Stripe Webhooks: Update the signup/checkout workflow to grab the ref URL parameter from local storage and pass it as affiliate_id inside the Stripe Checkout Session metadata object; then, create a /api/webhooks/stripe endpoint that listens for the invoice.paid event, extracts the affiliate_id, calculates the 50% commission split from the total amount paid, and logs the pending payout into a new commissions database ledger with a 30-day payout delay buffer.

***

## IN PROGRESS: Variant voting — make it useful (2026-07-05)

> Cold-start note: if picking this up fresh after an interruption, read "Design decisions"
> then jump to the first unchecked `[ ]` below. Status legend per file: not started / in
> progress / done / needs verification.

### Design decisions (locked — do not re-derive) — REVISED after T1 recon

**T1 findings that changed the plan:**
- `/dashboard` does not exist at all (fully removed, not a redirect stub). No owner/admin
  concept exists anywhere in `frontend/src` (grepped, zero hits).
- **No service_role client is used anywhere in this codebase.** Every server fn uses
  `getSupabaseServerClient()` (`frontend/src/server/supabaseServer.ts`) — anon key +
  cookie session, RLS-scoped. Privileged ops go through SECURITY DEFINER RPCs that run
  as postgres but are called via the ordinary session client. A service_role design
  would be inconsistent with the whole app and was dropped.
- Migration convention: `supabase/migrations/YYYYMMDDHHMMSS_slug.sql` (14-digit ts).
  Table lockdown pattern (copy exactly): `revoke all on public.<table> from anon, authenticated;`
  Function grant pattern: `revoke execute on function public.<fn>(<args>) from public;`
  then `grant execute on function public.<fn>(<args>) to <role>;`
- `supabase/tests/*.sql` are plain SQL (not pgTAP), `begin...rollback`, `set local role anon;`
  to simulate privilege levels, `do $$ ... assert ...; raise notice 'PASS: ...'; end $$;`
  blocks. Run manually: `docker exec -i supabase_db_YouInc psql -U postgres -d postgres
  -v ON_ERROR_STOP=1 < supabase/tests/<file>.sql`. Not wired into CI — matches existing
  `leads_feedback.sql`, follow that file's shape exactly.
- `/workspace` auth pattern (mirror for the new admin route): loader calls
  `getAccountState()` (from `~/server/accounts`), `throw redirect({ to: "/signin" })` if
  `!data.account`. No tenant requirement needed for the admin route (admin-ness is
  enforced in Postgres, not by tenant status).

1. **New RPC:** `public.feedback_variant_stats(p_since timestamptz default null)`
   (SECURITY DEFINER, `set search_path = public`), returns aggregated rows grouped by
   `variant`, `source`, `path`: `up_count bigint, down_count bigint, total bigint,
   up_rate numeric`. Aggregates only — no raw `note` text, no per-row data.
   - **Self-enforced authorization inside the function body**: first calls a new helper
     `public.is_app_admin() returns boolean` (SECURITY DEFINER, STABLE) which checks
     `exists (select 1 from public.app_admins where user_id = auth.uid())`. If not admin,
     `raise exception 'insufficient_privilege' using errcode = '42501';` before touching
     `feedback`.
   - **New locked-down table `public.app_admins (user_id uuid primary key references
     auth.users(id))`** — RLS enabled, zero policies, `revoke all on public.app_admins
     from anon, authenticated;` (same pattern as `leads`/`feedback`). Only readable via
     `is_app_admin()`. Migration best-effort-seeds the current owner:
     `insert into app_admins (user_id) select id from auth.users where email =
     'hamish@paychase.co.nz' on conflict do nothing;` — safe no-op if that user doesn't
     exist yet in a given environment (e.g. fresh test DB); document that a fresh
     environment needs a manual insert to grant the first admin.
   - **Grants:** `revoke execute on function public.feedback_variant_stats(timestamptz)
     from public;` then `grant execute ... to authenticated;` — **not** anon (aggregated
     stats are never anon-callable; least privilege, and doubly enforced by
     `is_app_admin()` returning false for anon's null `auth.uid()` anyway).
2. **Access boundary:** RPC is invoked via the existing `getSupabaseServerClient()`
   (anon key + session) from a new server-only fn `frontend/src/server/feedbackStats.ts`
   (`getFeedbackVariantStats`). Authorization is enforced **in Postgres** by
   `is_app_admin()`, not by any app-layer secret. The app-layer route just needs the
   user to be signed in (mirrors `/workspace`'s `getAccountState()` check); a
   non-admin signed-in tenant hitting the route gets a clean 403 from the RPC (defense
   in depth — two independent layers must agree).
3. **Where the view lives:** new route `frontend/src/routes/admin.feedback.tsx`
   (`/admin/feedback`), gated the same way `/workspace` gates on `getAccountState()`
   (redirect to `/signin` if no account) — then relies on the RPC's own admin check for
   the actual authorization boundary. Not `/workspace` (tenant self-service, wrong
   audience) and not a bare script (this project already has zero CI wiring for
   `supabase/tests/*.sql`, so a UI is more useful here for one person than a script).
4. **Statistics:** pure logic in `frontend/src/lib/variantStats.ts` (testable without
   Supabase): up-rate, Wilson score interval per variant, two-proportion z-test between
   variant A vs B per source. Constant `MIN_SAMPLE_SIZE_PER_VARIANT` (e.g. 30) guards
   against calling small samples significant.
5. **Promotion strategy — decision:** do NOT auto-promote a winning variant this pass.
   Assignment is 100% client-side (`Math.random()` in `FeedbackWidget.tsx`); promoting a
   winner would need server-side assignment or a config read at render time — out of
   scope here. Instead the admin view **flags** the statistically-significant leader
   (badge + plain note) when `total >= MIN_SAMPLE_SIZE_PER_VARIANT` per variant and
   p < 0.05. Explicitly documented as deliberate follow-up: "wire a remote-config/
   feature-flag read into FeedbackWidget variant assignment so a flagged winner can be
   promoted to 100%" — not implemented.

### File paths touched/created

| Path | Status |
|---|---|
| `supabase/migrations/20260705140000_feedback_variant_stats_rpc.sql` (app_admins table + is_app_admin() + feedback_variant_stats()) | done |
| `supabase/tests/feedback_variant_stats.sql` (follow `leads_feedback.sql` exactly) | done, passing locally |
| `frontend/src/lib/variantStats.ts` | done, verified (Fable read + spot-checked) |
| `frontend/src/lib/variantStats.test.ts` | done (16 tests pass) |
| `frontend/src/server/feedbackStats.ts` | done, verified — plain async fn, no `createServerFn` wrapper (correct: repo convention wraps at the route, see CLAUDE.md) |
| `frontend/src/server/feedbackStats.test.ts` | done (7 tests pass) |
| `frontend/src/routes/admin.feedback.tsx` | done, verified (Fable read directly) |
| `frontend/src/styles/workspace.css` (+ `.admin-callout` styles) | done |
| `README.md` (+ "Feedback & variant voting" section) | done |
| this todo.md section | DONE |

### Checklist

**T1 — Recon (Explore agent, read-only)** — DONE
- [x] Confirm exact migration file naming/location pattern
- [x] Confirm `supabase/tests/` pattern (plain SQL, `begin/rollback`, `set local role`, manual `docker exec psql` runner — see above)
- [x] Confirm no admin/dashboard surface exists (confirmed: none, fully removed)
- [x] Confirm Supabase client convention (anon key + session only, no service_role anywhere — changed the design, see above)
- [x] Report absorbed into design decisions above

**T2 — Design decisions (Fable, no spawn)** — DONE, REVISED post-T1
- [x] RPC name/signature decided (`feedback_variant_stats`, self-checks `is_app_admin()`)
- [x] Access boundary decided (Postgres-side `app_admins` table + SECURITY DEFINER check, no service_role)
- [x] Admin view location finalized: `frontend/src/routes/admin.feedback.tsx`
- [x] Promotion strategy decided (flag only, no auto-promote; documented above)

**T3 — Migration: app_admins + is_app_admin() + aggregate RPC + grants + migration test (Sonnet)** — DONE
- [x] Write migration SQL: `app_admins` table + `is_app_admin()` + `feedback_variant_stats()` function body (GROUP BY variant, source, path) — `supabase/migrations/20260705140000_feedback_variant_stats_rpc.sql`
- [x] Add explicit REVOKE from PUBLIC/anon + GRANT EXECUTE to `authenticated` only (not service_role — no such client in this app, see revised design above). `is_app_admin()` gets no grant at all (only ever called from inside another SECURITY DEFINER function's body, where current_user is already the definer/postgres — verified this holds, see migration comment)
- [x] Write migration test in `supabase/tests/feedback_variant_stats.sql` following existing pattern: asserts anon CANNOT execute, asserts non-admin authenticated user gets insufficient_privilege, asserts admin gets correct aggregates, asserts no raw row-level/`note` data leaks through
- [x] Ran local Supabase test suite (`supabase_db_YouInc` container was already up): `docker exec -i supabase_db_YouInc psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/feedback_variant_stats.sql` — all 5 PASS notices, transaction rolled back
- [ ] needs verification: confirm against hosted Supabase (only verified local; hosted/cloud not touched this pass)

**T4 — Server fn + stats util + unit tests (Sonnet)** — DONE, VERIFIED (Fable read both source files directly)
- [x] Write `frontend/src/lib/variantStats.ts`: Wilson score interval (own `erf` approx, no dep), two-proportion pooled z-test, `MIN_SAMPLE_SIZE_PER_VARIANT = 30`, `pickLeader()` (requires exactly 2 variants, both >= min sample, p < 0.05)
- [x] Write `frontend/src/lib/variantStats.test.ts` — 16 tests, AAA style, incl. the "9-of-10 vs 1-of-29 must NOT flag despite looking significant" min-sample-size guard case
- [x] Write `frontend/src/server/feedbackStats.ts`: `getFeedbackVariantStats(input?: { since?: string })` — plain async fn (not `createServerFn` — that wraps at the route per this repo's convention), calls `.rpc("feedback_variant_stats", { p_since })`, zod-validates snake_case wire shape, maps to camelCase, pools per-variant + calls `pickLeader`, throws 403 on Postgres `42501`, 500 otherwise
- [x] Write `frontend/src/server/feedbackStats.test.ts` — 7 tests, mocks `getSupabaseServerClient` (new precedent in this codebase)
- [x] `pnpm vitest run` → 20/20 new tests pass; full `pnpm test` → 289/289 pass; `tsc --noEmit` clean

**T5 — Admin view (Sonnet)** — DONE, VERIFIED (Fable read the route file directly)
- [x] Create `frontend/src/routes/admin.feedback.tsx`: `createServerFn({ method: "GET" })` wrapping a handler that catches the 403 from `getFeedbackVariantStats` and returns a discriminated `{status: "ok"|"forbidden"|"error"}` union — mirrors `workspace.tsx`'s `loadWorkspace` pattern
- [x] Loader auth gate: `getAccountState()`, `throw redirect({ to: "/signin" })` if `!data.account` — no tenant check
- [x] 403-from-RPC handled gracefully: "Not authorized" callout, no crash
- [x] Table: variant × source × path with up/down/total/up-rate, reusing `ManualBalancesEditor`'s `mb-table`/`mb-numeric`/`mb-tag` classes and `formatPercent` — no new table CSS invented
- [x] Leader callout (`.admin-callout--leader`) shown when `leader.isSignificant`, names variant + p-value, explicitly states auto-promotion is not implemented
- [x] No nav entry added; confirmed `PROTECTED_PREFIXES`/`PUBLIC_PATHS` don't exist anymore (retired with passkey auth) — route is pure file-based via `routeTree.gen.ts`, auto-registered, zero manual wiring needed
- [x] `pnpm build` (incl. `tsc --noEmit`) clean, exit 0

**T6 — Verify + integrate (Fable)** — DONE
- [x] Reviewed all diffs (`git diff --stat` on every task file) — confirmed only `EXECUTE` grant to `authenticated` on the new RPC, `feedback`/`app_admins` tables remain fully revoked from anon+authenticated, no direct table SELECT grant added anywhere
- [x] Re-ran full test suite end to end: `pnpm vitest run` → 27 files / 289 tests pass; `supabase/tests/feedback_variant_stats.sql` → 5/5 PASS against live local Supabase; `supabase/tests/leads_feedback.sql` re-run too (no regression from the new migration) → 4/4 PASS
- [x] Wrote promotion-assessment into `README.md` ("Feedback & variant voting" section, between "Live Akahu sync" and "Deployment"): documents the two RPCs, `/admin/feedback`, the significance test, and explicitly states promotion is NOT automated + why, with the manual-admin-seed SQL snippet
- [x] This todo.md section updated — all tasks done
- [x] Reporting final summary to coordinator now (no commit made — not asked)

### Summary — feature is now functional end to end
Write path (existing, untouched) → `feedback_variant_stats` RPC (admin-gated aggregate read,
migration `20260705140000`) → `getFeedbackVariantStats` server fn (`frontend/src/server/feedbackStats.ts`,
+ `frontend/src/lib/variantStats.ts` for Wilson interval / two-proportion z-test / `pickLeader`)
→ `/admin/feedback` route (owner-only view, not nav-linked). Promotion is deliberately not
automated — flagged only, documented in README. No RLS/grant hardening was weakened; new
surface is strictly additive and equally locked down (aggregates-only RPC, admin-checked
in Postgres, `authenticated`-only grant, never `anon`).

**Concurrent, unrelated work landed in the repo during this task** (Akahu OAuth flow —
`akahuOAuth.ts`, `api.akahu.*` routes, README/`​.env.example` Akahu sections) — not touched or
reviewed by this task, flagged here only so it isn't mistaken for variant-voting output.
