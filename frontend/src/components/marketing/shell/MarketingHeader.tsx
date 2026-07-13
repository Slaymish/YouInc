import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "../../Logo";
import "./marketing-header.css";

interface NavItem {
  readonly to: string;
  readonly label: string;
}

// Mono index numbers per item drive the mobile overlay's staggered reveal.
const NAV_ITEMS: readonly NavItem[] = [
  { to: "/widgets", label: "Product" },
  { to: "/pricing", label: "Pricing" },
  { to: "/demo", label: "Demo" },
  { to: "/custom-builds", label: "Custom builds" },
];

const SCROLL_THRESHOLD = 24;

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Solidify the header after a small scroll threshold. Passive listener; the
  // class swap is a state change, not an animation, so reduced-motion is fine.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll + trap focus while the mobile overlay is open.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className={`mk-header${scrolled ? " mk-header--solid" : ""}`}>
      <div className="mk-header__bar">
        <Link className="mk-header__logo" to="/" aria-label="YouInc home">
          <Logo variant="inverted" height={22} />
        </Link>

        <nav className="mk-header__nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} className="mk-header__link" to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mk-header__actions">
          <Link className="mk-header__signin" to="/signin">
            Sign in
          </Link>
          <Link className="mk-btn mk-btn--primary mk-header__cta" to="/signup">
            <span className="mk-btn__label">Start free</span>
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="mk-header__burger"
          aria-expanded={menuOpen}
          aria-controls="mk-mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`mk-header__burger-icon${menuOpen ? " is-open" : ""}`}>
            <span />
            <span />
          </span>
        </button>
      </div>

      {menuOpen ? (
        <div
          className="mk-mobile"
          id="mk-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="mk-mobile__panel" ref={panelRef}>
            <nav className="mk-mobile__nav" aria-label="Mobile navigation">
              {NAV_ITEMS.map((item, i) => (
                <Link
                  key={item.to}
                  className="mk-mobile__link"
                  to={item.to}
                  style={{ "--i": i } as React.CSSProperties}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="mk-mobile__index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="mk-mobile__actions">
              <Link
                className="mk-btn mk-btn--ghost"
                to="/signin"
                onClick={() => setMenuOpen(false)}
              >
                <span className="mk-btn__label">Sign in</span>
              </Link>
              <Link
                className="mk-btn mk-btn--primary"
                to="/signup"
                onClick={() => setMenuOpen(false)}
              >
                <span className="mk-btn__label">Start free</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
