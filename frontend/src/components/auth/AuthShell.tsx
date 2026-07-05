import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { PRODUCT } from "~/components/marketing/config";
import { Logo } from "~/components/Logo";
import "~/styles/auth.css";

interface AuthShellProps {
  children: ReactNode;
  /** Optional top-right aside (e.g. "Already have an account? Sign in"). */
  aside?: ReactNode;
}

/** Light, minimal chrome shared by the signup / sign-in / onboarding routes. */
export function AuthShell({ children, aside }: AuthShellProps) {
  useLightTheme();
  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <Link className="auth-topbar__logo" to="/" aria-label="YouInc home">
          <Logo height={24} />
        </Link>
        {aside ? <div className="auth-topbar__aside">{aside}</div> : null}
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <nav className="auth-footer__links" aria-label="Legal">
          <Link to="/help">Help</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
        <span className="auth-footer__copyright">
          © {new Date().getFullYear()} {PRODUCT.name}
        </span>
      </footer>
    </div>
  );
}
