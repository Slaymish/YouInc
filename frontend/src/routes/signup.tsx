import {
  createFileRoute,
  redirect,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { useResendVerification } from "~/hooks/useResendVerification";
import { getSupabaseBrowserClient } from "~/lib/supabaseBrowser";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";

// If the visitor already has a Supabase session, skip signup: send them to
// onboarding (which itself forwards to the dashboard once a tenant exists).
const checkAuthed = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerUser } = await import("~/server/supabaseServer");
  const user = await getServerUser();
  return { authenticated: Boolean(user) };
});

const SIGNUP_DESCRIPTION =
  "Create your YouInc account and set up your own workspace in a couple of minutes — no card required.";

const SIGNUP_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "WebPage",
      name: "Create your YouInc account",
      description: SIGNUP_DESCRIPTION,
      url: `${SITE_URL}/signup`,
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Sign up", path: "/signup" },
    ]),
  ]),
);

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — YouInc" },
      { name: "description", content: SIGNUP_DESCRIPTION },
    ],
    scripts: [SIGNUP_JSON_LD],
  }),
  loader: async () => {
    const { authenticated } = await checkAuthed();
    if (authenticated) throw redirect({ to: "/onboarding" });
  },
  component: SignupPage,
});

function messageFor(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

function SignupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the project requires email confirmation (production): signUp then
  // returns a user but NO session, so we show a "check your email" screen
  // instead of routing into onboarding (which would bounce to /signin).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const resend = useResendVerification();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const honeypot = String(form.get("company") ?? "");

    // Honeypot: bots fill it, humans never see it. Pretend success, do nothing.
    if (honeypot.trim().length > 0) {
      await router.navigate({ to: "/onboarding" });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: name ? { display_name: name } : undefined },
      });
      if (signUpError) {
        setError(messageFor(signUpError));
        return;
      }
      // Two project modes:
      //  * confirmation OFF (local/dev): signUp returns a live session and the
      //    auth cookie is set — go straight into onboarding.
      //  * confirmation ON (prod): signUp returns a user but no session — show
      //    the "check your email" state; the confirm link brings them back.
      if (data.session) {
        await router.navigate({ to: "/onboarding" });
      } else {
        setPendingEmail(email);
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <AuthShell
        aside={
          <>
            Already confirmed? <Link to="/signin">Sign in</Link>
          </>
        }
      >
        <section className="auth-card" aria-labelledby="confirm-heading">
          <p className="auth-eyebrow">Almost there</p>
          <h1 id="confirm-heading">Check your email</h1>
          <p className="auth-lede">
            We sent a confirmation link to <strong>{pendingEmail}</strong>.
            Click it to activate your account, then sign in to finish setting up
            your workspace.
          </p>
          <Link
            className="auth-primary"
            to="/signin"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            Go to sign in →
          </Link>
          <p className="auth-note">
            Didn't get it? Check spam,{" "}
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
            , or{" "}
            <button
              type="button"
              className="auth-linkbtn"
              onClick={() => setPendingEmail(null)}
            >
              try a different email
            </button>
            .
          </p>
          {resend.message ? <p className="auth-note">{resend.message}</p> : null}
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      aside={
        <>
          Already have an account? <Link to="/signin">Sign in</Link>
        </>
      }
    >
      <section className="auth-card" aria-labelledby="signup-heading">
        <p className="auth-eyebrow">Start free</p>
        <h1 id="signup-heading">Create your YouInc account</h1>
        <p className="auth-lede">
          Run yourself like a company. Set up your workspace in a couple of
          minutes — no card required.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signup-name">Your name (optional)</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
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

        <p className="auth-note">
          Just looking? <Link to="/demo">Open the live demo →</Link>
        </p>
      </section>
    </AuthShell>
  );
}
