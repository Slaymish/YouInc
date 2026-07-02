const STEPS = [
  { n: "01", title: "Connect your bank", body: "Securely link your accounts through Akahu — New Zealand's open-banking layer. Read-only, revoke anytime." },
  { n: "02", title: "It syncs & categorizes, live", body: "Transactions flow in, get matched to a double-entry ledger, and stay current automatically." },
  { n: "03", title: "Read your dashboard", body: "Net worth, runway, cashflow and more — arranged exactly how you think about money." },
];

export function HowItWorks() {
  return (
    <section className="steps" aria-labelledby="how-heading">
      <h2 id="how-heading" className="section-heading">How it works</h2>
      <ol className="steps__list">
        {STEPS.map((s) => (
          <li className="step" key={s.n}>
            <span className="step__n">{s.n}</span>
            <h3 className="step__title">{s.title}</h3>
            <p className="step__body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
