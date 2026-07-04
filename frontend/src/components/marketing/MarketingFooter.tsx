// frontend/src/components/marketing/MarketingFooter.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT, BOOKING_URL } from "./config";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <span>{PRODUCT.name}</span>
      <span className="mk-footer__note">Run yourself like a company.</span>
      <nav className="mk-footer__links" aria-label="Footer navigation">
        <Link to="/custom-builds">Custom builds</Link>
        <span aria-hidden="true">·</span>
        <Link to="/widgets">Widget library</Link>
        <span aria-hidden="true">·</span>
        <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
          Book a call
        </a>
      </nav>
      <a
        className="mk-footer__credit"
        href="https://hamishburke.dev"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/HB_logo.svg" alt="" width="16" height="16" aria-hidden="true" />
        Built by Hamish Burke
      </a>
    </footer>
  );
}
