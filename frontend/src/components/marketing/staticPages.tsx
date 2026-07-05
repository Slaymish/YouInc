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
      "YouInc is a founder-led finance product built and operated in New Zealand. This plain-English policy explains what data the service uses, how bank access works, and how to export or delete your data. It is a v1 policy and is not yet a substitute for legally reviewed terms.",
    sections: [
      {
        title: "Who runs YouInc",
        body: "YouInc is operated by its founder from New Zealand. Because it is still early and founder-led, the person you email is the person who runs the service. A registered legal entity name and address will be added here once finalised.",
      },
      {
        title: "What YouInc collects",
        items: [
          "Account basics: your email address and sign-in details when you join the waitlist, enrol a passkey, book a call, or contact support.",
          "Financial data you choose to connect or enter, including account names, balances, transactions, categories, manual accounts, and ledger entries.",
          "Messages you send, including support requests, feedback, booking details, and the page or source that generated the message.",
          "Technical records needed to run and protect the service, such as browser/user-agent details, session records, and security and error logs.",
        ],
      },
      {
        title: "Bank connections",
        body: (
          <>
            Live bank sync is provided through{" "}
            <a
              href="https://akahu.nz"
              target="_blank"
              rel="noopener noreferrer"
            >
              Akahu
            </a>
            , New Zealand's open-finance provider. Connections are read-only:
            YouInc receives account and transaction data you approve, and never
            asks for or stores your online-banking password. You choose which
            accounts to share, and you can revoke access at any time through
            Akahu or by asking YouInc.
          </>
        ),
      },
      {
        title: "How the data is used",
        items: [
          "To build and maintain your double-entry ledger, dashboard widgets, exports, and any custom views.",
          "To provide support, answer your questions, and improve onboarding and product quality.",
          "To detect errors, failed syncs, abuse, suspicious activity, and other operational problems.",
          "To contact you about access, billing, product updates, and service changes.",
        ],
      },
      {
        title: "Service providers YouInc relies on",
        body: "To operate, YouInc uses a small number of third-party providers, including Akahu for bank connections and cloud infrastructure for hosting, storage, and backups. These providers process data only to deliver their part of the service. A named subprocessor list will be published on this page as the provider set is finalised.",
      },
      {
        title: "What YouInc does not do",
        items: [
          "YouInc does not sell your personal or financial data.",
          "YouInc does not use your bank data for advertising or ad targeting.",
          "YouInc does not store your online-banking login details.",
          "YouInc does not provide financial, tax, investment, or legal advice.",
        ],
      },
      {
        title: "Your choices and rights",
        items: [
          "Access and export: request a copy of your ledger as plain-text accounting journals at any time.",
          "Correction: fix or re-classify data inside the product, or ask for help correcting it.",
          "Disconnect: revoke bank access through Akahu so new transactions stop syncing.",
          "Deletion: ask YouInc to delete your account and connected data. See the data controls page for the full process.",
        ],
      },
      {
        title: "Storage, retention, and deletion",
        body: "Data is kept only as long as needed to provide the service, meet legal or accounting obligations, resolve disputes, prevent abuse, and maintain backups. You can request export or deletion at any time. After deletion, some records may remain briefly in encrypted backups or in billing and security logs until they age out or are no longer required.",
      },
      {
        title: "Jurisdiction",
        body: "YouInc is built and operated in New Zealand and aims to handle personal information consistently with the New Zealand Privacy Act 2020. This section will be confirmed during legal review before broad public launch.",
      },
      {
        title: "Contact",
        body: (
          <>
            Privacy questions and deletion requests can be sent to{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>. A dedicated
            privacy address will be published as YouInc opens up to more users.
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
      "These plain-English v1 terms describe how YouInc is offered while the product is founder-led and access is still controlled. They are written to be honest and readable, not to serve as final legal terms, and will be reviewed by a lawyer before broad public launch.",
    sections: [
      {
        title: "Using YouInc",
        items: [
          "YouInc helps individuals understand their finances through bank sync, a double-entry ledger, dashboards, exports, and optional custom work.",
          "You need a compatible account and, for live access, a passkey to sign in. You are responsible for keeping access to your device and passkey secure.",
          "You are responsible for the accuracy of any information you connect, import, edit, or enter by hand.",
        ],
      },
      {
        title: "Acceptable use",
        items: [
          "Do not attempt to access another person's account or data.",
          "Do not probe, disable, or interfere with security controls except through the vulnerability disclosure process on the security page.",
          "Do not use YouInc for unlawful activity or to store data you are not entitled to hold.",
        ],
      },
      {
        title: "Not financial advice",
        body: "YouInc provides software, reports, widgets, and operational views. It does not provide financial, tax, legal, investment, lending, or accounting advice, and it is not a registered financial adviser. You should verify important decisions with a qualified professional.",
      },
      {
        title: "Plans and billing",
        items: [
          "Demo access uses sample data, is free, and does not require a bank connection.",
          "Self-serve access is offered as a monthly NZD subscription while access is being rolled out.",
          "Concierge work may be a monthly plan, a scoped one-off build, or both. Paid custom work is confirmed in writing, including scope and price, before work begins.",
          "Prices may change over time. Existing subscribers will get reasonable notice before a material change applies to them.",
        ],
      },
      {
        title: "Custom builds",
        body: "Custom widgets, integrations, and ledger-aware automation are scoped around a specific outcome agreed in writing. Unless agreed otherwise, custom work is delivered inside YouInc. General product improvements learned from custom work do not expose your private financial data.",
      },
      {
        title: "Cancellation and export",
        body: "You can stop using YouInc at any time and request an export of your ledger. YouInc keeps your data portable through hledger-compatible plain-text accounting journals so your financial history can outlive the product. See the data controls page for the export, disconnect, and deletion steps.",
      },
      {
        title: "Availability and liability",
        body: "YouInc is a founder-led product still in early access. The service may change, pause, or experience outages, and it is provided on an as-is basis without guarantees of uninterrupted availability. Material incidents and changes will be communicated as clearly as possible. Specific liability limits will be set during legal review.",
      },
      {
        title: "Governing law",
        body: "YouInc is operated from New Zealand and these terms are intended to be governed by New Zealand law. The governing-law clause, dispute process, and the operating legal entity will be confirmed during legal review.",
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
    updated: "5 July 2026",
    subheading:
      "YouInc handles sensitive financial data, so the security model starts with least-privilege access, read-only bank connections, per-user data separation, clear export controls, and founder-accountable support. This page describes today's posture honestly and marks what is still planned.",
    sections: [
      {
        title: "How sign-in works",
        items: [
          "Accounts use email + password sign-in, and new signups must confirm their email address before the workspace unlocks.",
          "Every workspace is isolated at the database level by row-level security, so you only ever see your own tenant's data — never another customer's.",
          "The app is served over HTTPS and sessions are held in secure, HTTP-only cookies bound to the YouInc origin.",
        ],
      },
      {
        title: "How bank data is handled",
        items: [
          "Bank connections run through Akahu and are read-only. YouInc never receives or stores your online-banking password.",
          "You choose which accounts to share, and you can revoke access through Akahu at any time.",
          "Connected data is used only to build the ledger and dashboard views you ask for.",
          "The demo uses sample data on a separate store and never exposes real customer data.",
        ],
      },
      {
        title: "Data separation",
        body: "YouInc is built as a multi-tenant system where each user's ledger is scoped to their own tenant, and database row-level security is designed so a query can only reach rows the signed-in user is a member of. This isolation model has not yet been independently audited, and a third-party review is on the roadmap below.",
      },
      {
        title: "Data protection principles",
        items: [
          "Collect the minimum data needed to run the product and support the user.",
          "Keep financial data separated per user and never pool ledgers for advertising or resale.",
          "Make ledger export and exit paths first-class, not an afterthought.",
          "Treat any support access to financial data as sensitive and use it only to help the user or operate the service.",
        ],
      },
      {
        title: "Backups",
        body: "Production data is backed up on a scheduled basis so it can be restored after a failure. Restore drills, retention windows, and encryption-at-rest details will be documented as part of the security roadmap below.",
      },
      {
        title: "Incident response",
        body: "Security reports and suspected incidents are reviewed directly by the founder. Confirmed issues are triaged, patched, communicated to affected users where appropriate, and recorded on the status page and changelog when they materially affect customers.",
      },
      {
        title: "Reporting a vulnerability",
        body: (
          <>
            Please report suspected vulnerabilities to{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a> with
            "security" in the subject line. Include the affected page or
            endpoint, reproduction steps, impact, and whether any data may have
            been accessed. Please do not publicly disclose an issue before it is
            fixed. A dedicated security inbox and a formal disclosure policy are
            on the roadmap below.
          </>
        ),
      },
      {
        title: "Security roadmap",
        items: [
          "Publish infrastructure and data-flow diagrams at a non-sensitive level.",
          "Stand up a dedicated security contact address and a written vulnerability disclosure policy.",
          "Document backup, restore, encryption, and access-review procedures in detail.",
          "Commission a third-party security review before scaling beyond early users.",
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
      "YouInc is designed around data portability. You should be able to leave with a readable ledger and revoke bank access without lock-in. These three controls — export, disconnect, and delete — are separate, so you can do any one of them without the others.",
    sections: [
      {
        title: "Step 1 — Export your ledger",
        items: [
          "Export your full double-entry ledger as hledger-compatible plain-text accounting journals.",
          "Do this before you cancel or delete, so you keep your own permanent copy.",
          "The journal is a readable text file you can archive, hand to an accountant, or load into hledger and other plain-text accounting tools.",
          "If you need help producing a specific format for review or analysis, ask and YouInc will help.",
        ],
      },
      {
        title: "Step 2 — Disconnect bank access",
        body: "Bank feeds are permissioned through Akahu. You can revoke YouInc's read-only access from Akahu at any time, or ask YouInc to walk you through it. Once access is revoked, no new bank transactions sync. Disconnecting stops new data but does not delete data already imported — use step 3 for that.",
      },
      {
        title: "Step 3 — Delete your account and data",
        items: [
          <>
            Email <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a> from
            the address connected to your account, with "delete my account" in
            the subject.
          </>,
          "YouInc may verify the request first, so that nobody else can delete your account.",
          "Settle or cancel any active subscription or in-progress custom work before final deletion.",
          "Export first (step 1) if you want a copy — deletion cannot be undone.",
        ],
      },
      {
        title: "What deletion removes, and what may remain",
        body: "Deletion removes your active account, connected financial data, ledger entries, and dashboard configuration from live systems. For a short period afterwards, some data may still exist in scheduled backups until they age out, and limited records may be kept where the law requires it — for example invoices for tax purposes and security logs for abuse prevention. These are retained no longer than necessary.",
      },
      {
        title: "Response time",
        body: "Deletion is currently handled by hand during early access, so it is not instant. YouInc aims to acknowledge requests quickly and complete verified deletions promptly. A self-serve deletion control is on the roadmap.",
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
            Book an intro call for Concierge, onboarding, or custom-build
            questions:{" "}
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
              cal.com/youinc/intro
            </a>
            .
          </>,
          <>
            Email support, privacy, billing, and security questions to{" "}
            <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>.
          </>,
          "Include the page, account email, and a short description of what happened if you are reporting a bug or sync issue.",
        ],
      },
      {
        title: "What to expect",
        body: 'Support is human and founder-led, not a 24/7 call centre. During early access you are emailing the person who builds and runs YouInc. Urgent security or data-access concerns should say "security" or "urgent" in the subject line so they can be triaged first.',
      },
      {
        title: "Which topics go where",
        items: [
          "Support, bugs, and sync issues: email with the page, your account email, and what happened.",
          "Privacy, export, or deletion requests: email from your account address — see the data controls page for the steps.",
          'Security reports: email with "security" in the subject — see the security page for what to include.',
          "Billing, Concierge, and custom builds: email or book an intro call.",
        ],
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
      "A starting map for using YouInc: what it is, how to get in, the core ideas, and where to go next. These docs will grow into full task walkthroughs with screenshots as onboarding, bank sync, and exports mature.",
    sections: [
      {
        title: "What YouInc does",
        body: (
          <>
            YouInc turns your connected accounts into a live double-entry
            ledger, then renders it as dashboard widgets — net worth, cashflow,
            runway, income, expenses, and exceptions. The{" "}
            <Link to="/widgets">widget library</Link> shows each one running on
            sample data.
          </>
        ),
      },
      {
        title: "Getting started",
        items: [
          <>
            Open the <Link to="/demo">live demo</Link> to explore the dashboard
            on sample data, with no sign-up and no bank connection.
          </>,
          <>
            <Link to="/signup">Create your account</Link> and follow the short
            onboarding to name your workspace — no card required.
          </>,
          "Connect the accounts you want through Akahu, choosing exactly which accounts to share.",
          "Review the generated ledger and widgets, and re-classify anything that looks off before relying on the reports.",
        ],
      },
      {
        title: "Connect a bank account",
        body: (
          <>
            Live bank sync uses{" "}
            <a
              href="https://akahu.nz"
              target="_blank"
              rel="noopener noreferrer"
            >
              Akahu
            </a>
            . You approve read-only access to specific accounts, YouInc imports
            transactions and balances, and posts them into your ledger. YouInc
            never sees your banking password, and you can revoke access from
            Akahu at any time. See <Link to="/integrations">integrations</Link>{" "}
            for what is supported.
          </>
        ),
      },
      {
        title: "Add a manual account",
        body: "Assets and liabilities without a bank feed — property, KiwiSaver, vehicles, private loans — can be tracked as manual accounts. You set the balance yourself and update it as it changes, and it flows into the same net-worth and dashboard views as connected accounts.",
      },
      {
        title: "Export your ledger",
        body: (
          <>
            Your full history exports as hledger-compatible plain-text journals,
            so it stays portable and readable outside YouInc. The{" "}
            <Link to="/data-deletion">data controls</Link> page covers export,
            disconnecting Akahu, and deletion.
          </>
        ),
      },
      {
        title: "Core concepts",
        items: [
          "Ledger: the balanced double-entry record underneath every dashboard view.",
          "Widgets: configurable dashboard panels that read from the ledger.",
          "Manual accounts: assets or liabilities bank feeds cannot see, maintained by hand.",
          "Classification: how transactions are sorted into accounts; you can correct and re-run it.",
          "Exports: plain-text journal output so your financial history stays portable.",
        ],
      },
      {
        title: "Where to go next",
        items: [
          <Link to="/widgets">Widget library</Link>,
          <Link to="/integrations">Integrations</Link>,
          <Link to="/help">Help and common questions</Link>,
          <Link to="/security">Security</Link>,
          <Link to="/data-deletion">Data controls</Link>,
        ],
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
      "Short, honest answers to the questions people ask most before and during early access. If your question is not here, email and ask.",
    sections: [
      {
        title: "How do I get access?",
        items: [
          "The demo is public, uses sample data, and needs no sign-up.",
          "Self-serve accounts are open: create an account, name your workspace, and connect your accounts when you're ready.",
          "Concierge users can book a call to scope custom dashboards, integrations, or ledger-aware automation.",
        ],
      },
      {
        title: "How do I sign in?",
        body: "Live access uses a passkey (WebAuthn) rather than a password, so sign-in relies on your device's biometrics or PIN. There is no password to reset; if you lose access to your passkey, contact support to recover your account.",
      },
      {
        title: "Is my bank login safe?",
        items: [
          "Live bank sync runs through Akahu and is read-only.",
          "YouInc never sees or stores your online-banking password.",
          "You choose which accounts to share and can revoke access from Akahu at any time.",
        ],
      },
      {
        title: "Which banks and accounts are supported?",
        body: (
          <>
            Live sync currently covers New Zealand accounts available through
            Akahu. Anything without a feed — property, KiwiSaver, vehicles,
            private loans — can be tracked as a manual account. See{" "}
            <Link to="/integrations">integrations</Link> for detail.
          </>
        ),
      },
      {
        title: "Can I get my data out?",
        body: (
          <>
            Yes. Export your full ledger as plain-text accounting journals at
            any time — there is no lock-in. Do this before you cancel or delete.
            The <Link to="/data-deletion">data controls</Link> page has the
            steps.
          </>
        ),
      },
      {
        title: "How do I cancel or delete my account?",
        body: (
          <>
            Cancelling stops billing; deletion removes your data. They are
            separate — you can cancel and keep your data, or ask for full
            deletion. Export first if you want a copy. See{" "}
            <Link to="/data-deletion">data controls</Link>.
          </>
        ),
      },
      {
        title: "Still stuck?",
        body: (
          <>
            Email <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a> or{" "}
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
              book a call
            </a>
            . Include the page and your account email if it is a bug or sync
            issue.
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
      "YouInc starts with New Zealand open banking through Akahu, then fills the gaps with manual accounts, exports, and scoped custom integrations. Here is what connects today and what does not.",
    sections: [
      {
        title: "Akahu bank sync",
        body: (
          <>
            Live bank sync runs through{" "}
            <a
              href="https://akahu.nz"
              target="_blank"
              rel="noopener noreferrer"
            >
              Akahu
            </a>
            , New Zealand's open-finance provider. You approve read-only access
            to specific accounts through Akahu's own consent flow, YouInc
            imports balances and transactions, and posts them into your ledger.
            YouInc never receives your banking password, and you can revoke
            access from Akahu at any time.
          </>
        ),
      },
      {
        title: "What connects today",
        items: [
          "New Zealand bank and account providers available through Akahu.",
          "Investment or savings providers available through Akahu, where they are supported.",
          "Manual accounts for anything without a live feed — you keep the balance current yourself.",
        ],
      },
      {
        title: "Manual accounts",
        body: "Many assets and liabilities have no clean bank feed — property, KiwiSaver, vehicles, private investments, or personal loans. Track these as manual accounts: you set and update the balance, and it flows into the same net-worth and dashboard views as connected accounts, so nothing is missing from the picture.",
      },
      {
        title: "Unsupported accounts",
        body: "If an account is not available through Akahu, YouInc shows it as unsupported rather than pretending bank sync covers everything. The practical options are to track it as a manual account, or to discuss a scoped custom integration if there is a reliable source to pull from.",
      },
      {
        title: "Custom integrations",
        body: "When there is an export, API, or dependable spreadsheet behind an account, a scoped custom integration can map it into balanced journal entries so it lives in the ledger like everything else. Custom integrations are Concierge work, agreed in writing before they begin.",
      },
      {
        title: "Integration principles",
        items: [
          "Prefer read-only access wherever possible.",
          "Post imported data into a balanced ledger rather than leaving disconnected rows.",
          "Make unsupported accounts visible instead of hiding the gaps.",
          "Keep export paths open so the ledger can outlive YouInc.",
        ],
      },
    ],
    cta: {
      label: "Discuss a custom integration",
      href: BOOKING_URL,
      external: true,
    },
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
        body: "No public incidents have been posted yet. Future material incidents should list date, affected systems, user impact, resolution, and follow-up actions.",
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
    description: "A v1 changelog showing how YouInc is changing over time.",
    eyebrow: "Product updates",
    heading: "Changelog",
    subheading:
      "A public record that YouInc is maintained. Keep this factual, dated, and tied to user-visible changes.",
    sections: [
      {
        title: "5 July 2026",
        items: [
          "Opened self-service signup: create an account and your own workspace directly, with a short guided onboarding — the old waitlist is gone from the self-serve path.",
          "Your workspace now shows a live net-worth, assets, and liabilities summary, with a built-in editor to add, update, and remove accounts by hand.",
          "Added live bank sync: connect your bank through Akahu from your workspace and pull transactions into a synced double-entry ledger. Your Akahu token is stored encrypted and never shown again, and disconnecting removes it.",
          "Added a synced double-entry ledger with a 'Load sample transactions' option to see it in action before you connect a bank.",
          "Each workspace is fully isolated: your data is scoped to your own tenant and protected by row-level security.",
          "Added a 'check your email' confirmation step for new signups where email verification is required.",
        ],
      },
      {
        title: "4 July 2026",
        items: [
          "Rewrote the trust surface for clarity: added how sign-in, bank data, and data separation work to the security page, and named the data controls as three separate steps.",
          "Expanded docs with connect-a-bank, add-a-manual-account, and export walkthroughs, and turned help into direct answers to the most common early-access questions.",
          "Clarified integrations to cover Akahu, manual accounts, unsupported accounts, and custom integrations, and added service-provider, rights, and jurisdiction detail to privacy and terms.",
          "Added v1 trust, legal, security, docs, status, and company pages, and expanded footer navigation so users can find data controls before connecting financial accounts.",
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
        body: "Add a short entry whenever a user-visible feature, security posture, pricing detail, onboarding step, integration, or support process changes. Do not use it for internal chores that do not matter to users.",
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
          "Self-service signup and onboarding: create your own workspace and start tracking net worth today.",
          "Live bank sync via Akahu for self-serve workspaces: connect your account and pull transactions into a synced ledger.",
          "Public demo, pricing comparison, widget library, and custom-build explanation.",
          "V1 privacy, terms, security, data controls, docs, and support pages.",
        ],
      },
      {
        title: "Next",
        items: [
          "Scheduled/background bank sync so balances stay current without manual refreshes.",
          "Grow the workspace into the full widget dashboard once more report views are ported.",
          "Per-tenant classification rules editing so you can re-route transactions.",
          "Clearer onboarding docs for Akahu connection, manual accounts, exports, and customization.",
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
        body: "YouInc turns connected accounts into a live double-entry ledger, then renders the numbers through dashboard widgets for net worth, cashflow, runway, income, expenses, and exceptions worth attention.",
      },
      {
        title: "Why founder-led",
        body: "The product is still early, and finance workflows are personal. Founder-led support means onboarding and custom work can stay close to real user problems while the core product matures.",
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
        body: "YouInc is designed around New Zealand open banking through Akahu first. The product may expand over time, but the initial trust model and integration surface are intentionally focused.",
      },
    ],
    cta: {
      label: "Book a founder-led intro",
      href: BOOKING_URL,
      external: true,
    },
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
        body: "Budgeting apps usually focus on envelopes, habit tracking, and spending limits. YouInc focuses on a double-entry view of what you own, owe, earn, and spend, then reports on net worth, runway, cashflow, and exceptions.",
      },
      {
        title: "Versus spreadsheets",
        body: "Spreadsheets are flexible, but they are easy to break and hard to keep synced. YouInc aims to keep the source data connected, the ledger balanced, and the dashboard reusable.",
      },
      {
        title: "Versus accounting software",
        body: "Small-business accounting tools are powerful, but often shaped around invoices, tax workflows, payroll, and business compliance. YouInc borrows the ledger discipline without forcing your personal finances into a business-operations product.",
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
        body: "See net worth, liquidity, runway, income, expenses, debt, and exceptions in one place instead of hopping between accounts and spreadsheets.",
      },
      {
        title: "Manual asset tracking",
        body: "Track assets and liabilities that bank feeds cannot see, such as property, KiwiSaver, vehicles, private investments, or loans, then bring them into the same dashboard.",
      },
      {
        title: "Custom decision views",
        body: "Concierge work can create a view around a specific decision, such as taking time off, paying down debt, tracking a savings target, or understanding project-level income.",
      },
      {
        title: "Ledger export and review",
        body: "Export the underlying journal so you can inspect, archive, or process your financial history outside YouInc.",
      },
    ],
    cta: { label: "Explore custom builds", href: "/custom-builds" },
  },
};

export function pageData(id: StaticPageId): StaticPageData {
  return STATIC_PAGES[id];
}
