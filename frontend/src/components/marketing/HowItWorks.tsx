import "./HowItWorks.css";

const STEPS = [
  {
    n: "01",
    title: "Connect your accounts",
    body: "Securely link your bank accounts through Akahu, New Zealand's open-banking layer. Access is read-only, and you can revoke it anytime.",
    image: "/marketing/step-connect.svg",
    alt: "Illustration of bank accounts linking into one place through Akahu",
  },
  {
    n: "02",
    title: "Sync into a ledger",
    body: "Transactions flow in, get categorized, and post into a double-entry ledger that stays current automatically.",
    image: "/marketing/step-sync.svg",
    alt: "Illustration of transactions syncing and being categorized into a ledger",
  },
  {
    n: "03",
    title: "Read your dashboard",
    body: "Net worth, runway, cashflow, and more — arranged around the decisions you actually make.",
    image: "/marketing/step-read.svg",
    alt: "Illustration of a dashboard showing net worth, runway and cashflow",
  },
];

export function HowItWorks() {
  return (
    <section className="steps" aria-labelledby="how-heading">
      <h2 id="how-heading" className="section-heading">
        How it works
      </h2>
      <ol className="steps__list">
        {STEPS.map((s) => (
          <li className="step" key={s.n}>
            <div className="step__media">
              <img
                className="step__thumb"
                src={s.image}
                alt={s.alt}
                width={640}
                height={400}
                loading="lazy"
              />
            </div>
            <span className="step__n">{s.n}</span>
            <h3 className="step__title">{s.title}</h3>
            <p className="step__body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
