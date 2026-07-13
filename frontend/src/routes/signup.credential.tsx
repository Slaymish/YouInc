import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import { AuthStepper } from "~/components/auth/AuthStepper";
import { EmailCodeConfirm } from "~/components/auth/EmailCodeConfirm";
import {
  checkAuthed,
  loadFlow,
  beginRegistration,
  finishRegistration,
  signupSetPassword,
} from "~/lib/authServerFns";

export const Route = createFileRoute("/signup/credential")({
  head: () => ({ meta: [{ title: "Secure your account | YouInc" }] }),
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
  component: SignupCredentialPage,
});

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function SignupCredentialPage() {
  const { flow } = Route.useLoaderData();
  const router = useRouter();
  // "choose" = passkey/password choice; "fallback" = inline "set your password"
  // after the passkey ceremony failed (the account already exists at that point).
  const [mode, setMode] = useState<"choose" | "fallback">("choose");
  const [supportsPasskey, setSupportsPasskey] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("~/lib/passkeyBrowser").then(({ browserSupportsWebAuthn }) => {
      if (!cancelled) setSupportsPasskey(browserSupportsWebAuthn());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function routeAfterSignup(hasSession: boolean) {
    if (hasSession) {
      void router.navigate({ to: "/onboarding" });
    } else {
      setPendingEmail(flow.email);
    }
  }

  async function createPasskey() {
    setBusy(true);
    setError(null);
    let accountCreated = false;
    try {
      const { options } = await beginRegistration({ data: flow.token });
      accountCreated = true;
      const { runRegistration } = await import("~/lib/passkeyBrowser");
      const response = await runRegistration(options);
      const { hasSession } = await finishRegistration({
        data: { token: flow.token, response },
      });
      routeAfterSignup(hasSession);
    } catch (err) {
      if (accountCreated) {
        // Ceremony failed/cancelled but the account exists — fall back in place
        // to "set your password" (an update), not a fresh signup.
        setMode("fallback");
        setError(null);
      } else {
        setError(messageFor(err));
      }
      setBusy(false);
    }
  }

  async function submitFallbackPassword(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { hasSession } = await signupSetPassword({
        data: { token: flow.token, password },
      });
      routeAfterSignup(hasSession);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <EmailCodeConfirm
        email={pendingEmail}
        note="your passkey is already saved"
        onVerified={() => void router.navigate({ to: "/onboarding" })}
      />
    );
  }

  return (
    <AuthShell aside={flow.email ? <>Signing up as {flow.email}</> : null}>
      <section className="auth-card" aria-labelledby="cred-heading">
        <AuthStepper index={2} count={3} />

        {mode === "choose" ? (
          <>
            <p className="auth-eyebrow">Step 3 of 3</p>
            <h1 id="cred-heading">Create a passkey</h1>
            <p className="auth-lede">
              Sign in with your fingerprint, face, or device PIN. There is no
              password to remember or leak.
            </p>

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="auth-choices">
              <button
                className="auth-primary"
                type="button"
                onClick={createPasskey}
                disabled={busy || !supportsPasskey}
              >
                {busy ? "Setting up…" : "Create a passkey"}
              </button>
              {!supportsPasskey ? (
                <p className="auth-note">
                  This device doesn't support passkeys.
                </p>
              ) : null}
              <Link
                className="auth-secondary"
                to="/signup/password"
                search={{ flow: flow.token }}
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                Use a password instead
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="auth-eyebrow">Step 3 of 3</p>
            <h1 id="cred-heading">Set a password</h1>
            <p className="auth-lede">
              We couldn't set up a passkey on this device. Choose a password to
              finish instead.
            </p>
            <form
              className="auth-form"
              onSubmit={submitFallbackPassword}
              noValidate
            >
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
                <span className="auth-field__hint">At least 8 characters.</span>
              </div>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button className="auth-primary" type="submit" disabled={busy}>
                {busy ? "Finishing…" : "Finish sign up →"}
              </button>
            </form>
          </>
        )}

        <AuthCardFooter />
      </section>
    </AuthShell>
  );
}
