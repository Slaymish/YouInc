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
    "YouInc turns your accounts into a live double-entry ledger, then gives you the CFO view: net worth, cashflow, runway, and the next thing to look at. Use the standard widgets, or have me build the view your finances need.",
} as const;

export const PRICING = {
  demo: {
    name: "Demo",
    price: "Free",
    cta: "Start free",
    features: [
      "Sample data, read-only",
      "Full widget gallery",
      "No sign-up to look around",
    ],
  },
  selfServe: {
    name: "Self-serve",
    price: "NZD $15",
    cadence: "/mo",
    cta: "Join the waitlist",
    features: [
      "Live bank sync via Akahu",
      "All standard widgets",
      "Customize widget order and layout",
      "Export your full ledger anytime — plain-text journals, no lock-in",
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
// can render ticks/dashes instead of three separate bullet lists. Does NOT
// duplicate or restate any test-pinned price string — see config.test.ts.
export interface PricingComparisonRow {
  feature: string;
  demo: boolean | string;
  selfServe: boolean | string;
  concierge: boolean | string;
}

export const PRICING_COMPARISON: readonly PricingComparisonRow[] = [
  {
    feature: "Look around",
    demo: "Sample data, read-only",
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Live bank sync via Akahu",
    demo: false,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Full widget gallery",
    demo: true,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Customize widget order and layout",
    demo: false,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Export full ledger — plain-text journals, no lock-in",
    demo: false,
    selfServe: true,
    concierge: true,
  },
  {
    feature: "Support",
    demo: false,
    selfServe: "Email support",
    concierge: "Direct line — book anytime",
  },
  {
    feature: "Bespoke widgets, integrations, and AI agents",
    demo: false,
    selfServe: false,
    concierge: true,
  },
  {
    feature: "Scoped one-off builds",
    demo: false,
    selfServe: false,
    concierge: "From NZD $1,500",
  },
] as const;
