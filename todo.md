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
- [ ] Self-service follow-ups (rest of Phase 2): (a) real Akahu connect flow for self-serve tenants
  (OAuth + Vault token storage per `akahu_connections`), replacing the sample-data button with a
  live sync; (b) grow `/workspace` toward the full widget dashboard (reuse DashboardGrid on the
  per-tenant `LedgerDashboardData` once the remaining read aggregates are ported); (c) per-tenant
  rules/classification editing UI so users can re-route transactions.
- [ ] Maybe work on infra: How this is all hosted and secure. (untracked supabase/ migrations + docs/architecture/ + tests/golden/ from separate work exist in the repo — not part of the marketing revamp branch)
- [ ] Optional polish (from review): demo opens with the red "books not decision-grade" exception from 50 sample suspense items — honest but alarming as a first impression; consider a calmer sample backlog. Action Center widget is tall/sparse at its default size.
