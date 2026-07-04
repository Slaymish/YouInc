// frontend/src/components/marketing/MarketingHeader.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT } from "./config";

/**
 * Shared marketing nav for the landing page, /custom-builds, and /widgets.
 * "Pricing" is a router Link with a hash so it scrolls to the landing page's
 * pricing section even when navigating from a subpage.
 */
export function MarketingHeader() {
  return (
    <header className="mk-nav">
      <Link className="mk-nav__logo" to="/">
        {PRODUCT.name}
      </Link>
      <nav className="mk-nav__links" aria-label="Main navigation">
        <Link to="/widgets">Widgets</Link>
        <Link to="/" hash="pricing-heading">
          Pricing
        </Link>
        <Link to="/custom-builds">Custom builds</Link>
        <Link className="mk-nav__signin" to="/login">
          Sign in
        </Link>
      </nav>
    </header>
  );
}
