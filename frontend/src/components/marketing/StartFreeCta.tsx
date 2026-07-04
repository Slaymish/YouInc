import { Link } from "@tanstack/react-router";
import { PRICING } from "./config";
import "./StartFreeCta.css";

interface StartFreeCtaProps {
  /** Where the CTA appears — kept for analytics parity with the old waitlist. */
  source: string;
  /** Show the secondary "Try the free demo" link beside the primary CTA. */
  withDemo?: boolean;
}

/**
 * Self-service signup CTA. Replaces the old waitlist form now that signup is
 * live: the primary button routes to `/signup`, where a visitor creates an
 * account and runs the onboarding flow. `source` is preserved so we can wire
 * per-placement analytics later without touching call sites.
 */
export function StartFreeCta({ source, withDemo = false }: StartFreeCtaProps) {
  return (
    <div className="start-free" data-source={source}>
      <Link className="mk-btn mk-btn--primary" to="/signup">
        {PRICING.selfServe.cta} →
      </Link>
      {withDemo ? (
        <a className="mk-btn mk-btn--ghost" href="/demo">
          Try the free demo →
        </a>
      ) : null}
    </div>
  );
}
