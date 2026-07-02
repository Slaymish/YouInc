// frontend/src/components/marketing/Faq.tsx
const FAQS = [
  { q: "Is my bank data safe?", a: "Connections are read-only and made through Akahu, New Zealand's regulated open-banking provider. You can revoke access at any time, and YouInc never stores your bank login." },
  { q: "Where is my data stored?", a: "Your ledger is yours. The self-serve tier keeps it in an isolated per-account store; nothing is shared between users." },
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
  { q: "Can I get a widget that doesn't exist yet?", a: "Yes — that's the Concierge tier. Book a call, tell me what you need, and I build it for you." },
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
