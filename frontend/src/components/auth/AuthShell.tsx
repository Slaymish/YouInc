import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useDarkTheme } from "~/components/marketing/system/useDarkTheme";
import { PRODUCT } from "~/components/marketing/config";
import { Logo } from "~/components/Logo";
import "~/styles/auth.css";

interface AuthShellProps {
  children: ReactNode;
  /** Optional top-right aside (e.g. "Already have an account? Sign in"). */
  aside?: ReactNode;
}

/**
 * Terminal chrome shared by the signup / sign-in / onboarding routes — the
 * same dark canvas and grain as the marketing film, so the marketing→auth
 * transition feels continuous. Styling only: flow logic, passkey ceremonies,
 * and route structure are owned by the routes themselves.
 */
export function AuthShell({ children, aside }: AuthShellProps) {
  useDarkTheme();
  return (
    <div className="auth-shell">
      <div className="auth-grain" aria-hidden="true" />
      <header className="auth-topbar">
        <Link className="auth-topbar__logo" to="/" aria-label="YouInc home">
          <Logo variant="inverted" height={22} />
        </Link>
        {aside ? <div className="auth-topbar__aside">{aside}</div> : null}
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <span className="auth-footer__copyright">
          © {new Date().getFullYear()} {PRODUCT.name}
        </span>
      </footer>
    </div>
  );
}
