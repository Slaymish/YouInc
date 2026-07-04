import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BOOKING_URL, DEFAULT_EMAIL } from "./config";

export type StaticPageId =
  | "privacy"
  | "terms"
  | "security"
  | "data-deletion"
  | "contact"
  | "docs"
  | "help"
  | "integrations"
  | "status"
  | "changelog"
  | "roadmap"
  | "about"
  | "compare"
  | "use-cases";

interface StaticPageSection {
  title: string;
  body?: ReactNode;
  items?: readonly ReactNode[];
}

interface StaticPageData {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  subheading: ReactNode;
  updated?: string;
  sections: readonly StaticPageSection[];
  cta?: {
    label: string;
    href: string;
    external?: boolean;
  };
}

export const STATIC_PAGES: Record<StaticPageId, StaticPageData> = {
  privacy: {
    title: "Privacy - YouInc",
    description:
      "How YouInc collects, uses, stores, and deletes personal and financial data.",
    eyebrow: "Trust",
    heading: "Privacy Policy",
    updated: "4 July 2026",
    subheading:
      "YouInc is a founder-led finance product. This v1 policy explains the data used to run the service, how bank access works, and how to ask for export or deletion.",
    sections: [
      {
        title: "What YouInc collects",
        items: [
          "Your email address and basic account details when you join the waitlist, sign in, book a call, or request support.",
          "Financial data you choose to connect, including account names, balances, transactions, categories, and ledger entries.",
          "Product feedback, support messages, booking details, and the page or source that generated the message.",
          "Technical information such as user agent, session information, logs, and security events needed to operate and protect the product.",
        ],
      },
      {
        title: "Bank connections",
        body: (
          <>
            Live bank sync is provided through{" "}
            <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
              Akahu
            </a>
            . Connections are read-only. YouInc does not ask for or store your bank password. You choose which accounts to share and can revoke access through Akahu or by contacting YouInc.
          </>
        ),
      },
      {
        title: "How the data is used",
        items: [
          "To build and maintain your double-entry ledger, dashboard widgets, exports, and custom views.",
          "To provide support, respond to questions, and improve onboarding and product quality.",
          "To detect errors, abuse, failed syncs, suspicious activity, and operational problems.",
          "To communicate about access, billing, product updates, and service changes.",
        ],
      },
      {
        title: "What YouInc does not do",
        items: [
          "YouInc does not sell your personal or financial data.",
          "YouInc does not use your bank data for advertising targeting.",
          "YouInc does not store your bank login details.",
          "YouInc does not provide financial, tax, investment, or legal advice.",
        ],
      },
      {
        title: "Storage, retention, and deletion",
        body:
          "Data is kept for as long as needed to provide the service, meet legal or operational obligations, resolve disputes, prevent abuse, and maintain backups. You can request export or deletion at any time. Some records may remain temporarily in backups, logs, or accounting records where required.",
      },
      {
        title: "Contact",
        body: (
          <>
            Privacy questions and deletion requests can be sent to{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>. A domain-specific privacy inbox should replace this address before broader public launch.
          </>
        ),
      },
    ],
  },

  terms: {
    title: "Terms - YouInc",
    description:
      "The v1 terms for using YouInc, including subscriptions, custom builds, data exports, and important disclaimers.",
    eyebrow: "Legal",
    heading: "Terms of Service",
    updated: "4 July 2026",
    subheading:
      "These plain-English v1 terms describe how YouInc is offered while the product is founder-led and access is still controlled. They should be reviewed by a lawyer before broad public launch.",
    sections: [
      {
        title: "Using YouInc",
        items: [
          "YouInc helps individuals understand their finances through bank sync, a double-entry ledger, dashboards, exports, and optional custom work.",
          "You are responsible for the accuracy of any information you connect, import, edit, or manually enter.",
          "You must not misuse the service, attempt to access another person's data, interfere with security controls, or use YouInc for unlawful activity.",
        ],
      },
      {
        title: "Not financial advice",
        body:
          "YouInc provides software, reports, widgets, and operational views. It does not provide financial advice, tax advice, legal advice, investment advice, lending advice, or accounting services. You should verify important decisions with a qualified professional.",
      },
      {
        title: "Plans and billing",
        items: [
          "Demo access uses sample data and does not require a bank connection.",
          "Self-serve access is shown as a monthly NZD subscription while access is being rolled out.",
          "Concierge work may include a monthly plan, scoped one-off builds, or both. Any paid custom work should be confirmed in writing before work begins.",
          "Prices may change over time. Existing users should receive reasonable notice before material changes apply to them.",
        ],
      },
      {
        title: "Custom builds",
        body:
          "Custom widgets, integrations, and ledger-aware automation are scoped around a specific outcome. Unless agreed otherwise, custom work is delivered inside YouInc and may inform general product improvements without exposing your private data.",
      },
      {
        title: "Cancellation and export",
        body:
          "You can stop using YouInc and request export of your ledger. YouInc aims to make your data portable through plain-text accounting journals and related export formats where available.",
      },
      {
        title: "Availability and changes",
        body:
          "YouInc is operated as a founder-led product. The service may change, improve, pause, or experience outages. Critical incidents and material changes should be communicated clearly as the product matures.",
      },
      {
        title: "Contact",
        body: (
          <>
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>.
          </>
        ),
      },
    ],
  },

  security: {
    title: "Security - YouInc",
    description:
      "How YouInc protects bank data, account access, ledger data, exports, and support requests.",
    eyebrow: "Trust",
    heading: "Security at YouInc",
    updated: "4 July 2026",
    subheading:
      "YouInc handles sensitive financial data, so the security model starts with limited access, read-only bank connections, clear export controls, and founder-accountable support.",
    sections: [
      {
        title: "Current security posture",
        items: [
          "Bank connections are read-only and run through Akahu. YouInc does not store bank passwords.",
          "Passkey-based sign-in is used for product access where accounts are enabled.",
          "Connected financial data is used to build the ledger and dashboard views you request.",
          "Demo access uses sample data and does not expose real customer data.",
        ],
      },
      {
        title: "Data protection principles",
        items: [
          "Collect the minimum data needed to operate the product and support the user.",
          "Keep financial data separated by account and avoid pooling user ledgers for advertising or resale.",
          "Make ledger export and exit paths part of the product, not an afterthought.",
          "Treat support access to financial data as sensitive and use it only to help the user or operate the service.",
        ],
      },
      {
        title: "Incident response v1",
        body:
          "Security reports and suspected incidents are reviewed directly by the founder. Confirmed issues should be triaged, patched, communicated to affected users where appropriate, and recorded in the changelog or status history when they materially affect customers.",
      },
      {
        title: "Vulnerability disclosure",
        body: (
          <>
            Please report suspected vulnerabilities to{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>. Include the affected page or endpoint, reproduction steps, impact, and whether any data may have been accessed. A dedicated security@youinc.app inbox should replace this before broad launch.
          </>
        ),
      },
      {
        title: "Security roadmap",
        items: [
          "Publish infrastructure and data-flow diagrams at a non-sensitive level.",
          "Create a dedicated security contact address and vulnerability disclosure policy.",
          "Document backup, restore, encryption, access-review, and incident-response procedures.",
          "Add third-party review or penetration testing before scaling beyond early users.",
        ],
      },
    ],
    cta: { label: "Read data controls", href: "/data-deletion" },
  },

  "data-deletion": {
    title: "Data deletion - YouInc",
    description:
      "How to export, disconnect, and delete YouInc financial data and account records.",
    eyebrow: "Data controls",
    heading: "Export, disconnect, and delete your data",
    updated: "4 July 2026",
    subheading:
      "YouInc is designed around data portability. You should be able to leave with a readable ledger and revoke bank access without lock-in.",
    sections: [
      {
        title: "Export your ledger",
        items: [
          "Export the full double-entry ledger as plain-text accounting journals where available.",
          "Keep your own copy before cancelling or requesting deletion.",
          "Ask for help if you need a format suitable for hledger, accounting review, or custom analysis.",
        ],
      },
      {
        title: "Disconnect bank access",
        body:
          "Bank feeds are permissioned through Akahu. You can revoke access through Akahu or ask YouInc to guide you through the process. Once access is revoked, new bank transactions should stop syncing.",
      },
      {
        title: "Delete your YouInc account",
        items: [
          "Email the support contact with the email address connected to your account.",
          "YouInc may verify the request before deletion to protect against unauthorized account removal.",
          "Active subscriptions or custom work may need to be settled or cancelled before final deletion.",
        ],
      },
      {
        title: "What deletion means",
        body:
          "Deletion should remove active account records, connected financial data, ledger entries, and dashboard configuration from production systems where practical. Some information may remain temporarily in backups, security logs, invoices, or records needed for legal, billing, abuse-prevention, or dispute-resolution purposes.",
      },
      {
        title: "Request deletion",
        body: (
          <>
            Send requests to <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>. Include the email address used with YouInc and whether you want export, disconnection, deletion, or all three.
          </>
        ),
      },
    ],
  },

  contact: {
    title: "Contact - YouInc",
    description:
      "Contact YouInc for support, security reports, privacy requests, billing questions, and custom build discussions.",
    eyebrow: "Support",
    heading: "Talk to a real person",
    subheading:
      "YouInc is founder-led. That means support, onboarding, and custom-build conversations are handled directly while the product is still early.",
    sections: [
      {
        title: "Best ways to reach YouInc",
        items: [
          <>
            Book an intro call for Concierge, onboarding, or custom-build questions: <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">cal.com/youinc/intro</a>.
          </>,
          <>
            Email support, privacy, billing, and security questions to <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>.
          </>,
          "Include the page, account email, and a short description of what happened if you are reporting a bug or sync issue.",
        ],
      },
      {
        title: "Response expectations",
        body:
          "V1 support is human and founder-led, not a 24/7 call center. Urgent security or data-access concerns should be marked clearly in the email subject so they can be triaged first.",
      },
      {
        title: "Before wider launch",
        body:
          "The contact surface should move to domain-specific addresses such as support@youinc.app, security@youinc.app, privacy@youinc.app, and billing@youinc.app.",
      },
    ],
    cta: { label: "Book a call", href: BOOKING_URL, external: true },
  },

  docs: {
    title: "Docs - YouInc",
    description:
      "V1 YouInc documentation for setup, bank sync, ledgers, widgets, exports, and support.",
    eyebrow: "Resources",
    heading: "Documentation",
    subheading:
      "A starting map for using YouInc. These docs should grow into a full help center as onboarding, bank sync, exports, and custom builds mature.",
    sections: [
      {
        title: "Getting started",
        items: [
          "Open the demo to understand the dashboard without connecting real accounts.",
          "Join the waitlist or book a call if you want live bank sync enabled for your account.",
          "When invited, connect supported accounts through Akahu and confirm which accounts should be included.",
          "Review the generated ledger and dashboard widgets before relying on reports for decisions.",
        ],
      },
      {
        title: "Core concepts",
        items: [
          "Ledger: the double-entry record underneath every dashboard view.",
          "Widgets: configurable dashboard panels that read from the ledger.",
          "Manual accounts: assets or liabilities that bank feeds cannot see, maintained by hand or custom integration.",
          "Exports: plain-text ledger output so your financial history stays portable.",
        ],
      },
      {
        title: "Useful pages",
        items: [
          <Link to="/demo">Live demo</Link>,
          <Link to="/widgets">Widget library</Link>,
          <Link to="/integrations">Integrations</Link>,
          <Link to="/security">Security</Link>,
          <Link to="/data-deletion">Data controls</Link>,
        ],
      },
      {
        title: "Docs roadmap",
        body:
          "Add screenshots, task walkthroughs, troubleshooting guides, export examples, and short videos as real onboarding questions appear.",
      },
    ],
  },

  help: {
    title: "Help - YouInc",
    description:
      "V1 help center for common YouInc questions around access, bank sync, widgets, exports, and support.",
    eyebrow: "Help center",
    heading: "Help and support",
    subheading:
      "Short answers for the questions people are most likely to ask before or during early access.",
    sections: [
      {
        title: "Access",
        items: [
          "The demo is public and uses sample data.",
          "Live connected accounts are enabled through controlled early access.",
          "Concierge users can book a call to scope custom dashboards, integrations, or ledger-aware automation.",
        ],
      },
      {
        title: "Bank sync",
        items: [
          "Live bank sync currently depends on Akahu and is focused on New Zealand-connected accounts.",
          "Connections are read-only and can be revoked.",
          "Unsupported accounts can be tracked manually or through a custom integration where practical.",
        ],
      },
      {
        title: "Exports and cancellation",
        body:
          "YouInc is designed to avoid lock-in. Export your ledger before cancellation or deletion, and contact support if you need help with a specific format.",
      },
      {
        title: "Still stuck?",
        body: (
          <>
            Email <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a> or <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">book a call</a>.
          </>
        ),
      },
    ],
  },

  integrations: {
    title: "Integrations - YouInc",
    description:
      "How YouInc connects to Akahu, supported banks, manual accounts, exports, and custom integrations.",
    eyebrow: "Product",
    heading: "Integrations",
    subheading:
      "YouInc starts with New Zealand open banking through Akahu, then fills the gaps with manual accounts, exports, and scoped custom integrations.",
    sections: [
      {
        title: "Akahu bank sync",
        body: (
          <>
            YouInc uses <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">Akahu</a> as the secure open-finance bridge for supported New Zealand accounts. You choose which accounts to share. Access is read-only.
          </>
        ),
      },
      {
        title: "Supported institution types",
        items: [
          "Banks and account providers available through Akahu.",
          "Investment or savings providers available through Akahu where supported.",
          "Manual accounts for assets and liabilities that are not available through a live feed.",
        ],
      },
      {
        title: "Manual and custom sources",
        body:
          "Some assets and liabilities do not have a clean bank feed. YouInc can track them manually or through a scoped integration if there is an export, API, spreadsheet, or reliable source to map into journal entries.",
      },
      {
        title: "Integration principles",
        items: [
          "Prefer read-only access where possible.",
          "Post imported data into a balanced ledger rather than leaving it as disconnected rows.",
          "Make unsupported accounts visible instead of pretending bank sync covers everything.",
          "Keep export paths available so the ledger can outlive YouInc.",
        ],
      },
    ],
    cta: { label: "Discuss a custom integration", href: BOOKING_URL, external: true },
  },

  status: {
    title: "Status - YouInc",
    description:
      "Current v1 service status for YouInc app availability, bank sync, demo, and support.",
    eyebrow: "Operations",
    heading: "System status",
    subheading:
      "A lightweight v1 status page. This should become automated before YouInc has many connected users.",
    sections: [
      {
        title: "Current status",
        items: [
          "Marketing site: no known issue.",
          "Live demo: no known issue.",
          "Bank sync: early-access only. No public incident currently posted.",
          "Support: founder-led email and booking support.",
        ],
      },
      {
        title: "Incident history",
        body:
          "No public incidents have been posted yet. Future material incidents should list date, affected systems, user impact, resolution, and follow-up actions.",
      },
      {
        title: "Status roadmap",
        items: [
          "Move this to monitored uptime checks for app, API, database, and demo routes.",
          "Add Akahu dependency notes and sync-health reporting.",
          "Publish incident postmortems for material user-facing outages.",
        ],
      },
    ],
  },

  changelog: {
    title: "Changelog - YouInc",
    description:
      "A v1 changelog showing how YouInc is changing over time.",
    eyebrow: "Product updates",
    heading: "Changelog",
    subheading:
      "A public record that YouInc is maintained. Keep this factual, dated, and tied to user-visible changes.",
    sections: [
      {
        title: "4 July 2026",
        items: [
          "Added v1 trust, legal, security, docs, status, and company pages.",
          "Expanded footer navigation so users can find data controls before connecting financial accounts.",
          "Documented the page-maintenance process for privacy, security, legal, and product updates.",
        ],
      },
      {
        title: "Earlier foundation",
        items: [
          "Published the marketing landing page, pricing comparison, widget library, custom-builds page, and live sample-data demo.",
          "Added feedback and founder-led support affordances for early users.",
          "Connected marketing copy to the same sample dashboard data used by the demo where practical.",
        ],
      },
      {
        title: "How to maintain this page",
        body:
          "Add a short entry whenever a user-visible feature, security posture, pricing detail, onboarding step, integration, or support process changes. Do not use it for internal chores that do not matter to users.",
      },
    ],
  },

  roadmap: {
    title: "Roadmap - YouInc",
    description:
      "The v1 public roadmap for YouInc product, integrations, documentation, and trust work.",
    eyebrow: "Product direction",
    heading: "Roadmap",
    subheading:
      "A practical roadmap for a founder-led finance product. Dates should stay conservative and this page should not promise features before they are scoped.",
    sections: [
      {
        title: "Now",
        items: [
          "Controlled early access for connected accounts.",
          "Public demo, pricing comparison, widget library, and custom-build explanation.",
          "V1 privacy, terms, security, data controls, docs, and support pages.",
        ],
      },
      {
        title: "Next",
        items: [
          "Clearer onboarding docs for Akahu connection, manual accounts, exports, and dashboard customization.",
          "Domain-specific support, privacy, billing, and security email addresses.",
          "More export examples and ledger troubleshooting guides.",
          "Better public status and incident communication.",
        ],
      },
      {
        title: "Later",
        items: [
          "Customer-approved use cases and testimonials.",
          "Expanded integrations beyond the first Akahu-led workflows where technically and commercially justified.",
          "Third-party security review before broader public launch.",
          "More self-serve controls for account deletion, data export, billing, and onboarding.",
        ],
      },
    ],
  },

  about: {
    title: "About - YouInc",
    description:
      "The story and operating principles behind YouInc, a founder-led personal finance ledger product.",
    eyebrow: "Company",
    heading: "Founder-led finance software, built for ownership.",
    subheading:
      "YouInc exists for people who want the clarity of a company finance stack applied to their own life, without losing control of their data.",
    sections: [
      {
        title: "What YouInc is",
        body:
          "YouInc turns connected accounts into a live double-entry ledger, then renders the numbers through dashboard widgets for net worth, cashflow, runway, income, expenses, and exceptions worth attention.",
      },
      {
        title: "Why founder-led",
        body:
          "The product is still early, and finance workflows are personal. Founder-led support means onboarding and custom work can stay close to real user problems while the core product matures.",
      },
      {
        title: "Operating principles",
        items: [
          "Be clear when something is live, sample, manual, or custom-built.",
          "Prefer read-only access, exportable ledgers, and no lock-in.",
          "Treat financial data as sensitive by default.",
          "Build useful finance infrastructure before adding decorative AI.",
        ],
      },
      {
        title: "Built in New Zealand",
        body:
          "YouInc is designed around New Zealand open banking through Akahu first. The product may expand over time, but the initial trust model and integration surface are intentionally focused.",
      },
    ],
    cta: { label: "Book a founder-led intro", href: BOOKING_URL, external: true },
  },

  compare: {
    title: "Compare - YouInc",
    description:
      "How YouInc compares with budgeting apps, spreadsheets, personal finance apps, and accounting tools.",
    eyebrow: "Alternatives",
    heading: "How YouInc is different",
    subheading:
      "YouInc is not just a budgeting app or a prettier spreadsheet. It is a personal finance ledger with executive-style reporting on top.",
    sections: [
      {
        title: "Versus budgeting apps",
        body:
          "Budgeting apps usually focus on envelopes, habit tracking, and spending limits. YouInc focuses on a double-entry view of what you own, owe, earn, and spend, then reports on net worth, runway, cashflow, and exceptions.",
      },
      {
        title: "Versus spreadsheets",
        body:
          "Spreadsheets are flexible, but they are easy to break and hard to keep synced. YouInc aims to keep the source data connected, the ledger balanced, and the dashboard reusable.",
      },
      {
        title: "Versus accounting software",
        body:
          "Small-business accounting tools are powerful, but often shaped around invoices, tax workflows, payroll, and business compliance. YouInc borrows the ledger discipline without forcing your personal finances into a business-operations product.",
      },
      {
        title: "Where YouInc may not fit",
        items: [
          "You want a fully self-serve global bank-sync product today.",
          "You need regulated financial advice rather than software and reporting.",
          "You mainly want envelope budgeting and daily habit nudges.",
          "You do not want a founder-led early-access product.",
        ],
      },
    ],
    cta: { label: "Try the demo", href: "/demo" },
  },

  "use-cases": {
    title: "Use cases - YouInc",
    description:
      "Example ways people can use YouInc for net worth, runway, cashflow, manual accounts, and custom finance views.",
    eyebrow: "Use cases",
    heading: "What people use YouInc for",
    subheading:
      "These are product use cases, not customer claims. Replace them with approved customer stories only when real users consent.",
    sections: [
      {
        title: "Personal CFO dashboard",
        body:
          "See net worth, liquidity, runway, income, expenses, debt, and exceptions in one place instead of hopping between accounts and spreadsheets.",
      },
      {
        title: "Manual asset tracking",
        body:
          "Track assets and liabilities that bank feeds cannot see, such as property, KiwiSaver, vehicles, private investments, or loans, then bring them into the same dashboard.",
      },
      {
        title: "Custom decision views",
        body:
          "Concierge work can create a view around a specific decision, such as taking time off, paying down debt, tracking a savings target, or understanding project-level income.",
      },
      {
        title: "Ledger export and review",
        body:
          "Export the underlying journal so you can inspect, archive, or process your financial history outside YouInc.",
      },
    ],
    cta: { label: "Explore custom builds", href: "/custom-builds" },
  },
};

export function pageData(id: StaticPageId): StaticPageData {
  return STATIC_PAGES[id];
}
