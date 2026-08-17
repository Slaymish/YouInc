# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The TanStack Start (React 19 + Nitro) frontend for **YouInc**, a self-hosted
personal ERP: an executive dashboard over a double-entry ledger held in Postgres
(Supabase), with live bank sync via the operator's own Akahu credentials.

**YouInc is not sold.** There are no tiers, no trials, no billing, and no hosted
accounts. youinc.net serves the sample-data demo and the docs; anyone who wants
to use it on real money runs their own instance. Do not reintroduce a price, a
plan, a booking link, or an entitlement check — `marketing/config.test.ts`
asserts against exactly that.

The same app also serves the **public site** (landing page, live demo, and the
widget-library page) — see "Marketing surface" below.

> **Doc debt (2026-08-18):** sections below still describe a local-first SQLite
> ledger fed by a Python CLI, a passkey/WebAuthn gate, `/dashboard`, `/login`,
> `server/ledger.ts` and `server/auth.ts`. All of that was removed earlier (see
> commits `6065eee` and `f17e25e`) and none of those files exist. Treat the
> Supabase/`/workspace` sections as current and the SQLite/passkey ones as
> history until this file gets a proper pass.

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

- `AKAHU_CA_BUNDLE` — PEM CA bundle for TLS-inspecting networks (Akahu sync only)
- `YOUINC_ALLOW_PROXY=1` — opt back into proxy env vars during CLI shell-outs
- `YOUINC_RP_ID` / `YOUINC_RP_ORIGIN` — WebAuthn relying-party id/origin. Derived from the request by default (works for localhost and a deployed domain); override only behind a proxy that rewrites Host/Origin.


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
### Akahu connect + live sync (Phase 2, third slice)

Self-service tenants connect their own bank via Akahu:
- **Auth model:** the Akahu APP token is a server-wide secret (`AKAHU_APP_TOKEN` env, never in the client bundle); each user supplies their enduring USER token via the `/workspace` connect form. The user token is stored **encrypted in Supabase Vault** through `SECURITY DEFINER` RPCs (`connect_akahu` / `get_akahu_user_token` / `disconnect_akahu`, migration `20260704120006`) — only the secret uuid lands on `akahu_connections`, and the token is read server-side only, never returned to the browser.
- `src/server/akahuClient.ts` — a TS port of the Python `AkahuClient` (same headers, cursor pagination, error messages) using `fetch`.
- `src/server/akahuConnection.ts` — orchestration: `connectAkahu` / `disconnectAkahu` / `getAkahuConnectionStatus` / `listConnectedAccounts` / `syncAkahuAccount` (pulls txns → `ingestTenantPayloads` → Postgres, updates `last_synced_at`, idempotent).
- `src/components/workspace/AkahuConnectPanel.tsx` — the connect/list/sync/disconnect UI on `/workspace`. When no app token is configured it degrades to a “not enabled” note (manual accounts + sample data still work).
- **Still deferred (rest of P2):** growing `/workspace` toward the full widget dashboard; per-tenant rules/classification editing UI; scheduled/background sync (currently on-demand per account). The owner's rich SQLite `/dashboard` remains separate and single-tenant.

**Session gate (`start.ts`).** Uses a **protected-prefix** model, not an allowlist: only paths under `PROTECTED_PREFIXES` (`/dashboard`) require a passkey session; everything else (marketing, static, demo, and the Supabase auth flow) is public by default. **Adding a new public page needs no change here.** As defense in depth, every data/mutating server function still calls `requireSession()` (passkey) or checks the Supabase user itself, so data never leaves the server without auth even though the gate lets serverFn requests through.

> **reflect-metadata polyfill (prod-only bug):** `@simplewebauthn/server` pulls in `@peculiar/x509` + `tsyringe`, whose decorators call the global `Reflect.getMetadata` **at import time**. Dev works because Vite serves x509 unbundled (its own `import "reflect-metadata"` runs); but the prod Nitro/rolldown build annotates reflect-metadata `@__PURE__` and tree-shakes that side-effect import out (the app's `package.json` has `"sideEffects": false`, and x509's reflect-metadata gets merged into the same lazy `_libs` chunk it lives in). The result: passkey ceremonies throw `Reflect.getMetadata is not a function` in prod. In-bundle fixes don't survive the bundler (a bare/consumed `import "reflect-metadata"` is either dropped or drags x509's eval ahead of the polyfill's own init). **Fix:** preload the polyfill at the Node process level with `node --require`, so the global is installed before any app chunk evaluates. `@simplewebauthn/server` is still imported **lazily** inside each ceremony (keeps native/x509 code out of the client bundle). The wiring: `scripts/stage-reflect-polyfill.mjs` (run by `pnpm build`) copies `reflect-metadata`'s CJS entry to `.output/server/reflect-metadata-polyfill.cjs` (the runtime image copies only `.output`), and both the `start` script and `docker/entrypoint.sh` launch with `--require .../reflect-metadata-polyfill.cjs`. `reflect-metadata` is a direct dependency so the staging step can resolve it.

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

- Routes: `/` (`MarketingPage`), `/demo` (real dashboard on sample data),
  `/widgets` (live widget catalogue), plus the static trust/docs pages.
  `MarketingHeader`/`MarketingFooter` are shared across them.
- `config.ts` is the single source of marketing copy. It exports `PRODUCT`,
  `USE_PATHS` (demo and self-host — the only two ways to use YouInc),
  `SOURCE_URL` and `SELF_HOST_URL`. **`config.test.ts` asserts that no currency
  amount, plan, trial, or billing word appears anywhere in that copy.**
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
- Public CTAs go to `/demo` or to `SELF_HOST_URL` on GitHub. `StartFreeCta.tsx`,
  `WaitlistForm.tsx`, `PricingTable.tsx`, `PricingLedger.tsx`, `ConciergeShowcase.tsx`
  and the `/pricing`, `/custom-builds`, `/start` routes were all removed with the
  commercial surface. `server/leads.ts` remains but nothing renders it.

## Conventions specific to this codebase

- This frontend is read-mostly. The Python CLI owns the ledger schema and posting logic; do not
  re-implement double-entry or classification here. Mutations go through the CLI or the two
  frontend-owned surfaces (`manual_account_balances`, `rules.yaml` mappings).
- New SQLite reads belong in `readLedgerDashboard` and should be reflected in the
  `LedgerDashboardData` type so widgets stay typed off one payload.
- Keep raw SQL `snake_case` query-row types adjacent to their query and map to `camelCase`
  domain types before returning (the file already follows this everywhere).
- Theme is light/dark via `data-theme` on `<html>`, persisted to `localStorage` key `youinc-theme`.
