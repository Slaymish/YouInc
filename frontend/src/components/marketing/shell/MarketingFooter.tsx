import { Link } from "@tanstack/react-router";
import { PRODUCT, SOURCE_URL, SELF_HOST_URL, DEFAULT_EMAIL } from "../config";
import { Logo } from "../../Logo";
import "./marketing-footer.css";

type FooterLink =
  | { readonly to: string; readonly label: string }
  | { readonly href: string; readonly label: string };

interface FooterCol {
  readonly label: string;
  readonly links: ReadonlyArray<FooterLink>;
}

const FOOTER_COLS: readonly FooterCol[] = [
  {
    label: "The project",
    links: [
      { to: "/demo", label: "Demo" },
      { href: SOURCE_URL, label: "Source on GitHub" },
      { href: SELF_HOST_URL, label: "Setup guide" },
    ],
  },
  {
    label: "Reference",
    links: [
      { to: "/docs", label: "Docs" },
      { to: "/help", label: "Common questions" },
      { to: "/privacy", label: "Privacy" },
    ],
  },
  {
    label: "Contact",
    links: [{ href: `mailto:${DEFAULT_EMAIL}`, label: DEFAULT_EMAIL }],
  },
];

const YEAR = new Date().getFullYear();

function isExternal(
  link: FooterLink,
): link is { readonly href: string; readonly label: string } {
  return "href" in link;
}

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-footer__inner">
        <div className="mk-footer__top">
          <div className="mk-footer__brand">
            <Link to="/" aria-label="YouInc home" className="mk-footer__logo">
              <Logo variant="inverted" height={26} />
            </Link>
            <p className="mk-footer__tagline">{PRODUCT.heroHeadline}</p>
          </div>

          <div className="mk-footer__cols">
            {FOOTER_COLS.map((col) => (
              <nav
                key={col.label}
                className="mk-footer__col"
                aria-label={col.label}
              >
                <h2 className="mk-footer__heading">{col.label}</h2>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {isExternal(link) ? (
                        <a
                          href={link.href}
                          target={
                            link.href.startsWith("mailto:") ? undefined : "_blank"
                          }
                          rel={
                            link.href.startsWith("mailto:")
                              ? undefined
                              : "noopener noreferrer"
                          }
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link to={link.to}>{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mk-footer__rule" aria-hidden="true" />

        <div className="mk-footer__bottom">
          <span className="mk-footer__copyright">
            © {YEAR} {PRODUCT.name}
          </span>
          <span className="mk-footer__credit">
            MIT licensed. Built in New Zealand.
          </span>
        </div>
      </div>
    </footer>
  );
}
