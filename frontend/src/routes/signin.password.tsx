import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import { AuthStepper } from "~/components/auth/AuthStepper";
import { useResendVerification } from "~/hooks/useResendVerification";
import { classifyAuthError } from "~/lib/authResend";
import { getSupabaseBrowserClient } from "~/lib/supabaseBrowser";
import {
  checkAuthed,
  loadFlow,
  beginAuthentication,
  finishAuthentication,
} from "~/lib/authServerFns";

export const Route = createFileRoute("/signin/password")({
  head: () => ({ meta: [{ title: "Sign in — YouInc" }] }),
  // `flow` is the full flow-backed path; `email` is the degraded password-only
  // path used when the flow service was unreachable at step 1.
  validateSearch: (
    search: Record<string, unknown>,
  ): { flow?: string; email?: string } => ({
    flow: typeof search.flow === "string" ? search.flow : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  loaderDeps: ({ search }) => ({ flow: search.flow, email: search.email }),
  loader: async ({ deps }) => {
    const { authenticated } = await checkAuthed();
    if (authenticated) throw redirect({ to: "/onboarding" });

    if (deps.flow) {
      const flow = await loadFlow({ data: deps.flow });
      if (!flow || flow.kind !== "signin" || !flow.email) {
        throw redirect({ to: "/signin", search: { notice: "expired" } });
      }
      return {
        token: flow.token,
        email: flow.email,
        hasPasskey: Boolean(flow.hasPasskey),
      };
    }

    // Degraded path: password-only sign-in with the email from the URL.
    if (deps.email) {
      return { token: null, email: deps.email, hasPasskey: false };
    }

    throw redirect({ to: "/signin" });
  },
  component: SigninPasswordPage,
});

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

function SigninPasswordPage() {
  const { token, email, hasPasskey } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // With a passkey, that button is primary; this toggle reveals the password
  // field for "Use password instead".
  const [showPassword, setShowPassword] = useState(!hasPasskey);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const resend = useResendVerification();

  async function continueWithPasskey() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const options = await beginAuthentication({ data: token });
      const { runAuthentication } = await import("~/lib/passkeyBrowser");
      const response = await runAuthentication(options);
      await finishAuthentication({ data: { token, response } });
      await router.navigate({ to: "/onboarding" });
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  async function handlePasswordSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError(null);
    setUnverifiedEmail(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        if (classifyAuthError(signInError) === "unverified") {
          setUnverifiedEmail(email);
        } else {
          setError(messageFor(signInError));
        }
        return;
      }
      await router.navigate({ to: "/onboarding" });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell aside={<>Signing in as {email}</>}>
      <section className="auth-card" aria-labelledby="signin-pw-heading">
        <AuthStepper index={1} count={2} />
        <p className="auth-eyebrow">Welcome back</p>
        <h1 id="signin-pw-heading">
          {hasPasskey && !showPassword
            ? "Use your passkey"
            : "Enter your password"}
        </h1>
        <p className="auth-lede">{email}</p>

        {hasPasskey ? (
          <div className="auth-choices">
            <button
              className="auth-primary"
              type="button"
              onClick={continueWithPasskey}
              disabled={busy}
            >
              {busy ? "Verifying…" : "Continue with passkey"}
            </button>
            {!showPassword ? (
              <button
                type="button"
                className="auth-secondary"
                onClick={() => setShowPassword(true)}
                disabled={busy}
              >
                Use password instead
              </button>
            ) : null}
          </div>
        ) : null}

        {showPassword ? (
          <form
            className="auth-form"
            onSubmit={handlePasswordSubmit}
            noValidate
          >
            {/* Hidden username field so password managers pair the password
                with this email (it was entered on the previous step). */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              hidden
            />
            <div className="auth-field">
              <label htmlFor="signin-password">Password</label>
              <input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>

            {unverifiedEmail ? (
              <div className="auth-notice" role="alert">
                <p>
                  Your email isn't verified yet. Check your inbox for the
                  confirmation link, or resend it below.
                </p>
                <button
                  type="button"
                  className="auth-secondary"
                  onClick={() => resend.resend(unverifiedEmail)}
                  disabled={resend.disabled}
                >
                  {resend.cooldownSeconds > 0
                    ? `Resend available in ${resend.cooldownSeconds}s`
                    : resend.status === "sending"
                      ? "Sending…"
                      : "Resend verification email"}
                </button>
                {resend.message ? (
                  <p className="auth-note">{resend.message}</p>
                ) : null}
              </div>
            ) : error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        ) : error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <Link className="auth-back" to="/signin">
          ← Use a different email
        </Link>

        <AuthCardFooter />
      </section>
    </AuthShell>
  );
}
