import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthStepper } from "~/components/auth/AuthStepper";
import { checkAuthed, startSignupFlow, advanceFlow } from "~/lib/authServerFns";
import { isValidEmail } from "~/server/authFlowSteps";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";

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

export const Route = createFileRoute("/signup/")({
  head: () => ({
    meta: [
      { title: "Create your account — YouInc" },
      { name: "description", content: SIGNUP_DESCRIPTION },
    ],
    scripts: [SIGNUP_JSON_LD],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { notice?: "expired" } =>
    search.notice === "expired" ? { notice: "expired" } : {},
  loader: async () => {
    const { authenticated } = await checkAuthed();
    if (authenticated) throw redirect({ to: "/onboarding" });
  },
  component: SignupEmailPage,
});

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

function SignupEmailPage() {
  const router = useRouter();
  const { notice } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token } = await startSignupFlow({ data: email.trim() });
      // Advance the flow to step 2 ("name") as we leave the email step, so the
      // one-step-at-a-time transition guard lets the name step move on to
      // "credential" (email→credential would otherwise be a rejected 2-step jump).
      await advanceFlow({ data: { token, nextStep: "name" } });
      await router.navigate({ to: "/signup/name", search: { flow: token } });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
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
        <AuthStepper index={0} count={3} />
        <p className="auth-eyebrow">Start free</p>
        <h1 id="signup-heading">Create your account</h1>
        <p className="auth-lede">
          Run yourself like a company. Set up your workspace in a couple of
          minutes — no card required.
        </p>

        {notice === "expired" ? (
          <p className="auth-notice" role="alert">
            That link expired — let's start again.
          </p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {busy ? "Continuing…" : "Continue →"}
          </button>
        </form>

        <p className="auth-note">
          Just looking? <Link to="/demo">Open the live demo →</Link>
        </p>
      </section>
    </AuthShell>
  );
}
