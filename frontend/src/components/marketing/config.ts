// Central marketing copy + config. No magic strings in components.
//
// YouInc is not sold. There are no tiers, no billing, and no booking link —
// the public surface is the sample-data demo plus instructions for running
// your own instance. Anything reintroducing a price belongs nowhere in here.

export const DEFAULT_EMAIL = "hamishapps@gmail.com";

/** Canonical source repository — the self-host path and the licence live here. */
export const SOURCE_URL = "https://github.com/Slaymish/YouInc";

/** Self-hosting instructions, served from the repo README. */
export const SELF_HOST_URL = `${SOURCE_URL}#run-it-yourself`;

export const PRODUCT = {
  name: "YouInc",
  heroEyebrow: "Personal ERP · Open source · Self-hosted",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "A double-entry ledger for your whole financial life, and the CFO view on top of it: net worth, runway, cashflow, and the one thing to do next. You run it, on your own machine, against your own data.",
  heroReassurance: "Open source · Your data stays yours · No account required",
} as const;

/**
 * The two ways to use YouInc. Neither involves an account on youinc.net —
 * `demo` is anonymous sample data, `selfHost` is your own instance.
 */
export const USE_PATHS = {
  demo: {
    name: "Demo",
    summary: "Sample data, read-only, no sign-up.",
    cta: "Open the demo",
    features: [
      "The real dashboard on a seeded ledger",
      "Full widget gallery",
      "Nothing to install, nothing to create",
    ],
  },
  selfHost: {
    name: "Self-host",
    summary: "Your machine, your database, your bank connection.",
    cta: "Read the setup guide",
    features: [
      "Docker Compose or a local Supabase stack",
      "Connect your own Akahu account for live NZ bank sync",
      "Plain-text ledger exports — no lock-in, nothing to cancel",
      "MIT licensed; fork it and change whatever you want",
    ],
  },
} as const;
