import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import { AuthStepper } from "~/components/auth/AuthStepper";
import { useResendVerification } from "~/hooks/useResendVerification";
import { checkAuthed, loadFlow, signupWithPassword } from "~/lib/authServerFns";

export const Route = createFileRoute("/signup/password")({
  head: () => ({ meta: [{ title: "Choose a password — YouInc" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    flow: typeof search.flow === "string" ? search.flow : "",
  }),
  loaderDeps: ({ search }) => ({ flow: search.flow }),
  loader: async ({ deps }) => {
    const { authenticated } = await checkAuthed();
    if (authenticated) throw redirect({ to: "/onboarding" });
    if (!deps.flow) {
      throw redirect({ to: "/signup", search: { notice: "expired" } });
    }
    const flow = await loadFlow({ data: deps.flow });
    if (!flow || flow.kind !== "signup") {
      throw redirect({ to: "/signup", search: { notice: "expired" } });
    }
    return { flow };
  },
  component: SignupPasswordPage,
});

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong — please try again.";
}

function SignupPasswordPage() {
  const { flow } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const resend = useResendVerification();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const honeypot = String(form.get("company") ?? "");

    // Honeypot: bots fill it, humans never see it. Pretend success, do nothing.
    if (honeypot.trim().length > 0) {
      await router.navigate({ to: "/onboarding" });
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { hasSession } = await signupWithPassword({
        data: { token: flow.token, password },
      });
      if (hasSession) {
        await router.navigate({ to: "/onboarding" });
      } else {
        setPendingEmail(flow.email);
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <AuthShell>
        <section className="auth-card" aria-labelledby="confirm-heading">
          <p className="auth-eyebrow">Almost there</p>
          <h1 id="confirm-heading">Check your email</h1>
          <p className="auth-lede">
            We sent a confirmation link to <strong>{pendingEmail}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <Link
            className="auth-primary"
            to="/signin"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            Go to sign in →
          </Link>
          <p className="auth-note">
            Didn't get it? Check spam, or{" "}
            <button
              type="button"
              className="auth-linkbtn"
              onClick={() => resend.resend(pendingEmail)}
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

  return (
    <AuthShell aside={flow.email ? <>Signing up as {flow.email}</> : null}>
      <section className="auth-card" aria-labelledby="pw-heading">
        <AuthStepper index={2} count={3} />
        <p className="auth-eyebrow">Step 3 of 3</p>
        <h1 id="pw-heading">Choose a password</h1>
        <p className="auth-lede">
          You can add a passkey later for faster, safer sign-in.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Hidden username field so password managers save the password
              against this email (it was entered on an earlier step). */}
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={flow.email ?? ""}
            readOnly
            hidden
          />
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              autoFocus
              required
            />
            <span className="auth-field__hint">At least 8 characters.</span>
          </div>
          {/* Honeypot */}
          <input
            className="visually-hidden"
            style={{ position: "absolute", left: "-9999px" }}
            tabIndex={-1}
            autoComplete="off"
            name="company"
            aria-hidden="true"
          />

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-primary" type="submit" disabled={busy}>
            {busy ? "Creating your account…" : "Create account →"}
          </button>
        </form>

        <Link
          className="auth-back"
          to="/signup/credential"
          search={{ flow: flow.token }}
        >
          ← Back to passkey
        </Link>

        <AuthCardFooter />
      </section>
    </AuthShell>
  );
}
