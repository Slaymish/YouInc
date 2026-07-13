import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import { useResendVerification } from "~/hooks/useResendVerification";
import { sanitizeOtpDigits } from "~/lib/otpInput";
import { confirmSignupCode } from "~/lib/authServerFns";

interface EmailCodeConfirmProps {
  email: string;
  /** Extra sentence appended to the lede, e.g. "your passkey is already saved." */
  note?: string;
  onVerified: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * "Check your email" screen for signup: the user types the 6-digit code
 * instead of clicking a link, so confirmation works without leaving the tab
 * that started signup (and without a same-device link-click requirement).
 */
export function EmailCodeConfirm({ email, note, onVerified }: EmailCodeConfirmProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resend = useResendVerification();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmSignupCode({ data: { email, token: code } });
      onVerified();
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <section className="auth-card" aria-labelledby="confirm-heading">
        <p className="auth-eyebrow">Almost there</p>
        <h1 id="confirm-heading">Check your email</h1>
        <p className="auth-lede">
          We sent a confirmation email to <strong>{email}</strong>. Select
          Confirm email in that message, or enter the 6-digit code below
          {note ? `. ${note.charAt(0).toUpperCase()}${note.slice(1)}` : ""}.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="confirm-code">Confirmation code</label>
            <input
              id="confirm-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(sanitizeOtpDigits(e.target.value))}
              className="auth-code-input"
              autoFocus
              required
            />
          </div>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-primary" type="submit" disabled={busy}>
            {busy ? "Confirming…" : "Confirm →"}
          </button>
        </form>

        <p className="auth-note">
          Didn't get it? Check spam, or{" "}
          <button
            type="button"
            className="auth-linkbtn"
            onClick={() => resend.resend(email)}
            disabled={resend.disabled}
          >
            {resend.cooldownSeconds > 0
              ? `resend in ${resend.cooldownSeconds}s`
              : resend.status === "sending"
                ? "resending…"
                : "resend the email"}
          </button>
          .
        </p>
        {resend.message ? <p className="auth-note">{resend.message}</p> : null}

        <AuthCardFooter
          prompt={
            <>
              Already confirmed? <Link to="/signin">Sign in</Link>
            </>
          }
        />
      </section>
    </AuthShell>
  );
}
