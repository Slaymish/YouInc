import type { ReactNode } from "react";
import "./faq.css";

interface FaqItem {
  readonly q: string;
  readonly a: ReactNode;
}

const FAQS: readonly FaqItem[] = [
  {
    q: "Is my bank data safe?",
    a: (
      <>
        The connection is read-only and runs through{" "}
        <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
          Akahu
        </a>
        , New Zealand's regulated open-finance hub. YouInc never sees your bank
        login, you pick which accounts to share, and you can revoke access
        whenever you want.
      </>
    ),
  },
  {
    q: "Where does my data live?",
    a: "In your own Postgres, on infrastructure you control. There is no hosted YouInc account, so nothing is pooled or sold. Export the ledger any time as plain-text journals that hledger reads, and your history still opens if you stop using YouInc.",
  },
  {
    q: "Can I try it before connecting a bank?",
    a: "Yes. The demo runs on sample data through the same dashboard, widgets and layout controls as a real account.",
  },
  {
    q: "Does it only work with NZ banks?",
    a: "Live sync does, because it goes through Akahu. Anything Akahu cannot reach you add as a manual account and keep current by hand; those sit alongside synced accounts everywhere in the dashboard.",
  },
  {
    q: "How is this different from a budgeting app?",
    a: "Budgeting apps help you plan envelopes and stick to them. YouInc keeps a double-entry ledger of what you own, owe, earn and spend, then reports on it the way a CFO would: net worth, runway, burn, and the exceptions.",
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
