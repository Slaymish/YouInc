// Central marketing copy + config. No magic strings in components.

const DEFAULT_BOOKING_URL = "https://cal.com/youinc/intro";

export const DEFAULT_EMAIL = "hamishapps@gmail.com";

export function resolveBookingUrl(env: {
  VITE_YOUINC_BOOKING_URL?: string;
}): string {
  const value = env.VITE_YOUINC_BOOKING_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_BOOKING_URL;
}

// import.meta.env is Vite's client-exposed env; only VITE_* keys are inlined.
export const BOOKING_URL: string = resolveBookingUrl(
  import.meta.env as { VITE_YOUINC_BOOKING_URL?: string },
);

export const PRODUCT = {
  name: "YouInc",
  heroEyebrow: "Personal ERP · Live bank sync via Akahu",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "Connect your bank and YouInc keeps a live double-entry ledger of your whole financial life — then shows you the CFO view: net worth, runway, cashflow, and the one thing to do next.",
  heroReassurance: "No card to start · Read-only bank access · Live in 2 minutes",
} as const;

// Four tiers, two of them free in different senses — keep them distinct:
//   * `demo`   — no account at all. Unauthenticated, read-only sample data at
//     /demo. Exists purely so a visitor can look around before signing up.
//   * `free`   — a REAL signed-up account (tenants.tier = 'free', the default
//     for self-registered tenants as of migration 20260705150001). Full
//     widget access on the user's own data, manual accounts only — no live
//     Akahu bank connection. This is what funds nothing; `selfServe` below is
//     what funds the Akahu API costs, which is why live sync is gated to it.
//   * `selfServe` — paid ($15/mo). Everything in `free`, plus live bank sync.
//   * `concierge` — bespoke, operator-provisioned, unchanged.
export const PRICING = {
  demo: {
    name: "Demo",
    price: "Free",
    cta: "Open the demo",
    features: [
      "Sample data, read-only",
      "Full widget gallery",
      "No sign-up to look around",
    ],
  },
  free: {
    name: "Free",
    price: "$0",
    cadence: "/mo",
    cta: "Start — no card needed",
    features: [
      "Start in two minutes — no card, no commitment",
      "Manual accounts (no live bank sync)",
      "Full widget gallery on your real data",
      "Export your full ledger anytime — plain-text journals, no lock-in",
    ],
  },
  selfServe: {
    name: "Self-serve",
    price: "NZD $15",
    cadence: "/mo",
    cta: "Add live sync",
    features: [
      "14-day free trial — no card up front",
      "Everything in Free",
      "Live bank sync via Akahu",
      "Customize widget order and layout",
      "Email support",
    ],
  },
  concierge: {
    name: "Concierge",
    price: "From NZD $149",
    cadence: "/mo",
    cta: "Book a call",
    features: [
      "Everything in Self-serve",
      "Bespoke widgets, integrations, and AI agents",
      "Scoped one-off builds from NZD $1,500",
      "Direct line for questions and tweaks",
    ],
  },
} as const;

// Structured feature-comparison matrix for the `/pricing` route's comparison
// table (design-direction spec E4). Derived from the `PRICING.*.features`
// copy above but reshaped as rows (capability) x columns (tier) so the table
// can render ticks/dashes instead of four separate bullet lists. Does NOT
// duplicate or restate any test-pinned price string — see config.test.ts.
//
// The ONLY functional difference between `free` and `selfServe` is live Akahu
// sync (+ support tier) — everything else (widgets, layout customization,
// export) is available to any signed-up tenant regardless of billing tier,
// because there is no widget-level tier gating in the app. Keep this table
// honest about that: don't invent a gated feature here that the product
// doesn't actually gate.
export interface PricingComparisonRow {
  feature: string;
  demo: boolean | string;
  free: boolean | string;
  selfServe: boolean | string;
  concierge: boolean | string;
}

export const PRICING_COMPARISON: readonly PricingComparisonRow[] = [
  {
    feature: "Look around",
    demo: "Sample data, read-only",
    free: true,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Live bank sync via Akahu",
    demo: false,
    free: false,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Full widget gallery",
    demo: true,
    free: true,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Customize widget order and layout",
    demo: false,
    free: true,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Export full ledger — plain-text journals, no lock-in",
    demo: false,
    free: true,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Support",
    demo: false,
    free: false,
    selfServe: "Email support",
    concierge: "Direct line — book anytime",
  },
  {
    feature: "Bespoke widgets, integrations, and AI agents",
    demo: false,
    free: false,
    selfServe: false,
    concierge: true,
  },
  {
    feature: "Scoped one-off builds",
    demo: false,
    free: false,
    selfServe: false,
    concierge: "From NZD $1,500",
  },
] as const;
