// frontend/src/components/marketing/MarketingFooter.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT, BOOKING_URL, DEFAULT_EMAIL } from "./config";
import "./MarketingFooter.css";

/**
 * Social/connect row. Icons are inlined (not <img>) so `fill="currentColor"`
 * resolves against the anchor's CSS color for hover/focus states — an <img>
 * would sandbox the SVG in its own document and currentColor would resolve
 * to black regardless of hover. Hrefs are placeholder company handles on the
 * product's own domain (youinc.app, matching SupportChat's SUPPORT_EMAIL) —
 * swap for the real accounts once they exist.
 */
const SOCIAL_LINKS = [
  {
    name: "X",
    href: "https://x.com/youinc_app",
    label: "YouInc on X",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.6l-5.165-6.75-5.937 6.75H2.423l7.723-8.835L.82 2.25h6.744l4.888 6.469L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/youinc-app",
    label: "YouInc on LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    name: "GitHub",
    href: "https://github.com/youinc-app",
    label: "YouInc on GitHub",
    path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
  },
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
          <span className="mk-footer__logo">{PRODUCT.name}</span>
          <p className="mk-footer__tagline">{PRODUCT.heroHeadline}</p>
          <ul className="mk-footer__social" aria-label="YouInc on social media">
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
