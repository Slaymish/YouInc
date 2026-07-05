// frontend/src/components/marketing/MarketingFooter.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT, BOOKING_URL, DEFAULT_EMAIL } from "./config";
import { Logo } from "../Logo";
import "./MarketingFooter.css";

/**
 * Social/connect row. Icons are inlined (not <img>) so `fill="currentColor"`
 * resolves against the anchor's CSS color for hover/focus states — an <img>
 * would sandbox the SVG in its own document and currentColor would resolve
 * to black regardless of hover. Only Email is listed for now; add X / LinkedIn
 * / GitHub entries back here once those accounts actually exist (don't ship
 * dead links to unclaimed handles).
 */
const SOCIAL_LINKS = [
  {
    name: "Email",
    href: `mailto:${DEFAULT_EMAIL}`,
    label: "Email YouInc",
    path: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  },
] as const;

const YEAR = new Date().getFullYear();

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-footer__grid">
        <div className="mk-footer__brand">
          <span className="mk-footer__logo">
            <Logo height={26} />
          </span>
          <p className="mk-footer__tagline">{PRODUCT.heroHeadline}</p>
          <ul className="mk-footer__social" aria-label="Connect with YouInc">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.name}>
                <a
                  className="mk-footer__social-link"
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    aria-hidden="true"
                  >
                    <path fill="currentColor" d={social.path} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav className="mk-footer__col" aria-label="Product">
          <h2 className="mk-footer__heading">Product</h2>
          <ul>
            <li>
              <Link to="/demo">Live demo</Link>
            </li>
            <li>
              <Link to="/widgets">Widget library</Link>
            </li>
            <li>
              <Link to="/pricing">Pricing</Link>
            </li>
            <li>
              <Link to="/custom-builds">Custom builds</Link>
            </li>
            <li>
              <Link to="/integrations">Integrations</Link>
            </li>
          </ul>
        </nav>

        <nav className="mk-footer__col" aria-label="Resources">
          <h2 className="mk-footer__heading">Resources</h2>
          <ul>
            <li>
              <Link to="/docs">Docs</Link>
            </li>
            <li>
              <Link to="/help">Help</Link>
            </li>
            <li>
              <Link to="/changelog">Changelog</Link>
            </li>
            <li>
              <Link to="/roadmap">Roadmap</Link>
            </li>
            <li>
              <Link to="/compare">Compare</Link>
            </li>
          </ul>
        </nav>

        <nav className="mk-footer__col" aria-label="Trust">
          <h2 className="mk-footer__heading">Trust</h2>
          <ul>
            <li>
              <Link to="/security">Security</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy</Link>
            </li>
            <li>
              <Link to="/terms">Terms</Link>
            </li>
            <li>
              <Link to="/data-deletion">Data deletion</Link>
            </li>
            <li>
              <Link to="/status">Status</Link>
            </li>
          </ul>
        </nav>

        <nav className="mk-footer__col" aria-label="Company">
          <h2 className="mk-footer__heading">Company</h2>
          <ul>
            <li>
              <Link to="/about">About</Link>
            </li>
            <li>
              <Link to="/use-cases">Use cases</Link>
            </li>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
            <li>
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a call
              </a>
            </li>
            <li>
              <a href={`mailto:${DEFAULT_EMAIL}`}>{DEFAULT_EMAIL}</a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mk-footer__bottom">
        <span className="mk-footer__copyright">
          &copy; {YEAR} {PRODUCT.name}
        </span>
        <span className="mk-footer__credit">
          Founder-led. Built and operated in New Zealand.
        </span>
      </div>
    </footer>
  );
}
