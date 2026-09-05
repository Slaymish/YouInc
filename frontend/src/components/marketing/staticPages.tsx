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
    title: 'Docs - YouInc', description: 'Run your own personal money dashboard.',
    eyebrow: 'Docs', heading: 'Documentation',
    subheading: 'One app, one local database, your own money.',
    sections: [
      {title: 'Setting it up', body: <>Install Node.js 22.13 or newer and download the repository. Run <code>node scripts/setup.mjs</code>, then <code>node scripts/start.mjs</code>. Open <code>http://127.0.0.1:3000</code>. See the <Repo path="README.md">README</Repo> for full instructions.</>},
      {title: 'First run', body: 'Your dashboard opens immediately. Add balance snapshots in Accounts or record income and expenses in Activity. No signup or bank connection is required. The ledger currently uses NZD.'},
      {title: 'The screens', items: ['Home shows your money at a glance.', 'Accounts holds balances and optional bank sync.', 'Activity records transactions and lets you categorise them.', 'Spending and Net worth explain where your money went.', 'Settings includes full backups and journal exports. Workshop holds sorting rules and mappings.']},
      {title: 'Your data', body: 'Your ledger lives in ~/.youinc/ledger.sqlite3. It stays on your computer. Manual balances take precedence over transaction totals for the same account; keep those snapshots up to date.'},
      {title: 'Backups', body: 'Download a consistent database backup from Settings. Restore with scripts/restore.mjs to a new path; the command validates the database and refuses to overwrite existing data. The README has the exact steps.'},
      {title: 'Optional bank sync', body: 'New Zealand bank sync uses your own Akahu app and user tokens in the local environment file. Sync is on demand. Manual entry works without it.'},
      {title: 'Local access', body: 'The app listens on this computer only and has no web login. Use an SSH tunnel for a private server. Public demo mode disables all personal database access.'},
    ], cta: {label:'Open the demo',href:'/demo'},
  },
  help: {
    title: 'Help - YouInc', description:'Common questions about your local dashboard.',
    eyebrow:'Help', heading:'Common questions', subheading:'Getting started, keeping your data, and finding help.',
    sections:[
      {title:'Do I need an account?',body:'No. Your own copy opens straight into your dashboard. The demo needs no account either.'},
      {title:'Does it need a cloud service?',body:'No. The app and SQLite database run on your computer. An internet connection is needed to install dependencies and for optional bank sync.'},
      {title:'Can I get my data out?',body:'Yes. Settings offers a complete database backup and an hledger-compatible journal export. The export includes transactions; use the database backup for balance snapshots, rules and settings.'},
      {title:'How do I delete everything?',body:'Stop YouInc, revoke any bank token you configured, and remove your database and its -wal and -shm files. Keep a backup first if you want to retain your history.'},
      {title:'Still stuck?',body:<a href={`${SOURCE_URL}/issues`}>Open an issue on GitHub</a>},
    ],
  },
  privacy: {
    title:'Privacy - YouInc',description:'Your data stays in your local database.',
    eyebrow:'Privacy',heading:'Privacy',subheading:'You control your copy and its data.',updated:'5 September 2026',
    sections:[
      {title:'Your copy',body:'Transactions, balances, rules and settings are stored in your local SQLite file. YouInc sends no product telemetry. The author has no access to your installation.'},
      {title:'The demo',body:'The demo uses fixed sample data. Dashboard layout preferences are saved in your browser. The website host may keep technical access logs.'},
      {title:'Optional bank sync',body:'If you configure Akahu, the app contacts Akahu using your own credentials. Tokens stay in your environment file and are never returned to the browser.'},
      {title:'Backups and deletion',body:'Settings lets you download your data. Stop the app before deleting the database. Backups remain wherever you saved them.'},
      {title:'Contact',body:<a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>},
    ],
  },
};
export function pageData(id: StaticPageId): StaticPageData { return STATIC_PAGES[id]; }
