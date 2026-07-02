# Marketing Landing Page — Design Spec

**Date:** 2026-07-02
**Status:** Approved for planning
**Sub-project:** 1 of ~5 (see "Product context" below)

## Product context

YouInc today is a **single-user, local-first personal ERP**: one passkey credential
(`frontend/src/server/auth.ts` — "no user table… add one if this ever grows past one
human"), one Akahu credential set from env, one SQLite ledger. The owner wants to turn it
into a **hybrid product**:

- **Self-serve light tier** — users connect their own bank, use the pre-built widgets, and
  customize their layout. No custom builds.
- **Concierge premium tier** — direct access to the maker, who builds bespoke widgets and
  integrations for them ("you get exactly what you're after, not a rigid system").

The differentiating angle is the **personal, AI-fast, custom-build** promise layered on top
of **live open-banking sync**. Reaching the full product requires ~5 independent
sub-projects, each with its own spec → plan → build cycle:

1. **Marketing landing page** ← *this spec*
2. Multi-tenant foundation (user/account table, per-user auth, data isolation)
3. Per-user Akahu connection (each user OAuths their own bank)
4. Billing / subscription tiers (Stripe + tier gating)
5. Custom-widget concierge workflow

The landing page is deliberately first: it is fully independent of the heavy multi-tenant
work, and it is the **validation gate** that tells us whether to build sub-projects 2–4 at
all. It must capture demand for both tiers before that engineering is undertaken.

## Goals

- Communicate the product: live bank sync + a dashboard built exactly for you + bespoke
  custom builds nobody else offers.
- Capture two intents: **self-serve waitlist** (light tier) and **book-a-call** (concierge).
- Let visitors *feel* the product immediately via a seeded, read-only live demo dashboard.
- Present tiered pricing that qualifies leads without over-committing on concierge cost.
- Ship on the existing TanStack Start app with no dependency on multi-tenant work.

## Non-goals (explicitly out of scope for this sub-project)

- No real self-serve signup / account creation (that is sub-project 2).
- No per-user bank connection (sub-project 3).
- No billing or payment collection (sub-project 4).
- No changes to the authenticated dashboard, ledger, or Akahu ingestion behavior.

## Visual direction

**A×C hybrid** (chosen over dark-luxury and pure-brutalist alternatives):

- **Editorial / Swiss base** — serif display headline with an italic accent, calm off-white
  ("warm paper") palette, generous whitespace, sans-serif for nav/UI, thin rules. Reads
  credible and premium, not templated AI-SaaS.
- **Floating live widget cards** — tilted white cards drifting in the hero (Net worth with a
  pulsing `● LIVE` tag, Runway with a sparkline, Cashflow, Top expense), with **refined
  elevation** (hairline border + soft drop shadow), not hard brutalist offsets.
- Follows `~/.claude/rules/web/design-quality.md`: intentional hierarchy, editorial
  composition, designed hover/focus states, semantic HTML, motion on compositor-friendly
  properties only (`transform`/`opacity`).
- **Light-first.** The app supports light/dark via `data-theme`; the landing page ships
  light-only to keep the art direction tight. Dark can be added later if wanted.

## Page structure (top to bottom)

1. **Hero** — A×C hybrid. Headline "Run yourself like a company." (italic *company*),
   sub-copy on live sync + bespoke builds, floating live widget cards. CTAs: `Start free →`
   (waitlist + demo) and `Book a call`.
2. **Live proof strip** — thin band: "Connect BNZ, ANZ, ASB, Kiwibank… synced live via
   Akahu," with the pulsing live cue. Establishes the open-banking story.
3. **How it works** — 3 numbered steps: *Connect your bank → It syncs & categorizes live →
   Read your dashboard.*
4. **Widget showcase** — centerpiece. **Real rendered widgets** (reusing existing widget
   components fed by the seeded payload) in a bento/gallery, some floating/tilted. Copy:
   "Build your dashboard from any of these — or more."
5. **Bespoke hook** — the differentiator, its own section: "Missing a widget? A custom
   integration? I build it for you." Ties to the concierge tier.
6. **Pricing** — three tiers (see table). CTAs wire to waitlist / self-serve / book-a-call.
7. **Final CTA + FAQ** — recap dual CTA; FAQ covers "is my data safe / where is it stored /
   what is Akahu."
8. **Footer** — minimal.

## CTA behavior

- **`Start free` → Waitlist + instant demo access.** Opens a short email-capture form
  ("Self-serve is launching soon — get early access"), then routes the visitor into a
  read-only live **demo** dashboard seeded with sample data so they feel the product.
- **`Book a call` → external scheduler.** Opens a Cal.com/Calendly booking page in a new
  tab. URL is configurable (see open items). No embedded scheduler (avoids third-party
  script weight).

## Pricing

Presented as **Self-serve priced, Concierge "let's talk."** Numbers below are placeholders to
be confirmed (see open items).

| | **Demo** | **Self-serve** (light) | **Concierge** (premium) |
|---|---|---|---|
| Price | Free | ~NZD **$15/mo** | **From $149/mo — book a call** |
| Bank sync | Sample data only | Your bank, live via Akahu | Your bank, live via Akahu |
| Widgets | Full gallery, read-only | All pre-built widgets | All pre-built widgets |
| Layout | — | Customize order & layout | Customize order & layout |
| Custom builds | — | — | **Bespoke widgets & integrations** |
| Access | — | Email support | **Direct line — book a call anytime** |
| CTA | Start free → | Join waitlist | Book a call |

## Technical design

### Routes (existing TanStack Start app, `frontend/`)

- **`/`** — evolve `src/routes/index.tsx` from the current one-card front door into the full
  marketing page. Keep the existing behavior: authenticated visitors redirect to
  `/dashboard`; unauthenticated visitors see the marketing page. `/` is already in
  `PUBLIC_PATHS` (`src/start.ts`).
- **`/demo`** — new public route rendering the dashboard grid (`DashboardGrid`) from a
  **static seeded `LedgerDashboardData`**, with mutating controls (ingestion, manual
  accounts, rules, reclassify) hidden/disabled and edit-mode layout persistence allowed
  (client-only `localStorage`). Add `"/demo"` to `PUBLIC_PATHS` in `src/start.ts`.
  - The demo must **not** call the session-gated `readLedgerDashboard` server fn. It imports
    a plain TS module (see below), so no SQLite, no auth, no `requireSession`, zero data-leak
    surface.

### Components

Organize under `src/components/marketing/` (feature-folder per web coding-style), one file per
section, kept small (<300 lines each), each rendering from static props/copy:

- `Hero.tsx`, `LiveProofStrip.tsx`, `HowItWorks.tsx`, `WidgetShowcase.tsx`,
  `BespokeSection.tsx`, `Pricing.tsx`, `WaitlistForm.tsx`, `FinalCta.tsx`, `Faq.tsx`,
  `MarketingFooter.tsx`.
- `marketing.css` (or co-located per-section CSS) using CSS custom properties for the
  landing palette/type tokens; reuse existing global tokens where present.
- `WidgetShowcase` renders **real widget components** from the existing registry against the
  seeded payload — no new screenshot assets.

### Seeded demo data

- New module `src/components/marketing/sampleDashboard.ts` exporting a realistic,
  hand-crafted `LedgerDashboardData` (balances, P&L, net-worth trend, runway inputs,
  breakdowns, pipeline health). All amounts in integer **cents**, `en-NZ`, NZD, per existing
  conventions. Used by both `/demo` and the `WidgetShowcase` section so the hero, showcase,
  and demo tell one coherent story.

### Waitlist capture

- New server fn `joinWaitlist` (`createServerFn` POST), colocated with `WaitlistForm`.
  - Validates input with **zod** (email required; optional name; optional "interested tier").
  - Writes to a `leads` table in a small dedicated SQLite DB, mirroring the `auth.ts` pattern
    (`better-sqlite3`, WAL, lazy singleton). Env: `YOUINC_LEADS_DB_PATH` (default
    `../data/youinc-leads.sqlite3`, separate from ledger and auth DBs).
  - **Best-effort notification** to the owner on each signup (non-blocking; failure never
    fails the signup). Transport is pluggable/configurable (see open items) — the `leads`
    table is the source of truth.
  - Lazily `import()` the server-only leads module inside the handler so native code stays
    out of the client bundle (existing pattern).
  - CSRF-protected automatically (serverFn middleware in `start.ts`); add light anti-abuse
    (honeypot field + basic rate limit) per web security rules. No session required.

#### `leads` table

```sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT,
  interest TEXT,          -- 'self-serve' | 'concierge' | null
  source TEXT,            -- e.g. 'hero' | 'pricing' | 'final-cta'
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(email)
);
```

On duplicate email, upsert `created_at`/`source` rather than erroring (idempotent, immutable
update pattern).

### Booking link

- `YOUINC_BOOKING_URL` env / config constant (placeholder until the real scheduler URL is
  supplied). `Book a call` buttons link to it (`target="_blank" rel="noopener"`).

## Error handling & validation

- Waitlist form: client-side validation for fast feedback + server-side zod validation as the
  boundary of trust. User-friendly inline errors; detailed server-side logging. Never swallow
  errors silently.
- Demo route: if the seeded payload is missing a field a widget needs, widgets already handle
  empty states via `NoData`.

## Accessibility, performance, security (per web rules)

- Semantic HTML (`header`/`nav`/`main`/`section`/`footer`), labelled sections, keyboard-
  operable CTAs and form, visible focus states, reduced-motion fallback for the floating-card
  motion.
- Landing JS/CSS within budget (`< 150kb` JS gz / `< 30kb` CSS); explicit image dimensions;
  no render-blocking third-party scripts (booking is a link-out, not an embed).
- No secrets in client code; leads DB path and booking URL from env; honeypot + rate limit on
  the form; CSRF already enforced.

## Testing plan

- **Unit:** `sampleDashboard` shape matches `LedgerDashboardData`; `joinWaitlist` zod
  validation (valid/invalid email, honeypot rejection); leads upsert idempotency.
- **Integration:** `joinWaitlist` writes/updates a row in a temp leads DB.
- **E2E (Playwright):** landing hero renders (`h1` visible); `Start free` reveals the waitlist
  form, submit shows success and lands on `/demo`; `/demo` renders widgets without auth and
  hides mutating controls; `Book a call` points at the booking URL.
- **Visual regression:** hero + pricing at 320/768/1024/1440 (light).

## Open items (to confirm during/after planning)

1. **Booking URL** — which scheduler (Cal.com vs Calendly) and the actual link.
2. **Price numbers** — confirm NZD $15/mo self-serve and the concierge "from" figure (or hide
   the concierge number entirely).
3. **Notification transport** — how the owner wants to be pinged on signups (e.g., Resend/SMTP
   email, or a webhook). Table is source of truth regardless; this is best-effort.
