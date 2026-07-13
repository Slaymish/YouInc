# Quiz-Funnel Onboarding — Phase C Implementation Plan (Stripe billing)

> **For agentic workers:** implement task-by-task; each ends with an independently testable deliverable. Steps use `- [ ]`. This is payment + webhook code — run `security-review` on the diff before merge.

**Goal:** Let a Free/trialing tenant subscribe to live sync (NZD $15/mo) via Stripe Checkout, keep `tenants.tier` in sync with the Stripe subscription via a signature-verified webhook, and give a self-serve cancel/manage path via the Stripe Customer Portal — all while making it impossible for a client to set its own tier.

**Architecture:** Stripe is reached through the official `stripe` SDK (needed for webhook signature verification and Checkout/Portal session creation). Tier is a **server-only** truth: the only writer of `tenants.tier` becomes the webhook handler running under the service role; client UPDATE rights on `tenants` are narrowed by column grants so an owner can rename their workspace but never change `tier`/trial/billing columns. Subscription metadata lives in a new `tenant_billing` table. The Phase B `canConnectLive` gate already keys off `tenants.tier`, so once the webhook flips tier, live sync turns on/off with no further wiring.

**Tech Stack:** Stripe (Checkout + Billing + Customer Portal + Webhooks), `stripe` npm SDK, Supabase (Postgres + RLS + service role), TanStack Start server routes + `createServerFn`, vitest.

## Global Constraints

- Secrets are server-only (never `VITE_`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (the recurring NZD $15/mo price), and reuse `SUPABASE_SERVICE_ROLE_KEY`. Validate presence at use; read paths degrade to "billing not configured" rather than throwing into a page render.
- **The webhook is the only writer of `tenants.tier`.** It runs under the service role (RLS bypass). No client path may set tier.
- **Webhook signature verification is mandatory.** Read the RAW request body (`await request.text()`) and call `stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET)`. Never `JSON.parse` before verifying. Reject with 400 on any verification failure (fail closed). If `STRIPE_WEBHOOK_SECRET` is unset, the route refuses all requests.
- **Webhook handling is idempotent.** Stripe retries and can deliver out of order; use upserts keyed by `tenant_id`/`stripe_customer_id` and treat handlers as convergent (set state to match the event), not incremental. Optionally record processed `event.id`s.
- Pure logic (status→tier mapping) lives in a dependency-free module with co-located `*.test.ts` (vitest node env). Server fns lazily `import("~/server/...")`.
- Migrations: repo-root `supabase/migrations/`, `YYYYMMDDHHMMSS_snake_case.sql`, sort after `20260713120000`. `set_updated_at()` trigger + `has_tenant_role` helper already exist. Current `tenants.tier check` allows `('free','self-serve','concierge')`.
- Honesty/FTC: Stripe Checkout natively discloses price, cadence, and auto-renewal and captures explicit consent; the Customer Portal provides easy self-serve cancellation (satisfies the "easy to cancel" rule). On cancel/lapse the tenant reverts to `free` with all data retained — never a lockout.
- Commit per task; stage only named files (there is unrelated working-tree WIP — do not stage it).

## Security prerequisite (do FIRST — see Task 1)

`20260704120004_grants.sql` grants `select, update on public.tenants to authenticated` with **no column restriction**, and `tenants_owner_update` RLS lets an owner update their own row. Today an owner can therefore `UPDATE tenants SET tier='self-serve'` directly via the client Supabase client and bypass billing. Phase C MUST close this before shipping Checkout, or the whole paywall is trivially defeated.

## File map

```
supabase/migrations/20260714120000_billing.sql   # tenant_billing table + column-grant lockdown
frontend/package.json                            # add "stripe"
frontend/src/server/stripe.ts                    # SDK client factory + config/env
frontend/src/server/billing.ts                   # checkout/portal + applySubscriptionState (service role)
frontend/src/server/billingStatus.ts + .test.ts  # pure status→tier mapping
frontend/src/routes/api.stripe.webhook.ts        # signature-verified webhook
frontend/src/components/workspace/BillingPanel.tsx   # plan status + subscribe/manage buttons
frontend/src/components/workspace/AkahuConnectPanel.tsx  # MODIFY: expiry/countdown CTAs → checkout
frontend/src/routes/workspace.settings.tsx       # MODIFY: mount BillingPanel
frontend/CLAUDE.md                               # env docs + runbook
```

## Tasks

### Task 1 — Migration: `tenant_billing` + lock down tier writes (SECURITY)
`20260714120000_billing.sql`:
- `create table public.tenant_billing ( tenant_id uuid primary key references public.tenants(id) on delete cascade, stripe_customer_id text unique, stripe_subscription_id text, status text, current_period_end timestamptz, updated_at timestamptz not null default now() );` + `set_updated_at` trigger.
- RLS: enable; `tenant_billing_member_select` for select `using (public.is_tenant_member(tenant_id))`. **No client insert/update/delete policy** — only the service role (RLS bypass) writes it.
- **Column-grant lockdown on `tenants`:** `revoke update on public.tenants from authenticated;` then `grant update (name, default_currency, suspense_account) on public.tenants to authenticated;` — owners keep renaming rights (RLS `tenants_owner_update` still applies to those columns) but can no longer write `tier`, `trial_started_at`, `trial_ends_at`, `trial_reminded_at`. (Trial arming stays via the SECURITY DEFINER `start_trial` RPC, which is unaffected by column grants.)
- Verify: SQL review; if a local supabase stack runs, apply and confirm an authenticated `update tenants set tier=...` is rejected while `update tenants set name=...` succeeds.

### Task 2 — Stripe client + config (`server/stripe.ts`)
- Add `stripe` to `frontend/package.json` dependencies.
- `export function getStripe(): Stripe` — lazily construct `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: <pinned> })`; throw a clear 503 via `throwServerError` if the key is missing.
- `export function billingConfigured(): boolean` — true iff `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set (drives the UI's "billing not enabled" degrade).

### Task 3 — Pure status→tier mapping (TDD) (`server/billingStatus.ts`)
- `export type StripeSubStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";`
- `export function subscriptionGrantsPaid(status: string): boolean` — true for `active`/`trialing` (and `past_due` if you choose a grace window; default: false). 
- `export function tierForSubscription(status: string): "self-serve" | "free"` — `subscriptionGrantsPaid(status) ? "self-serve" : "free"`.
- Test `billingStatus.test.ts`: each status → expected tier; unknown status → free.

### Task 4 — Checkout + Portal + state application (`server/billing.ts`)
- `ensureStripeCustomer(tenantId, email)` — read `tenant_billing.stripe_customer_id`; if absent, `stripe.customers.create({ email, metadata:{ tenant_id } })`, upsert into `tenant_billing` (service role). Return the customer id.
- `createCheckoutSession()` (called by a user-context server fn): resolve tenant + owner email (RLS), `ensureStripeCustomer`, then `stripe.checkout.sessions.create({ mode:"subscription", customer, line_items:[{ price: STRIPE_PRICE_ID, quantity:1 }], client_reference_id: tenantId, subscription_data: { trial_end: <tenant.trial_ends_at epoch, if still in future> , metadata:{ tenant_id } }, success_url: <…/workspace/settings?billing=success>, cancel_url: <…/workspace/settings?billing=cancel> })`; return `{ url }`. (Passing `trial_end` means subscribing mid-trial doesn't double-charge — Stripe starts billing when the app trial ends.)
- `createPortalSession()` — `stripe.billingPortal.sessions.create({ customer, return_url })`; return `{ url }`.
- `applySubscriptionState(customerId, subscription)` (service role, called by the webhook): upsert `tenant_billing` (status, stripe_subscription_id, current_period_end) keyed by `stripe_customer_id`, look up its `tenant_id`, then `update tenants set tier = tierForSubscription(status)` for that tenant. Idempotent/convergent.

### Task 5 — Webhook route (`routes/api.stripe.webhook.ts`)
- Server route POST. If `!STRIPE_WEBHOOK_SECRET` → 400 (fail closed). Read `const raw = await request.text()` and `const sig = request.headers.get("stripe-signature")`; `stripe.webhooks.constructEvent(raw, sig, secret)` inside try/catch → 400 on failure. Never parse before verify.
- Handle: `checkout.session.completed` (retrieve the subscription, `applySubscriptionState`), `customer.subscription.updated`, `customer.subscription.deleted` (→ `applySubscriptionState`, which will set tier back to `free` on canceled). Ignore other event types with 200.
- Return 200 `{ received: true }` on success; 500 only on unexpected server error (Stripe will retry).
- Note: this is a server route, not a serverFn, so the global CSRF middleware doesn't apply — correct here (auth is the Stripe signature, not a cookie).

### Task 6 — Server fns + BillingPanel UI
- In `BillingPanel.tsx`: `createServerFn` POST wrappers for `createCheckoutSession` / `createPortalSession` (lazy import). Render: current plan (from `getAccountState().tenant.tier` + `tenant_billing.status` via a small loader), a **"Add a card — NZD $15/mo"** button (→ checkout URL, full-page redirect) when free/trialing, and a **"Manage billing"** button (→ portal) when subscribed. Show the `?billing=success|cancel` banner (mirror AkahuConnectPanel's URL-param pattern).
- Mount `BillingPanel` in `routes/workspace.settings.tsx`.

### Task 7 — Wire the Phase B CTAs to real checkout
- In `AkahuConnectPanel.tsx`, replace the two "add a card"/"Keep live sync" links to `/pricing` (the trial countdown banner and the expired-trial branch) with the Checkout trigger (or a link to the settings Billing section). Keep copy honest (price + cancel anytime).

### Task 8 — Docs + runbook (`CLAUDE.md`)
Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`. Runbook: create Stripe account; create the NZD $15/mo recurring Price (record its id → `STRIPE_PRICE_ID`); add the webhook endpoint (`/api/stripe/webhook`) subscribed to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` (record signing secret → `STRIPE_WEBHOOK_SECRET`); set the three secrets on Fly; apply the migration; test with Stripe test mode + `stripe listen`.

## Verification
- `pnpm vitest run` (billingStatus.test) green; `pnpm build` clean.
- Manual (Stripe test mode): `stripe listen --forward-to localhost:3000/api/stripe/webhook`; run a test Checkout → confirm `tenants.tier` flips to `self-serve` and live sync unlocks; cancel via Portal → confirm tier reverts to `free` and sync gate closes.
- **Run `security-review` on the diff** — payment code, webhook signature verification, service-role tier writes, and the column-grant lockdown are all in scope.

## Security checklist (payment code)
- [ ] Webhook verifies Stripe signature on the raw body; fails closed without the secret.
- [ ] `tenants.tier` is writable only by the service-role webhook path; client column grants prevent self-upgrade (Task 1).
- [ ] Secrets are server-only (no `VITE_`), validated at use.
- [ ] Checkout/Portal sessions are created for the caller's own tenant only (RLS-resolved tenant, customer keyed to tenant).
- [ ] Webhook handlers are idempotent/convergent (safe under Stripe retries + reordering).
- [ ] No card data touches our servers (hosted Checkout only).

## Owner action items (cannot be done from code)
1. Create the Stripe account + the NZD $15/mo recurring Price; set `STRIPE_PRICE_ID`.
2. Register the webhook endpoint + get `STRIPE_WEBHOOK_SECRET`; set `STRIPE_SECRET_KEY`.
3. Set all three on the Fly app; apply the migration to Supabase Cloud.
4. Verify end-to-end in Stripe test mode before switching to live keys.
