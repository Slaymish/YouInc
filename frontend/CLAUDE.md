# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The TanStack Start (React 19 + Nitro) frontend for **YouInc Ledger**, a local-first
personal ERP. It is a read-mostly executive dashboard over a local double-entry SQLite
ledger that is produced by a separate Python CLI (`youinc_ledger`) living in the parent
repository (`../`). This frontend does not own the schema; it reads the same SQLite file
the Python pipeline writes, and shells out to the Python CLI for live ingestion.

The same app also serves the **public marketing site** (landing page, live demo,
custom-builds and widget-library pages) — see "Marketing surface" below.

## Commands

This project uses **pnpm**. From the repo root, `./youinc frontend` runs the dev server
with proxy vars stripped; the raw scripts are:

```sh
pnpm dev      # vite dev server on http://localhost:3000
pnpm build    # vite build && tsc --noEmit (typecheck is part of build)
pnpm preview  # preview the production build
pnpm start    # run the built Nitro server (.output/server/index.mjs)
```

There is no separate lint runner wired up. Typechecking is `tsc --noEmit` (run via
`pnpm build`). Unit tests for pure logic run under **vitest** (`pnpm test`); test files
are co-located as `*.test.ts` and run in a node environment via `vitest.config.ts`
(which intentionally does not load the app's Vite plugins). E2E tests run under
**Playwright** (`pnpm test:e2e`); specs live in `e2e/` (`landing.spec.ts`,
`marketing-pages.spec.ts`) and cover the public pages — landing render, waitlist flow,
the /demo dashboard shell, and public access to /custom-builds and /widgets. `better-sqlite3` is a native module whose build script is allowlisted in
`package.json` (`pnpm.onlyBuiltDependencies`). If `pnpm install` fails with
`ECONNREFUSED 127.0.0.1:8080`, a local proxy is configured but not running — re-run with
proxy vars unset:

```sh
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u https_proxy -u http_proxy -u all_proxy pnpm install
```

## Runtime configuration (env vars)

All paths default relative to the `frontend/` cwd and assume the standard parent-repo layout:

- `YOUINC_DB_PATH` — SQLite ledger (default `../data/youinc-ledger.sqlite3`)
- `YOUINC_RULES_PATH` — classification rules YAML (default `../config/rules.yaml`)
- `YOUINC_PROJECT_ROOT` — Python project root; auto-detected by walking up to a dir with `pyproject.toml`
- `YOUINC_PYTHON` — python executable; defaults to `<root>/.venv/bin/python`, else `python3`
- `AKAHU_CA_BUNDLE` — PEM CA bundle for TLS-inspecting networks (Akahu sync only)
- `YOUINC_ALLOW_PROXY=1` — opt back into proxy env vars during CLI shell-outs
- `YOUINC_ENROLLMENT_TOKEN` — set temporarily to enrol a passkey via the `/login` "Enrol a new passkey" form, then unset to disable registration. Unset by default (registration disabled).
- `YOUINC_RP_ID` / `YOUINC_RP_ORIGIN` — WebAuthn relying-party id/origin. Derived from the request by default (works for localhost and a deployed domain); override only behind a proxy that rewrites Host/Origin.
- `YOUINC_AUTH_DB_PATH` — passkey credential + session store (default `../data/youinc-auth.sqlite3`, separate from the ledger).

## Architecture

### Global middleware

`src/start.ts` configures TanStack Start's `requestMiddleware`, which runs before every request (pages, SSR, server functions). It holds the **passkey session gate** plus the CSRF middleware that Start installs automatically when there is no `start.ts` — defining a custom `start.ts` opts out of that default, so it's re-added explicitly here.

### Auth — two independent systems

There are **two** auth systems, for two different audiences:

**1. Passkey / WebAuthn (the local owner's private dashboard).**
`src/server/auth.ts` is the server-only, single-user passkey module. It uses `@simplewebauthn/server` for the registration/authentication ceremonies and a small separate SQLite file (`YOUINC_AUTH_DB_PATH`) for the one credential, live sessions, and pending challenges. `src/routes/login.tsx` runs the browser ceremony with `@simplewebauthn/browser`; registration is gated by `YOUINC_ENROLLMENT_TOKEN`. This protects only `/dashboard` (the local SQLite ledger view).

**2. Supabase Auth (public self-service signup + multi-tenant).**
The self-service flow lets anyone create an account and their own tenant. `src/lib/supabaseConfig.ts` resolves the URL/anon key (defaults to the local `supabase start` stack; prod sets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). `src/lib/supabaseBrowser.ts` is the browser client; `src/server/supabaseServer.ts` is the request-cookie-backed server client (runs under the user's RLS context — **not** service_role). `src/server/accounts.ts` wraps the tenancy operations: `getAccountState`, `createTenant` (calls the `create_tenant` RPC from migration `20260704120005`), `signOutUser`.
- Routes: `/signup`, `/signin` (Supabase email+password), `/onboarding` (multi-step: welcome → name your workspace → connect), and `/workspace` (the signed-in self-service home). Each Supabase-gated route gates itself in its own loader (redirects to `/signin` when signed out), not via the session gate.
- **Email confirmation:** local `supabase/config.toml` has `enable_confirmations = false`, so `signUp` returns a live session and `/signup` routes straight into onboarding. In production (confirmations on) `signUp` returns a user but no session; `/signup` then shows a "check your email" state instead of navigating. Both paths are handled in `routes/signup.tsx`.

### Workspace ledger (Phase 2, first slice)

`src/server/workspaceLedger.ts` is the **tenant-scoped Postgres DAL** for the self-service `/workspace`. It reads/writes `manual_account_balances` through the request-cookie Supabase client (the user's RLS context — never service_role), always filtering/​setting `tenant_id` explicitly. `getWorkspaceLedger` summarizes into net worth / assets / liabilities using the SAME conventions as the SQLite dashboard (assets positive, liabilities negative, net worth = assets − liabilities; account "type" = first `:`-segment via `server/accountType.ts`). `upsertWorkspaceBalance` / `deleteWorkspaceBalance` are the mutations, surfaced by `components/workspace/ManualBalancesEditor.tsx`.

- Pure helpers live in their own plugin-free modules so vitest can unit-test them without dragging in the Supabase client: `server/accountType.ts` and `server/workspaceSummary.ts` (`combineBalances` — the journal+manual merge with the manual-supersedes-parent rule and net-worth math).

### Tenant ingestion (Phase 2, second slice)

`src/server/tenantIngestion.ts` is the **WRITE half** of the multi-tenant ledger: it turns Akahu payloads into per-tenant `raw_transactions` + double-entry `journal_transactions`/`journal_entries` using the SAME ported engine the golden tests pin (`LedgerPipeline` + `RulesRouter`), persisted under the caller's RLS context.

- The engine is synchronous but Supabase is async, so `ingestTenantPayloads` (1) preloads the tenant's existing raw hashes + journal external_ids + manual classifications, (2) runs the pure pipeline in-memory via a `CapturingLedgerStore` to compute exactly which rows are NEW, then (3) bulk-persists the deltas. Dedup on `idempotency_hash` / `external_id` makes re-runs converge (idempotent), matching the SQLite path.
- `loadTenantRules` rebuilds the `RulesConfig` from the tenant's `classification_rules` / `account_mappings` / `nzfcc_mappings` rows (the DB form of the old `rules.yaml`), ordered by `(priority, seq)`.
- `src/server/sampleIngestion.ts` (`loadSampleData`) seeds a starter account mapping + rules and ingests a built-in sample Akahu batch — the “Load sample transactions” button on `/workspace`. It's the demonstrable synced-ledger loop before Akahu OAuth ships.
- `getWorkspaceLedger` now reads `journal_entries` (debit +, credit −) and merges them with manual balances via `combineBalances`; `/workspace` shows a “Synced ledger” panel when journal balances exist.
- **Still deferred (rest of P2):** real Akahu OAuth connect + Vault token storage per `akahu_connections`, and growing `/workspace` toward the full widget dashboard. The owner's rich SQLite `/dashboard` remains separate and single-tenant.

**Session gate (`start.ts`).** Uses a **protected-prefix** model, not an allowlist: only paths under `PROTECTED_PREFIXES` (`/dashboard`) require a passkey session; everything else (marketing, static, demo, and the Supabase auth flow) is public by default. **Adding a new public page needs no change here.** As defense in depth, every data/mutating server function still calls `requireSession()` (passkey) or checks the Supabase user itself, so data never leaves the server without auth even though the gate lets serverFn requests through.

> **reflect-metadata ordering:** `@simplewebauthn/server` pulls in `@peculiar/x509` + `tsyringe`, whose decorators call `Reflect.getMetadata` at import time. The bundler tree-shakes tsyringe's own polyfill, so `auth.ts` statically imports `src/server/reflect-polyfill.ts` (consumed, not tree-shaken) and imports `@simplewebauthn/server` **lazily** inside each ceremony function — never statically, which the bundler would hoist ahead of the polyfill.

### Data flow

`src/server/ledger.ts` is the single server-only module and the heart of the app. It:

1. Opens the SQLite file **read-only** with `better-sqlite3` and runs all reporting queries,
   assembling one `LedgerDashboardData` object (balances, P&L, breakdowns, pipeline health,
   routing confidence, source accounts, net-worth trend, recent journal, etc.).
2. Shells out to the Python CLI via `execFile` for mutating/live operations: `syncLedger`,
   `reclassifyLedger`, `listAkahuAccounts`. These build a sanitized env (`buildSyncEnvironment`)
   that strips generic CA-bundle and proxy vars so local mitmproxy/corporate certs never
   silently affect banking ingestion.
3. Directly read/writes `config/rules.yaml` for source-account → ledger-account mappings
   (`upsertAccountMapping`) using hand-rolled, indentation-aware YAML editing — no YAML lib.
4. Owns the only table this frontend writes: `manual_account_balances` (`upsertManualBalance`),
   created lazily. Manual balances supersede journal-derived balances for the same account
   **and** any journal-derived parent prefix.

The route at `src/routes/dashboard.tsx` exposes `readLedgerDashboard()` through a TanStack
`createServerFn` GET and loads it in the route `loader` (`src/routes/index.tsx` is the public
marketing page; it only checks for a session and redirects authenticated users to
`/dashboard`). The whole dashboard UI renders from that one loader payload — there is no
client-side data store. Mutations are defined as `createServerFn`
POST handlers colocated in the widgets that use them (see `IngestionWidget`, `ManualAccountsWidget`,
`SourceSystemsWidget`), and they call `router.invalidate()` to refetch the dashboard.

> Server functions lazily `import("~/server/ledger")` inside the handler so the SQLite/native
> code never ends up in the client bundle. Keep that pattern when adding new server fns.

### Money & dates

All amounts are integer **cents** end to end (`*Cents` fields). Format only at the edge with
the helpers in `src/components/widgets/format.ts` (`formatMoney`, `shortMoney`, `formatPercent`,
`formatMonths`, `leafAccount`). Pure derived series (rolling averages, runway projection, asset
mix, month pulse) live in `src/components/widgets/derive.ts`. Locale is `en-NZ`, currency NZD.

### Dashboard grid system

The dashboard is a custom 12-column draggable/resizable grid — not a library layout.

- `src/components/dashboard/widgets.ts` — `WIDGET_REGISTRY` (single source of truth for every
  widget's id, label, category, default and min sizes) and `WIDGET_MAP`.
  **Adding a widget means: add a `WidgetDefinition` here, add the `WidgetId` union member, and
  wire the component into `renderWidgetContent` in `renderWidget.tsx`.** If it is purely
  presentational (reads only the `dashboard` prop, no server functions), also add it to
  `DEMO_WIDGET_IDS` in `marketing/demoWidgets.ts` so it appears on `/demo` and `/widgets`.
- `src/components/dashboard/grid.ts` — pure layout math (collision resolution, vertical
  compaction, clamping, snap). All functions are immutable/pure; keep them that way.
- `src/components/dashboard/dashboardStorage.ts` — pure load/persist/allowlist-filter logic
  for layout state (`DEFAULT_DASHBOARD_STORAGE_KEY` = `youinc-dashboard-views-v2`), unit-tested.
- `src/components/dashboard/useDashboardLayout.ts` — layout state + edit mode on top of
  `dashboardStorage`. Edit mode snapshots layout so Cancel can restore. Takes optional
  `{ storageKey, allowedWidgetIds }`; defaults preserve the real dashboard's behavior exactly.
- `DashboardGrid.tsx` uses `@dnd-kit` for drag, renders `DashboardPanel`s, and threads the same
  optional `storageKey`/`allowedWidgetIds` props through to the layout hook and `WidgetPicker`.
  The six `metric-*` ids all render through the shared `MetricWidget`.
- The public `/demo` route reuses `DashboardGrid` on `SAMPLE_DASHBOARD` with its own storage key
  (`youinc.demo.layout.v1`) and `DEMO_WIDGET_IDS` as the allowlist, so demo edits never touch a
  real user's saved layout and session-gated widgets never mount without a session.

Each widget component takes `{ dashboard: LedgerDashboardData }` and is otherwise self-contained.
Use `NoData` for empty states.

### Marketing surface (public pages)

`src/components/marketing/` holds the public site; all pages force light theme via
`useLightTheme` and live inside the `.mk` CSS scope (`marketing.css`, light-first palette
variables, deliberately not coupled to the app's `data-theme` tokens).

- Routes: `/` (`MarketingPage`), `/demo` (real dashboard on sample data), `/custom-builds`
  (bespoke-service pitch), `/widgets` (live widget catalogue). All four must be listed in
  `PUBLIC_PATHS` in `start.ts`. `MarketingHeader`/`MarketingFooter` are shared across them.
- `config.ts` is the single source of marketing copy + pricing. **Unit tests pin the price
  strings** (`"NZD $15"`, `"From NZD $149"`) — change tests and copy together, deliberately.
- `sampleDashboard.ts` is the demo dataset (a full `LedgerDashboardData`). Watch the two
  `accountType` domains: **balances** use the path-derived `"Assets"`/`"Liabilities"` (see
  `accountType()` in `server/ledger.ts`), while **source accounts** use lowercase
  `"asset"`/`"liability"`. Mixing them silently blanks widgets that filter balances.
- `demoWidgets.ts` — `DEMO_WIDGET_IDS` is the vetted allowlist of presentational widgets for
  public pages. The four excluded ids (`ingestion`, `manual-accounts`, `source-systems`,
  `suspense-queue`) call session-gated server functions and would 401 without a session.
- CSS trap: `.mk section` applies section padding to *every* `<section>` inside `.mk`. Widgets
  and dashboard panels emit `<section>`s, so any real widget rendered inside `.mk` needs a
  scoped padding reset (see the `.wl-cat` override in `marketing.css` and commit `7bb90d6`).
- The landing showcase (`DashboardFrame`) and Concierge artifacts (`ConciergeShowcase`) are
  designed marketing objects; the Concierge artifacts are explicitly mock-ups of bespoke work,
  not shipped features — keep that framing honest when editing copy.
- The self-serve CTA is now **live signup**: `StartFreeCta.tsx` links to `/signup` (it
  replaced the old `WaitlistForm` in the hero, pricing, pricing table, and final CTA).
  `WaitlistForm.tsx` + `server/leads.ts` remain for concierge lead capture but are no longer
  rendered on the self-serve path. `VITE_YOUINC_BOOKING_URL` overrides the concierge booking
  link (`resolveBookingUrl` in `config.ts`).

## Conventions specific to this codebase

- This frontend is read-mostly. The Python CLI owns the ledger schema and posting logic; do not
  re-implement double-entry or classification here. Mutations go through the CLI or the two
  frontend-owned surfaces (`manual_account_balances`, `rules.yaml` mappings).
- New SQLite reads belong in `readLedgerDashboard` and should be reflected in the
  `LedgerDashboardData` type so widgets stay typed off one payload.
- Keep raw SQL `snake_case` query-row types adjacent to their query and map to `camelCase`
  domain types before returning (the file already follows this everywhere).
- Theme is light/dark via `data-theme` on `<html>`, persisted to `localStorage` key `youinc-theme`.
