import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "~/components/Logo";
import { PersonIcon } from "~/components/dashboard/icons";
import { SideNav, TabBar } from "./SideNav";
import { EVERYDAY_NAV, SECONDARY_NAV, type AppNavItem } from "./nav";
import "~/styles/app-shell.css";

interface AppShellProps {
  /** Sits under the wordmark: the workspace name, or what this copy is. */
  readonly subtitle: string;
  /** Where "home" is — differs between a real instance and the demo. */
  readonly homeTo: string;
  readonly everyday?: readonly AppNavItem[];
  readonly secondary?: readonly AppNavItem[];
  /**
   * The block at the bottom of the side nav, repeated in the phone's account
   * sheet: the signed-in account on a real instance, an install prompt on the
   * demo. When null, and with no secondary nav, the phone has no sheet at all.
   */
  readonly foot?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The application shell: a fixed side nav on the desktop, a compact top bar
 * plus a bottom tab bar on a phone. Content scrolls independently of the nav,
 * so the way out of a page is always on screen.
 *
 * The same shell renders the signed-out demo, which is the point — what people
 * try on the website is the application, not a mock-up of it.
 */
export function AppShell({
  subtitle,
  homeTo,
  everyday = EVERYDAY_NAV,
  secondary = SECONDARY_NAV,
  foot = null,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const hasSheet = secondary.length > 0 || foot !== null;

  // Lock body scroll and trap focus while the account sheet is open — the same
  // pattern the site header uses for its mobile overlay.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
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
    <div className="mk ws-ledger-shell app-shell">
      <a className="app-skip" href="#app-main">
        Skip to content
      </a>

      <aside className="app-sidebar">
        <Link className="app-sidebar__brand" to={homeTo} aria-label="YouInc home">
          <Logo variant="inverted" height={22} />
        </Link>
        <p className="app-sidebar__tenant">{subtitle}</p>

        <SideNav everyday={everyday} secondary={secondary} />

        {foot ? <div className="app-sidebar__foot">{foot}</div> : null}
      </aside>

      <header className="app-topbar">
        <Link className="app-topbar__brand" to={homeTo} aria-label="YouInc home">
          <Logo variant="inverted" height={20} />
        </Link>
        {hasSheet ? (
          <button
            ref={toggleRef}
            className="app-topbar__you"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="app-account-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <PersonIcon size={18} />
            <span>More</span>
          </button>
        ) : null}
      </header>

      <main id="app-main" className="app-main">
        {children}
      </main>

      <TabBar items={everyday} />

      {menuOpen ? (
        <div
          className="app-sheet"
          id="app-account-menu"
          role="dialog"
          aria-modal="true"
          aria-label="More"
        >
          <div className="app-sheet__panel" ref={panelRef}>
            {secondary.length > 0 ? (
              <nav className="app-sheet__nav" aria-label="More">
                {secondary.map((item) => (
                  <Link
                    key={item.to}
                    className="app-sheet__link"
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.Icon />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            ) : null}
            {foot ? <div className="app-sheet__actions">{foot}</div> : null}
            <button
              className="app-sheet__close"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                toggleRef.current?.focus();
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
