import { Link } from "@tanstack/react-router";
import "./StartFreeCta.css";

interface StartFreeCtaProps {
  /** Where the CTA appears — kept for analytics parity with the old waitlist. */
  source: string;
  /** Show the secondary "Try the free demo" link beside the primary CTA. */
  withDemo?: boolean;
}

/**
 * Primary self-service CTA. Routes to `/start` — the anonymous quiz that builds
 * the visitor's financial picture before any account. `source` is preserved so
 * we can wire per-placement analytics later without touching call sites.
 */
export function StartFreeCta({ source, withDemo = false }: StartFreeCtaProps) {
  return (
    <div className="start-free" data-source={source}>
      <Link className="mk-btn mk-btn--primary" to="/start">
        Start free →
      </Link>
      {withDemo ? (
        <a className="mk-btn mk-btn--ghost" href="/demo">
          Try the free demo →
        </a>
      ) : null}
    </div>
  );
}
