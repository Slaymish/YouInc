import { Link } from "@tanstack/react-router";
import { PRODUCT, SELF_HOST_URL } from "../config";
import { HERO } from "./filmCopy";
import "./act01-hero.css";

// Ambient ledger sprites drifting over the particle field — the chaos of raw
// transactions. Positioned as a scattered constellation; purely atmospheric.
const SPRITES = [
  { text: "-4.50 COFFEE", top: "22%", left: "12%", tone: "neg" },
  { text: "+2,847.00 SALARY", top: "34%", left: "70%", tone: "pos" },
  { text: "-220.00 POWER", top: "62%", left: "18%", tone: "neg" },
  { text: "-86.20 GROCERIES", top: "72%", left: "64%", tone: "neg" },
  { text: "+96.00 INTEREST", top: "15%", left: "48%", tone: "pos" },
  { text: "-14.99 SPOTIFY", top: "80%", left: "40%", tone: "neg" },
] as const;

export function Act01Hero() {
  return (
    <section className="act-hero hero" aria-labelledby="hero-heading">
      <div className="mk-backdrop act-hero__backdrop" aria-hidden="true">
        <div className="act-hero__sprites">
          {SPRITES.map((s, i) => (
            <span
              key={s.text}
              className={`act-hero__sprite act-hero__sprite--${s.tone}`}
              style={{ top: s.top, left: s.left, "--d": i } as React.CSSProperties}
            >
              {s.text}
            </span>
          ))}
        </div>
      </div>

      <div className="act-hero__content">
        <p className="mk-eyebrow act-hero__eyebrow">
          <span className="mk-eyebrow__index">{HERO.eyebrow.index}</span>
          <span className="mk-eyebrow__sep" aria-hidden="true">
            /
          </span>
          <span className="mk-eyebrow__label">{HERO.eyebrow.label}</span>
        </p>

        <h1 id="hero-heading" className="act-hero__headline mk-display">
          <span className="act-hero__line">
            <span className="act-hero__line-inner">Run yourself</span>
          </span>
          <span className="act-hero__line">
            <span className="act-hero__line-inner">
              like a <em>company.</em>
            </span>
          </span>
        </h1>

        <p className="act-hero__sub">{PRODUCT.heroSub}</p>

        <div className="act-hero__ctas">
          <Link className="mk-btn mk-btn--primary" to="/demo">
            <span className="mk-btn__label">Open the demo</span>
          </Link>
          <a
            className="mk-btn mk-btn--ghost"
            href={SELF_HOST_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mk-btn__label">Run it yourself</span>
          </a>
        </div>

        <p className="act-hero__reassurance">{HERO.reassurance}</p>
      </div>

      <div className="act-hero__cue" aria-hidden="true">
        <span>SCROLL</span>
        <span className="act-hero__cue-line" />
      </div>
    </section>
  );
}
