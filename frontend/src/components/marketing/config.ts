// Central marketing copy + config. No magic strings in components.

const DEFAULT_BOOKING_URL = "https://cal.com/youinc/intro";

export function resolveBookingUrl(env: { VITE_YOUINC_BOOKING_URL?: string }): string {
  const value = env.VITE_YOUINC_BOOKING_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_BOOKING_URL;
}

// import.meta.env is Vite's client-exposed env; only VITE_* keys are inlined.
export const BOOKING_URL: string = resolveBookingUrl(
  import.meta.env as { VITE_YOUINC_BOOKING_URL?: string },
);

export const PRODUCT = {
  name: "YouInc",
  heroEyebrow: "Personal ERP · Live via Akahu open banking",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "You already have revenue, burn rate, and runway — you just can't see them. YouInc pulls every account into one live double-entry ledger and turns it into your executive dashboard. And when the widget you need doesn't exist, I build it for you.",
} as const;

export const PRICING = {
  demo: {
    name: "Demo",
    price: "Free",
    cta: "Start free",
    features: ["Sample data, read-only", "Full widget gallery", "No sign-up to look around"],
  },
  selfServe: {
    name: "Self-serve",
    price: "NZD $15",
    cadence: "/mo",
    cta: "Join the waitlist",
    features: [
      "Your bank, live via Akahu",
      "All pre-built widgets",
      "Customize order & layout",
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
      "Bespoke widgets, integrations & AI agents, built for you",
      "Scoped one-off builds from NZD $1,500",
      "Direct line — book a call anytime",
    ],
  },
} as const;
