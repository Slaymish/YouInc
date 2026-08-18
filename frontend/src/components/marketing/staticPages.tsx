import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { DEFAULT_EMAIL, SOURCE_URL } from "./config";

export type StaticPageId = "docs" | "help" | "privacy";

interface StaticPageSection {
  title: string;
  body?: ReactNode;
  items?: readonly ReactNode[];
}

/** A plain-text question/answer pair for `FAQPage` JSON-LD. Kept separate from
 * `sections` because schema.org needs strings, while the sections' content is
 * rich JSX (links, formatting) meant for on-page rendering. */
export interface FaqEntry {
  question: string;
  answer: string;
}

/** Which schema.org node type `staticPageHead` emits. Defaults to a baseline
 * `WebPage`; only a genuine list of questions should use `FAQPage`. */
export type StaticPageSchema =
  | { kind: "WebPage" }
  | { kind: "FAQPage"; questions: readonly FaqEntry[] };

export interface StaticPageData {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  subheading: ReactNode;
  updated?: string;
  sections: readonly StaticPageSection[];
  schema?: StaticPageSchema;
  cta?: {
    label: string;
    href: string;
    external?: boolean;
  };
}

function Repo({ path, children }: { path: string; children: ReactNode }) {
  return (
    <a href={`${SOURCE_URL}/blob/main/${path}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export const STATIC_PAGES: Record<StaticPageId, StaticPageData> = {
  docs: {
    title: "Docs - YouInc",
    description:
      "How to run YouInc on your own machine, what each screen does, and where things live in the code.",
    eyebrow: "Docs",
    heading: "Documentation",
    subheading:
      "Written for someone who tried the demo and wants their own copy running. Setup first, then a tour of the screens, then where things live in the code.",
    sections: [
      {
        title: "What it is",
        body: (
          <>
            A double-entry ledger for your own money, with a dashboard over it.
            Transactions arrive from your bank through Akahu or by hand, get
            sorted into accounts by rules you control, and post as balanced
            journal entries in Postgres. Every figure on screen traces back to
            those entries. The <Link to="/demo">demo</Link> is the same
            application running on sample transactions.
          </>
        ),
      },
      {
        title: "Setting it up",
        body: (
          <>
            You need Docker and the Supabase CLI. From the repository root,{" "}
            <code>supabase start</code> brings up Postgres, Auth and Studio
            locally, and <code>supabase db reset</code> applies the migrations.
            Then <code>cd frontend</code>, <code>pnpm install</code>, and{" "}
            <code>pnpm dev</code> serves it on <code>localhost:3000</code>. The
            frontend defaults point at the local stack, so there is nothing to
            configure for a first run. Full steps, including the proxy
            workaround, are in the <Repo path="README.md">README</Repo>.
          </>
        ),
      },
      {
        title: "A one-file install is not ready yet",
        body: "Getting it running means a terminal, a container runtime and about ten minutes. A packaged version — most likely a container image first — is the next piece of work. Until it lands, the setup above is the only route, and it is a real barrier rather than a formality.",
      },
      {
        title: "First run",
        items: [
          <>
            Create your account at <code>/signup</code>. On your own instance you
            are the only user, so sign-up is open — nobody else is pointed at your
            database.
          </>,
          "Name your workspace in onboarding. That's the tenant every row is scoped to.",
          "Then pick one: load the sample transactions to see the whole thing working, type in a balance by hand, or connect a bank.",
        ],
      },
      {
        title: "The screens",
        items: [
          "Home — one sentence on how you're doing, the few numbers behind it, and anything that needs you.",
          "Accounts — every place money sits, synced and hand-entered in one list, plus the bank connection.",
          "Activity — what happened, and the short queue of transactions the rules couldn't categorise.",
          "Spending and Net worth — where the money went, and whether the total is moving.",
          "Pinboard — a grid you fill with whatever cards you want to keep an eye on.",
          "Settings is your account. Workshop holds the ledger's machinery: sorting rules, account mappings, the sync log.",
        ],
      },
      {
        title: "Connecting a bank",
        body: (
          <>
            Live sync uses{" "}
            <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
              Akahu
            </a>
            , New Zealand's open-finance provider, with your own app credentials —
            there is no shared key. Access is read-only, you choose which accounts
            to share, and you can revoke it from Akahu at any time. Your enduring
            token is stored encrypted in Supabase Vault and never returned to the
            browser. Without Akahu credentials everything else still works; the
            app just says live sync isn't enabled.
          </>
        ),
      },
      {
        title: "Sorting, and the things it can't place",
        body: "Each transaction is matched against your sorting rules in priority order, and the first rule that fits wins. Anything nothing matches goes to a short list on Activity for you to categorise, rather than being guessed at. Correcting one posts a real correction entry, so the history stays honest.",
      },
      {
        title: "Getting your data out",
        body: "The full history exports as hledger-compatible plain-text journals, so it stays readable in other tools. It's your database: back it up, move it, or drop it without asking anyone.",
      },
      {
        title: "Where things live",
        items: [
          <>
            <code>frontend/</code> — TanStack Start (React 19 + Nitro). Routes in{" "}
            <code>src/routes</code>, ledger reads and writes in{" "}
            <code>src/server</code>, dashboard cards in{" "}
            <code>src/components/widgets</code>.
          </>,
          <>
            <code>supabase/migrations/</code> — schema, row-level security
            policies and the security-definer functions. The source of truth for
            the data model.
          </>,
          <>
            <Repo path="frontend/CLAUDE.md">frontend/CLAUDE.md</Repo> — working
            notes on how the frontend fits together, kept current for whoever
            edits it next.
          </>,
        ],
      },
      {
        title: "If something breaks",
        body: (
          <>
            Open an issue at{" "}
            <a href={`${SOURCE_URL}/issues`} target="_blank" rel="noopener noreferrer">
              the repository
            </a>{" "}
            with the page you were on and what you were doing. See also the{" "}
            <Link to="/help">common questions</Link>.
          </>
        ),
      },
    ],
    cta: { label: "Open the demo", href: "/demo" },
  },

  help: {
    title: "Help - YouInc",
    description:
      "Common questions about running YouInc: setup, bank sync, sorting, exports and where to ask.",
    eyebrow: "Help",
    heading: "Common questions",
    subheading:
      "Short answers to what people ask most. If yours isn't here, open an issue and ask.",
    schema: {
      kind: "FAQPage",
      questions: [
        {
          question: "Do I need an account to try it?",
          answer:
            "No. The demo runs on sample data with no sign-up. Accounts only exist on an instance you run yourself.",
        },
        {
          question: "What does it cost?",
          answer:
            "Nothing. It is MIT licensed and you host it, so the only cost is whatever you spend running Postgres.",
        },
        {
          question: "How hard is it to set up?",
          answer:
            "Today it needs Docker, the Supabase CLI and a terminal — roughly ten minutes if those are already installed. A packaged version is planned.",
        },
        {
          question: "Is my bank login safe?",
          answer:
            "The app never sees your banking password. Sync goes through Akahu with read-only access to the accounts you pick, using your own Akahu credentials, and you can revoke it from Akahu at any time.",
        },
        {
          question: "Which accounts can sync?",
          answer:
            "New Zealand accounts that Akahu supports. Anything without a feed — a house, a car, KiwiSaver, a private loan — you enter as a balance by hand, and it sits in the same list.",
        },
        {
          question: "Can I get my data out?",
          answer:
            "Yes. The full history exports as hledger-compatible plain-text journals, and the database is yours.",
        },
        {
          question: "How do I delete everything?",
          answer:
            "Revoke the Akahu connection, export a copy if you want one, then drop your database. Nothing has to be requested from anyone.",
        },
        {
          question: "Can I add my own dashboard cards?",
          answer:
            "Yes — each one is a TypeScript module in the repository. frontend/CLAUDE.md describes how the registry works.",
        },
      ],
    },
    sections: [
      {
        title: "Do I need an account to try it?",
        body: (
          <>
            No. The <Link to="/demo">demo</Link> runs on sample data with no
            sign-up. Accounts only exist on an instance you run yourself.
          </>
        ),
      },
      {
        title: "What does it cost?",
        body: "Nothing. It is MIT licensed and you host it, so the only cost is whatever you spend running Postgres — which, locally, is nothing.",
      },
      {
        title: "How hard is it to set up?",
        body: (
          <>
            Today it needs Docker, the Supabase CLI and a terminal — roughly ten
            minutes if you already have those. The <Link to="/docs">docs</Link>{" "}
            have the steps. A packaged version you can download and run is the
            next piece of work.
          </>
        ),
      },
      {
        title: "Is my bank login safe?",
        body: (
          <>
            The app never sees your banking password. Sync runs through{" "}
            <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
              Akahu
            </a>{" "}
            with read-only access to the accounts you choose, using credentials
            you obtain yourself, and you can revoke it from Akahu at any time.
          </>
        ),
      },
      {
        title: "Which accounts can sync?",
        body: "New Zealand accounts that Akahu supports. Anything without a feed — a house, a car, KiwiSaver, a private loan — you enter as a balance by hand, and it sits in the same list as the synced ones.",
      },
      {
        title: "Can I get my data out?",
        body: "Yes. The full history exports as hledger-compatible plain-text journals, and the database is yours to back up or move.",
      },
      {
        title: "How do I delete everything?",
        body: "Revoke the Akahu connection, export a copy if you want one, then drop your database. Nothing has to be requested from anyone, because nobody else holds it.",
      },
      {
        title: "Can I add my own dashboard cards?",
        body: (
          <>
            Each card is a TypeScript module in the repository —{" "}
            <Repo path="frontend/CLAUDE.md">frontend/CLAUDE.md</Repo> describes
            the registry it needs adding to.
          </>
        ),
      },
      {
        title: "Still stuck?",
        body: (
          <>
            Open an issue at{" "}
            <a href={`${SOURCE_URL}/issues`} target="_blank" rel="noopener noreferrer">
              the repository
            </a>
            , or email <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>.
            Say which page you were on and what happened.
          </>
        ),
      },
    ],
  },

  privacy: {
    title: "Privacy - YouInc",
    description: "What youinc.net collects, and what an instance you run yourself holds.",
    eyebrow: "Privacy",
    heading: "Privacy",
    updated: "19 August 2026",
    subheading:
      "Two separate things: what this website collects, and what a copy you run holds. This site serves a demo on sample data and these docs. It has no account for you and cannot reach your bank.",
    sections: [
      {
        title: "This website",
        items: [
          "The demo runs on fixed sample data. Your dashboard layout is saved in your own browser, not on a server.",
          "First-party usage counts: anonymous page and event records, kept to see which parts of the demo people actually use. No third-party analytics, no advertising, no cross-site tracking.",
          "Coarse technical records needed to keep the site running, such as error logs.",
          "Anything you deliberately send — a GitHub issue or an email — plus whatever you put in it.",
        ],
      },
      {
        title: "There is no account here",
        body: "This site cannot connect to your bank, because it offers no accounts and holds no financial data. Sign-up and sign-in exist in the code for instances people run themselves.",
      },
      {
        title: "An instance you run",
        body: (
          <>
            Your copy holds your ledger in your own Postgres database, under your
            control. The author has no access to it, receives nothing from it, and
            cannot tell that it exists. Bank data arrives through{" "}
            <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
              Akahu
            </a>{" "}
            using your own credentials, read-only, for the accounts you choose;
            Akahu's own terms cover what they hold.
          </>
        ),
      },
      {
        title: "Deleting it",
        body: "Revoke the Akahu connection, export a copy if you want one, and drop the database. There is no request to make and nobody to ask.",
      },
      {
        title: "Contact",
        body: (
          <>
            Questions about this page:{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>.
          </>
        ),
      },
    ],
  },
};

export function pageData(id: StaticPageId): StaticPageData {
  return STATIC_PAGES[id];
}
