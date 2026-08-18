import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

interface AuthCardFooterProps {
  /** Optional account-switch prompt, e.g. "New here? Create an account". */
  prompt?: ReactNode;
}

/**
 * Bottom-of-card footer shared by every auth screen: an optional account-switch
 * prompt plus the Help / Privacy / Terms links. Keeping these inside the card,
 * right under the form, puts them where the eye already is — previously they
 * lived in the shell header/footer, far from the action.
 */
export function AuthCardFooter({ prompt }: AuthCardFooterProps) {
  return (
    <div className="auth-card__foot">
      {prompt ? <p className="auth-note">{prompt}</p> : null}
      <nav className="auth-card__legal" aria-label="Reference">
        <Link to="/docs">Docs</Link>
        <Link to="/help">Help</Link>
        <Link to="/privacy">Privacy</Link>
      </nav>
    </div>
  );
}
