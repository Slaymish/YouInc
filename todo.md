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
  (`server/akahuConnection.ts`), and the `/workspace` `AkahuConnectPanel`. Users
  paste their Akahu user token (stored encrypted in Vault, never returned to the
  browser), list accounts, and sync transactions into their per-tenant ledger.
  E2E-covered against a mock Akahu API (connect → list → sync → idempotent →
  disconnect).
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
- [ ] Maybe work on infra: How this is all hosted and secure. (untracked supabase/ migrations + docs/architecture/ + tests/golden/ from separate work exist in the repo — not part of the marketing revamp branch)
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
