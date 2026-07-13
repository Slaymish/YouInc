import type { ReactNode } from "react";
import "./faq.css";

interface FaqItem {
  readonly q: string;
  readonly a: ReactNode;
}

const FAQS: readonly FaqItem[] = [
  {
    q: "Is my bank data safe?",
    a: "Connections are read-only and made through Akahu, New Zealand's regulated open-banking provider. YouInc never sees or stores your bank login, you choose which accounts are shared, and you can revoke access anytime.",
  },
  {
    q: "Where is my data stored?",
    a: "Your ledger lives in an isolated per-account store — nothing is pooled between users, sold, or used for advertising. You can export the complete ledger anytime as plain-text accounting journals, so your history stays readable without YouInc.",
  },
  {
    q: "What is Akahu?",
    a: (
      <>
        <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
          Akahu
        </a>{" "}
        is New Zealand's open-finance hub — it's the secure bridge that lets apps
        read your transactions with your consent, without handing over passwords.
      </>
    ),
  },
  {
    q: "Can I try it before connecting my bank?",
    a: "Yes. The live demo uses sample data but the same dashboard shell, widget system, and layout controls as a connected account.",
  },
  {
    q: "Is this only for New Zealand accounts?",
    a: "Live bank sync currently depends on Akahu, so YouInc is built around New Zealand-connected accounts. Anything Akahu cannot see can still be added manually or through a custom integration.",
  },
  {
    q: "What if my account isn't with a bank Akahu supports?",
    a: "You can add it as a manual account and keep its balance current by hand — it shows up alongside your live-synced accounts throughout the dashboard.",
  },
  {
    q: "How is this different from PocketSmith or a budgeting app?",
    a: "Budgeting apps help you plan envelopes and track habits. YouInc keeps a double-entry ledger of what you own, owe, earn, and spend, then reports on it like a CFO: net worth, runway, burn, cashflow, and the exceptions worth your attention.",
  },
  {
    q: "Can I get a widget that doesn't exist yet?",
    a: "Yes — that's Concierge. Book a call and tell me what you need: a custom widget, an integration, or an AI agent built around your ledger.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep your data. Export the full double-entry journal as plain text before you go — it works with open tools like hledger, so nothing about your history is locked in.",
  },
];

export function Faq() {
  return (
    <section className="act-faq" aria-labelledby="faq-heading">
      <div className="act-faq__inner">
        <header className="act-faq__head">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">Q</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">Frequently asked</span>
          </p>
          <h2 id="faq-heading" className="act-faq__headline mk-display">
            Questions
          </h2>
        </header>

        <div className="act-faq__list">
          {FAQS.map((f, i) => (
            <details className="act-faq__item" key={f.q} open={i === 0}>
              <summary className="act-faq__q">
                <span className="act-faq__index">{`Q.${String(i + 1).padStart(2, "0")}`}</span>
                <span className="act-faq__q-text">{f.q}</span>
                <span className="act-faq__icon" aria-hidden="true" />
              </summary>
              <div className="act-faq__a">
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
