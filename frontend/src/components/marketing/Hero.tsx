import { PRODUCT } from "./config";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  const headlineWords = PRODUCT.heroHeadline.split(" ");
  const headlineLead = headlineWords.slice(0, -1).join(" ");
  const headlineLastWord = headlineWords[headlineWords.length - 1];

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__copy">
        <p className="hero__eyebrow">{PRODUCT.heroEyebrow}</p>
        <h1 id="hero-heading" className="hero__headline">
          {headlineLead} <em>{headlineLastWord}</em>
        </h1>
        <p className="hero__sub">{PRODUCT.heroSub}</p>
        <div className="hero__ctas">
          <WaitlistForm source="hero" />
          <a className="mk-btn mk-btn--ghost" href="/demo">
            Try the free demo →
          </a>
        </div>
      </div>
      <div className="hero__cards" aria-hidden="true">
        <div className="fw fw--1">
          <span className="live-tag"><span className="live-dot" />LIVE</span>
          <span className="fw__lab">Net worth</span>
          <span className="fw__big">$142,380</span>
          <span className="fw__up">▲ 4.2% this month</span>
        </div>
        <div className="fw fw--2">
          <span className="fw__lab">Runway</span>
          <span className="fw__big">18 mo</span>
          <svg className="fw__spark" viewBox="0 0 100 20" preserveAspectRatio="none">
            <polyline points="0,16 20,14 40,15 60,9 80,7 100,4" fill="none" stroke="#12a150" strokeWidth="2" />
          </svg>
        </div>
        <div className="fw fw--3">
          <span className="fw__lab">Cashflow</span>
          <span className="fw__big">+$3,240</span>
        </div>
        <div className="fw fw--4">
          <span className="fw__lab">Top expense</span>
          <span className="fw__big">$1,204</span>
          <span className="fw__down">Rent · 27%</span>
        </div>
      </div>
    </section>
  );
}
