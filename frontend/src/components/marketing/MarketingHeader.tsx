// frontend/src/components/marketing/MarketingHeader.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT } from "./config";

/**
 * Shared marketing nav for the landing page, /pricing, /custom-builds, and
 * /widgets. "Pricing" routes to the dedicated /pricing comparison page; the
 * landing page's teaser section keeps its own `pricing-heading` id for any
 * remaining hash-anchor links into the page.
 */
export function MarketingHeader() {
  return (
    <header className="mk-nav">
      <Link className="mk-nav__logo" to="/">
        {PRODUCT.name}
      </Link>
      <nav className="mk-nav__links" aria-label="Main navigation">
        <Link to="/widgets">Widgets</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/docs">Docs</Link>
        <Link to="/security">Security</Link>
        <Link to="/custom-builds">Custom builds</Link>
        <Link className="mk-nav__signin" to="/signin">
          Sign in
        </Link>
        <Link className="mk-nav__cta" to="/signup">
          Start free
        </Link>
      </nav>
    </header>
  );
}
