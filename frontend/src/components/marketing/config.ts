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
  heroEyebrow: "Personal ERP · Live open banking",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "Connect your bank, watch it sync live, and get a dashboard built exactly for how you think about money. Need a widget that doesn't exist yet? I build it for you.",
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
      "Bespoke widgets & integrations, built for you",
      "Direct line — book a call anytime",
    ],
  },
} as const;
