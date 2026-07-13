# Quiz-Funnel Onboarding — Phase B Implementation Plan (14-day live-sync trial + reminder)

> **For agentic workers:** implement task-by-task; each ends with an independently testable deliverable. Steps use `- [ ]`.

**Goal:** Give Free tenants a 14-day, no-card trial of live Akahu sync, gated at the sync security boundary, with a real automated day-12 email reminder and graceful fallback to manual on expiry.

**Architecture:** A `trial_ends_at` column on `tenants` + a `start_trial` SECURITY DEFINER RPC. All trial timing lives in a pure, unit-tested `server/trial.ts`; the sync gate (`akahuConnection.ts`) calls it. Email goes through a single `server/email.ts` (Resend over `fetch`, env-driven, no-op when unconfigured). The reminder is a secret-guarded app route (`/api/cron/trial-reminders`) driven by service-role queries, triggered by an in-repo GitHub Actions daily cron. Idempotency via `trial_reminded_at`.

**Tech Stack:** Supabase (Postgres + RLS + SECURITY DEFINER RPCs), TanStack Start server routes + `createServerFn`, Resend HTTP API, GitHub Actions cron, vitest.

## Global Constraints

- Migrations: repo-root `supabase/migrations/`, `YYYYMMDDHHMMSS_snake_case.sql`, sort after `20260706120000`. Plain SQL, idempotent-friendly. Current `tenants` columns: `id, name, slug, default_currency, suspense_account, tier ('free'|'self-serve'|'concierge'), created_at, updated_at`. `set_updated_at()` trigger already exists.
- RLS: `tenants_member_select` (members read whole row), `tenants_owner_update` (owner updates). No client INSERT. Writes to trial fields go through a SECURITY DEFINER RPC (mirror `connect_akahu` grants: `revoke ... from public; grant ... to authenticated;`).
- The sync gate is the ONLY security boundary for the Free restriction and is server-side under RLS. `connectAkahu` (akahuConnection.ts) is the enforcement point; the UI flag mirrors it.
- Pure logic modules must be dependency-free (no `~/`, no Supabase) for vitest node env; co-locate `*.test.ts`.
- Server fns lazily `import("~/server/...")`.
- Secrets via env, validated at use: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. Missing email config → `sendEmail` no-ops with a log (never throws into the ceremony). Missing `CRON_SECRET` → the cron route refuses all requests (fail closed).
- The cron route must fail closed: reject any request whose `Authorization: Bearer <CRON_SECRET>` header does not match, with 401, before doing any work.
- Honesty/FTC: trial UI shows "$15/mo after", "cancel anytime", days remaining. No card until Phase C checkout. Expiry = graceful fallback (data retained), never a lockout.
- Commit per task; stage only named files (pre-existing WIP in the tree is not ours).

## File map

```
supabase/migrations/20260713120000_tenant_trial.sql          # column + start_trial RPC
frontend/src/server/trial.ts + trial.test.ts                 # pure timing logic
frontend/src/server/akahuConnection.ts                       # MODIFY: trial-aware gate + startTrial()
frontend/src/server/akahuConnection.test.ts                  # MODIFY: extend fakes
frontend/src/server/accounts.ts                              # MODIFY: surface trialEndsAt
frontend/src/server/email.ts + email.test.ts                 # Resend sender + pure payload builder
frontend/src/server/trialReminders.ts + .test.ts             # selection logic + send orchestration
frontend/src/routes/api.cron.trial-reminders.ts             # secret-guarded cron endpoint
frontend/src/components/workspace/AkahuConnectPanel.tsx      # MODIFY: start-trial CTA + countdown
.github/workflows/trial-reminders.yml                        # daily cron trigger
frontend/CLAUDE.md                                           # MODIFY: env var docs
```

## Tasks

### Task 1 — Migration: `trial_ends_at` + `start_trial` RPC
`20260713120000_tenant_trial.sql`:
- `alter table public.tenants add column if not exists trial_started_at timestamptz;`
- `add column if not exists trial_ends_at timestamptz;`
- `add column if not exists trial_reminded_at timestamptz;`
- `create or replace function public.start_trial(target_tenant uuid) returns public.tenants` — `security definer`, `set search_path = public`; require `auth.uid()` not null; require `public.has_tenant_role(target_tenant, array['owner'])` else raise `42501`; `update public.tenants set trial_started_at = now(), trial_ends_at = now() + interval '14 days' where id = target_tenant and tier = 'free' and trial_ends_at is null returning * ` — if no row updated, raise (already trialed / not free). Revoke from public; grant to authenticated.
- Verify: SQL review; if a local `supabase` stack is running, `supabase db reset`/`migration up`; otherwise this applies on next deploy.

### Task 2 — Pure trial logic (TDD)
`server/trial.ts` (dependency-free):
- `export const TRIAL_DAYS = 14; export const REMINDER_LEAD_DAYS = 2;`
- `isTrialActive(trialEndsAt: string | null, now: Date): boolean` — true iff `trialEndsAt` present and `> now`.
- `canConnectLive(t: { tier: TenantTier; trialEndsAt: string | null }, now: Date): boolean` — `t.tier !== "free" || isTrialActive(t.trialEndsAt, now)`. (Import `TenantTier` as a type only — it's a pure union, no runtime dep.)
- `trialDaysLeft(trialEndsAt: string | null, now: Date): number | null` — ceil days remaining, null if no trial, 0 if past.
- `needsReminder(t: { trialEndsAt: string | null; trialRemindedAt: string | null }, now: Date): boolean` — true iff trial active, not yet reminded, and days-left ≤ REMINDER_LEAD_DAYS.
Test `trial.test.ts` (mirror `workspaceStage.test.ts`): boundaries at exactly now, 1 day, 2 days, expired, null; canConnectLive for each tier; needsReminder true/false incl. already-reminded.

### Task 3 — Trial-aware sync gate (`akahuConnection.ts`) + `startTrial()`
- Widen `requireTenant()` select to `"id, tier, trial_ends_at"`; add `trialEndsAt: string | null` to `TenantContext`.
- Replace `tierAllowsLiveConnect(tier)` usage with `canConnectLive({tier, trialEndsAt}, new Date())` from `./trial`.
- `getAkahuConnectionStatus`: set `canConnectLive` via the new predicate; add `trialEndsAt` + `trialDaysLeft` to `AkahuConnectionStatus`.
- `connectAkahu`: gate on `canConnectLive(...)`.
- `syncAkahuAccount`: after resolving tenant, if `!canConnectLive(...)` throw `throwServerError("TRIAL_ENDED: your free trial of live sync has ended — add a card to keep syncing, or keep using manual accounts.", 403)`. (Data stays; only new pulls stop.) This means `syncAkahuAccount` must fetch tier+trial (use `requireTenant()` not `requireTenantId()`).
- Add `export async function startTrial(): Promise<AkahuConnectionStatus>` — resolves tenant, calls `supabase.rpc("start_trial", { target_tenant: tenant.id })`, then returns fresh `getAkahuConnectionStatus()`.
- Extend `akahuConnection.test.ts` tenant fakes with `trial_ends_at` (null and future) and assert: free+no-trial → canConnectLive false + connect 403; free+active-trial → canConnectLive true + connect allowed; expired → sync 403.

### Task 4 — Surface trial in `accounts.ts`
Add `trial_ends_at` to the `.select`, `TenantRow`, and `TenantSummary` (`trialEndsAt: string | null`); map in both `getAccountState` and `createTenant`. (Lets route loaders/UI show trial state without an extra call.)

### Task 5 — Email sender (`server/email.ts`)
- Pure `buildResendPayload({from, to, subject, html, text})` → the JSON body; unit-test it.
- `sendEmail(msg)`: if `!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM` → `console.info("[email] skipped (unconfigured)")` and return `{ sent: false }`. Else `fetch("https://api.resend.com/emails", { method: POST, headers: { Authorization: Bearer, "Content-Type": json }, body })`; on non-2xx log + return `{ sent: false, error }`; never throw. Return `{ sent: true, id }`.

### Task 6 — Reminder orchestration + cron route
- `server/trialReminders.ts`: pure `selectTenantsNeedingReminder(rows, now)` filtering via `needsReminder` — unit-test it. `sendTrialReminders()`: use the **service-role** client (`~/server/supabaseAdmin`) to select tenants with a non-null `trial_ends_at`, `trial_reminded_at is null`, `tier = 'free'`; for each needing a reminder, resolve the owner's email (via membership → auth user; reuse existing admin patterns), `sendEmail(trialReminderMessage(daysLeft))`, then set `trial_reminded_at = now()`. Return a summary `{ considered, sent }`.
- Route `routes/api.cron.trial-reminders.ts` (TanStack server route): read `Authorization` header; if `!CRON_SECRET` or mismatch → 401 fail-closed; else `await sendTrialReminders()`, return JSON summary. (Mirror `routes/api.akahu.callback.ts` for the server-route shape.)

### Task 7 — GitHub Actions scheduler
`.github/workflows/trial-reminders.yml`: `on.schedule cron: "0 19 * * *"` (daily; ~7am NZT) + `workflow_dispatch`; a `curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.CRON_TARGET_URL }}/api/cron/trial-reminders"`. Document required repo secrets.

### Task 8 — UI: start-trial CTA + countdown (`AkahuConnectPanel.tsx`)
- Add `startTrialFn` (POST server fn → `startTrial()`).
- In the `!status.canConnectLive` branch: if no trial started yet, show **"Try live sync free for 14 days"** button (calls startTrialFn) with sub-copy "$15/mo after, cancel anytime — no card now"; if trial expired, show the existing upgrade-to-/pricing link reworded ("Your free trial ended — …").
- When `status.canConnectLive` and `trialDaysLeft` is set, show a countdown banner: **"{n} days of live sync left — add a card to keep it"** near the connect controls.

### Task 9 — Docs
Update `frontend/CLAUDE.md` env section: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (+ the GH Actions `CRON_TARGET_URL` secret), and a short runbook: create Resend account, verify sending domain, set the three secrets in Fly + the two in GH Actions, enable the workflow.

## Verification
- `pnpm vitest run` (trial.test, email.test, trialReminders.test, akahuConnection.test) green.
- `pnpm build` (tsc) clean.
- Manual/security review of the migration, the sync-gate change, and the cron route (fail-closed auth). Run security-reviewer on the diff.

## Owner action items (cannot be done from code)
1. Create Resend (or alternative) account + verify sending domain (`youinc.hamishburke.dev`).
2. Set `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` on the Fly app; `CRON_SECRET` + `CRON_TARGET_URL` as GitHub Actions secrets.
3. Apply the migration to Supabase Cloud.
4. Enable the GitHub Actions workflow.
