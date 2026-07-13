# Design spec — Quiz-funnel onboarding + reframed pricing

Date: 2026-07-13
Status: Draft for review
Research backing: [`2026-07-13-pricing-quiz-funnel-research.md`](./2026-07-13-pricing-quiz-funnel-research.md)

## Problem

The `/pricing` page presents four columns (Demo · Free · Self-serve · Concierge)
as a plan-comparison grid. It reads as "choose your level of commitment," which is
the wrong frame for the target visitor: someone who found YouInc online and thinks
"this could help me *right now*." It surfaces money and account creation before the
user has felt any value, and it lists Demo as if it were a plan when it is really a
top-of-funnel "look around" action.

We want the visitor to experience the product's value **before** any commitment,
then convert on the natural roadblock (live bank sync), reframed as "keep what
you've already built alive" rather than "pick a plan."

## Approach (validated against research)

A **quiz-funnel onboarding** modelled on consumer subscription apps (Noom, Cal AI),
but adapted honestly to finance:

- The quiz **is manual account entry disguised as onboarding** — each answer writes
  a real balance, so the endowment/IKEA effect delivers genuine product value, not
  a manipulation. (Norton–Mochon–Ariely 2012; see research digest.)
- **No account up front.** The quiz and the personalized reveal run fully
  anonymously (client-side, localStorage). Account creation appears only at the
  reveal as "save what you built." (Validated: Cal AI moved sign-in to the end of
  onboarding to lift conversion.)
- The **paid moment is scrupulously clean** — a 14-day no-card trial of live sync,
  a clear pre-charge reminder, and graceful fallback to the permanently-free manual
  tier. This is exactly where Noom crossed the line (hidden auto-renew, hard cancel,
  non-refundable charge) and paid $62M; finance is more trust-sensitive than
  dieting, so the honesty bar is higher. FTC (Oct 2021): disclose price/cancel/
  frequency up front as prominently as the offer; get explicit, separate consent to
  auto-renewal; make cancellation easy.

## The funnel (end to end)

```
Landing: "See your whole financial picture in 2 minutes"  →  [ Start ]
   ↓
QUIZ (anonymous, client-side, ~6 screens, progress bar)
   1. Goal — "What are you trying to get a handle on?"
   2–6. Balances via sliders (+ typed override, + "I don't have this")
   ↓
✨ REVEAL (computed client-side, NO account): net worth counts up, asset mix,
   a few live widgets; copy speaks back to the chosen goal
   ↓
"Love it? Save your picture so it's here tomorrow."  →  Supabase signup
   → quiz answers persisted as manual_account_balances for the new tenant
   ↓
/workspace: the saved dashboard  →  "Connect your bank" panel
   ↓
SYNC PAYWALL: 14-day no-card trial → day-12 reminder → $15/mo or fall back to manual
```

## Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Reveal timing | Anonymous, before any account. Answers in localStorage; account = "Save". |
| Quiz opening | Goal question first, then numbers. **No** goal-based branching. |
| Sync paywall | 14-day **no-card** trial → day-12 reminder → $15/mo or fall back to manual. |
| Payment provider | **Stripe** (Checkout + Billing + Customer Portal). MoR (Paddle/Lemon Squeezy) only if global tax handling is wanted. |
| Pricing page | Drop Demo as a column; reframe around free-forever + live-sync trial; Concierge as high anchor. |

---

## Phase A — the quiz funnel (no billing dependency)

### A1. Entry point
- Landing primary CTA changes from "sign up" intent to the quiz: **"See your whole
  financial picture in 2 minutes."** New public route, e.g. `/start`.
- Re-point primary CTAs to `/start` instead of `/signup`. Note the real wiring
  (per codebase audit): `StartFreeCta.tsx` links to `/signup` and has **one** call
  site (`PricingTable.tsx:113`); the landing film has its own CTAs. Update both
  `StartFreeCta` and the landing hero CTA. `/signup` stays reachable ("already have
  an account?") but is no longer the primary path.
- **No global route allowlist exists.** There is no `PUBLIC_PATHS`/
  `PROTECTED_PREFIXES` (the older CLAUDE.md description is stale). Protection is
  per-route in each loader; a new public route just needs a loader that does **not**
  call `getAccountState`/`checkAuthed`. So `/start` is public simply by omitting an
  auth check — nothing to register.

### A2. The quiz
- New route/component under `src/components/marketing/` or a new `onboarding/`
  feature dir. Anonymous; renders inside its own scope (reuse `.mk`/terminal system
  or a dedicated onboarding style — TBD in plan).
- ~6 screens, one question each, progress indicator (goal-gradient):
  1. **Goal** (single select): Know my true net worth · Get on top of debt · Save
     for something big · Just see it all in one place.
  2. **Cash** — everyday + savings.
  3. **KiwiSaver + investments** — KiwiSaver balance, shares/managed funds.
  4. **Property** — home value, vehicle.
  5. **Mortgage + loans** — mortgage, personal/student loan.
  6. **Short-term debt** — credit card / BNPL.
- Each balance screen: slider with sensible NZ range + typed exact override +
  "I don't have this" skip. No field is required.
- State persisted to `localStorage` under a versioned key `youinc.quiz.v1`.

### A3. Quiz state + mapping (pure, testable)
- Typed schema: `{ version, goal, entries: { category, cents }[] }`.
- Pure module `quizToLedger` maps each category → a ledger account path so
  `accountType()` classifies it correctly:

  | Category | Account path | Type |
  |---|---|---|
  | Everyday cash | `Assets:Cash:Everyday` | Assets |
  | Savings | `Assets:Cash:Savings` | Assets |
  | KiwiSaver | `Assets:Investments:KiwiSaver` | Assets |
  | Investments | `Assets:Investments:Shares` | Assets |
  | Home | `Assets:Property:Home` | Assets |
  | Vehicle | `Assets:Property:Vehicle` | Assets |
  | Mortgage | `Liabilities:Mortgage` | Liabilities |
  | Personal/student loan | `Liabilities:Loan` | Liabilities |
  | Credit card / BNPL | `Liabilities:CreditCard` | Liabilities |

- A second pure function builds a `LedgerDashboardData`-shaped object from the
  entries, reusing `derive.ts` and the `combineBalances` / net-worth conventions so
  **the anonymous reveal number equals the eventual /workspace number.** Plugin-free
  module (vitest-friendly), matching the codebase convention.

### A4. The reveal
- Renders the computed dashboard anonymously: net-worth headline (animated
  count-up), assets vs liabilities, asset-mix, and 2–3 presentational widgets from
  `DEMO_WIDGET_IDS` populated with their real numbers.
- Copy speaks back to the goal (e.g. debt goal → surface total debt + payoff view).
- **Honesty:** no unverifiable claims ("top X% of savers"). Only their own data.
- Primary CTA: **"Save your picture so it's here tomorrow"**; secondary: "start over".

### A5. Save → account → persist
- CTA enters the existing multi-step signup flow (`signup.index` → `name` →
  `credential`/`password`, backed by `lib/authServerFns.ts` → `server/passkeys.ts`).
  Both branches (confirmations-off → live session; confirmations-on → email code)
  already navigate to `/onboarding` on success. The quiz state lives in localStorage
  and **survives this navigation**, so no state needs threading through auth.
- Tenant creation happens in `/onboarding` (`createTenant` → `create_tenant` RPC),
  not at signup. After the tenant exists, replay the persisted quiz entries through
  the tenant-scoped `upsertWorkspaceBalance` DAL (`{account, balanceCents}`, tenant
  derived from the RLS session — never passed). Clear the localStorage key on
  success.
- **Reconcile with existing `/onboarding`** (steps: welcome → workspace → connect):
  when quiz state is present, skip/absorb the "welcome" screen and pre-fill the
  workspace-name step, then persist balances after `createTenant` rather than
  building a parallel onboarding. The "connect" step becomes the Phase B/paywall
  moment.

### A6. Pricing page reframe
- `/pricing`: drop **Demo** as a column (becomes an inline "see a live demo →"
  link). Reframe the page around: **free forever** (manual, all widgets, exports) →
  **live sync $15/mo, 14-day free trial, no card** → **Concierge from $149** as the
  high anchor (ordered to anchor high).
- `PricingLedger` is shared with the landing film's Act VI — update deliberately and
  check both surfaces.
- **Test coupling:** `config.test.ts` pins `"NZD $15"`, `"From NZD $149"`, `"$0"`,
  and Demo≠Free. Update copy and tests together, deliberately (per CLAUDE.md).

### Phase A deliverables
- `/start` quiz route + screens; localStorage schema; `quizToLedger` + reveal
  derivation (pure, unit-tested); reveal screen; save→signup→persist wiring;
  reconciled onboarding; reframed pricing page + updated tests; PUBLIC_PATHS +
  landing CTA updates; e2e covering quiz → reveal → save → workspace.

---

## Phase B — the 14-day no-card trial (still no billing)

- Add `trial_ends_at timestamptz` (and `trial_started_at`) to `tenants` (migration).
- Change the sync gate: `akahuConnection.ts` `tierAllowsLiveConnect` becomes
  `tier !== 'free' OR (trial_ends_at is in the future)`. Keep it the single security
  boundary (server-side, RLS) — the UI flag mirrors it.
- Trial starts when the user first chooses "Try live sync free for 14 days" in the
  workspace connect panel (no card collected).
- Day-12 reminder: "3 days left — add a card to keep sync on." Delivery mechanism
  TBD (Supabase scheduled function / email; `server/leads.ts` shows existing email
  capability to build on).
- At trial end with no subscription: tenant reverts to manual behavior (data stays;
  balances simply stop auto-updating). No punitive lockout — fallback is graceful.
- Copy shows price + "cancel anytime" plainly throughout (FTC).

---

## Phase C — billing (Stripe)

- **Provider: Stripe.** Rationale: NZD support, Stripe Checkout (hosted card
  capture → no PCI burden), Billing (subscription lifecycle), Customer Portal
  (self-serve cancel — satisfies FTC "easy to cancel"), robust webhooks/docs. It
  stays out of A and B entirely; it only enters at day-14 conversion.
  - Alternative: a Merchant-of-Record (Paddle / Lemon Squeezy) if global sales-tax/
    GST handling is desired; higher fees, chosen only if that tradeoff is wanted.
- Conversion flow: at/near trial end, "add a card to keep sync on" → Stripe Checkout
  (NZD $15/mo, explicit auto-renewal consent) → on `checkout.session.completed`
  webhook set `tenants.tier = 'self-serve'`.
- Subscription state via Stripe webhooks (`customer.subscription.updated/deleted`)
  → maintain `tenants.tier`; on cancel/lapse revert to `'free'` (data retained).
- Store the Stripe customer/subscription id on the tenant (server-side only). App
  token model unchanged. Secrets via env (`STRIPE_SECRET_KEY`, webhook signing
  secret); validate at startup.
- Customer Portal link in `/workspace` billing section for cancel/manage.

### Phase C security review triggers (per code-review rules)
- Payment/financial code + external API calls + webhook signature verification →
  run security-reviewer before merge. Never trust unsigned webhook payloads.

---

## Honesty / dark-pattern guardrails (apply to all phases)

- Price, cadence, "cancel anytime," and (in C) auto-renewal are disclosed up front,
  as prominent as the CTA (FTC Oct-2021).
- No card until the user affirmatively subscribes; explicit separate consent to
  auto-renewal at checkout.
- Cancellation is self-serve and easy (Stripe Customer Portal).
- No fabricated/unverifiable claims in the reveal — only the user's own numbers.
- Free tier is genuinely useful and permanent; trial end is a graceful fallback,
  never a data lockout.

## Out of scope

- Goal-based quiz branching (explicitly deferred).
- The owner's single-tenant SQLite `/dashboard` (unchanged).
- Concierge flow changes beyond the pricing anchor.

## Open questions for reviewer

1. `/start` styling: reuse the `.mk` terminal system, or a distinct calmer
   onboarding aesthetic?
2. Exact NZ slider ranges/defaults per category.
3. Day-12 reminder delivery mechanism (email provider vs Supabase scheduled fn).
4. Confirm Stripe over a Merchant-of-Record given GST considerations.
