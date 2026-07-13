import { Link } from "@tanstack/react-router";
import { PRICING, BOOKING_URL } from "../config";
import "./act06-pricing.css";

// The four tiers as ruled ledger entries — shared by the landing film's Act VI
// and the /pricing page. Content comes from PRICING in config.ts verbatim
// (pinned price strings included); self-serve is the emphasized entry.

type Tier = (typeof PRICING)[keyof typeof PRICING];

interface TierRow {
  readonly key: string;
  readonly tier: Tier;
  readonly featured?: boolean;
  readonly cta:
    | { readonly kind: "link"; readonly to: string }
    | { readonly kind: "external"; readonly href: string };
}

// Ordered to anchor high: Concierge (from $149) first, then the emphasized
// Self-serve, then Free. Demo is no longer a plan — it's an inline "see a live
// demo" link on the pricing page, not a ledger row.
const ROWS: readonly TierRow[] = [
  {
    key: "concierge",
    tier: PRICING.concierge,
    cta: { kind: "external", href: BOOKING_URL },
  },
  {
    key: "selfServe",
    tier: PRICING.selfServe,
    featured: true,
    cta: { kind: "link", to: "/start" },
  },
  { key: "free", tier: PRICING.free, cta: { kind: "link", to: "/start" } },
];

function hasCadence(tier: Tier): tier is Tier & { cadence: string } {
  return "cadence" in tier;
}

export function PricingLedger() {
  return (
    <div className="act-pricing__ledger">
      {ROWS.map(({ key, tier, featured, cta }) => (
        <article
          className={`act-pricing__row${featured ? " act-pricing__row--featured" : ""}`}
          key={key}
        >
          {featured ? <span className="act-pricing__flag">MOST POPULAR</span> : null}
          <div className="act-pricing__name">
            <h3>{tier.name}</h3>
          </div>
          <div className="act-pricing__price">
            <span className="act-pricing__amount">{tier.price}</span>
            {hasCadence(tier) ? (
              <span className="act-pricing__cadence">{tier.cadence}</span>
            ) : null}
          </div>
          <ul className="act-pricing__features">
            {tier.features.map((f) => (
              <li key={f}>
                <span className="act-pricing__tick" aria-hidden="true">
                  +
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div className="act-pricing__action">
            {cta.kind === "link" ? (
              <Link
                className={`mk-btn ${featured ? "mk-btn--primary" : "mk-btn--ghost"}`}
                to={cta.to}
              >
                <span className="mk-btn__label">{tier.cta}</span>
              </Link>
            ) : (
              <a
                className="mk-btn mk-btn--ghost"
                href={cta.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="mk-btn__label">{tier.cta}</span>
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
