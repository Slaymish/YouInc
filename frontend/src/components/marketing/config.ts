// Central copy + config for the public surface. No magic strings in components.
//
// The public site is two things: a demo of the application on sample data, and
// the docs for someone who saw the demo and wants to run it. There is no
// hosted version, no account here, and nothing to buy — anything that reads
// like a product surface belongs nowhere in here.

export const DEFAULT_EMAIL = "hamishapps@gmail.com";

/** Canonical source repository — the setup guide and the licence live here. */
export const SOURCE_URL = "https://github.com/Slaymish/YouInc";

/** Setup instructions, served from the repo README. */
export const SELF_HOST_URL = `${SOURCE_URL}#run-it-yourself`;

// heroSub is the hero paragraph, the <meta name="description"> and the JSON-LD
// description (see routes/index.tsx) — keep it under ~160 characters.
export const PRODUCT = {
  name: "YouInc",
  heroEyebrow: "Open source · Runs on your machine",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "A double-entry ledger for your own money, with a CFO dashboard on top. Your bank feed goes in; net worth and runway come out. Runs on your machine.",
  heroReassurance: "MIT licensed · Your data stays on your machine",
} as const;

/**
 * The two ways to use YouInc. Neither involves an account on youinc.net —
 * `demo` is anonymous sample data, `selfHost` is your own instance.
 */
export const USE_PATHS = {
  demo: {
    name: "Demo",
    summary: "The real application on a seeded ledger.",
    cta: "Open the demo",
    features: [
      "Every screen, running on sample transactions",
      "Nothing to install and nothing to sign up for",
    ],
  },
  selfHost: {
    name: "Self-host",
    summary: "Your machine, your database, your bank connection.",
    cta: "Read the setup guide",
    features: [
      "Postgres via Supabase, run locally or on a host you control",
      "Your own Akahu credentials for live New Zealand bank sync",
      "hledger-compatible plain-text exports, so the history stays readable elsewhere",
      "MIT licensed — fork it and change whatever you want",
    ],
  },
} as const;
