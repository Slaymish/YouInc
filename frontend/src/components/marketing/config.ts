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

// heroSub is the hero paragraph, the <meta name="description"> and the JSON-LD
// description (see routes/index.tsx) — keep it under ~160 characters.
export const PRODUCT = {
  name: "YouInc",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "A double-entry ledger for your own money, with a CFO dashboard on top. Your bank feed goes in; net worth and runway come out. Runs on your machine.",
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
