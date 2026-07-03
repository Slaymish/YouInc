// frontend/src/components/marketing/Faq.tsx
const FAQS = [
  { q: "Is my bank data safe?", a: "Connections are read-only and made through Akahu, New Zealand's regulated open-banking provider. YouInc never sees or stores your bank login, you approve exactly which accounts are shared, and you can revoke access at any time from your Akahu account." },
  { q: "Where is my data stored?", a: "Your ledger lives in an isolated per-account store — nothing is pooled between users, and it's never sold or used for advertising. You can export the complete ledger at any time as plain-text accounting journals (hledger-compatible), so your history stays readable without YouInc." },
  {
    q: "What is Akahu?",
    a: (
      <>
        <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
          Akahu
        </a>{" "}
        is New Zealand's open-finance hub — it's the secure bridge that lets apps read your
        transactions with your consent, without handing over passwords.
      </>
    ),
  },
  { q: "What if my account isn't with a bank Akahu supports?", a: "You can still add it as a manual account and keep its balance current by hand — it shows up alongside your live-synced accounts everywhere in the dashboard." },
  { q: "How is this different from PocketSmith or a budgeting app?", a: "Budgeting apps ask you to plan envelopes and track habits. YouInc is a personal ERP: it keeps a strict double-entry ledger of everything you own and owe — the bookkeeping standard businesses are audited against — and reports on it the way a CFO would: net worth, runway, burn, cashflow. If you've outgrown budgeting apps, this is the next step." },
  { q: "Can I get a widget that doesn't exist yet?", a: "Yes — that's the Concierge tier. Book a call and tell me what you need: a custom widget, an integration, or an AI agent that emails you a weekly brief of your finances. I build it, you use it." },
  { q: "What happens if I cancel?", a: "You keep your data. Export the full double-entry journal as plain text before you go — it works with open tools like hledger, so nothing about your history is locked in." },
];

export function Faq() {
  return (
    <section className="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="section-heading">Questions</h2>
      <dl className="faq__list">
        {FAQS.map((f) => (
          <div className="faq__item" key={f.q}>
            <dt className="faq__q">{f.q}</dt>
            <dd className="faq__a">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
