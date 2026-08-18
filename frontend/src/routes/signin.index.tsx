import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import { AuthStepper } from "~/components/auth/AuthStepper";
import {
  checkAuthed,
  initSigninFlow,
  checkEmailForPasskey,
  finishAuthentication,
} from "~/lib/authServerFns";
import { isValidEmail } from "~/server/authFlowSteps";
import { clearAuthCache } from "~/lib/authCache";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";

const SIGNIN_DESCRIPTION = "Sign in to your YouInc workspace and dashboard.";

const SIGNIN_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "WebPage",
      name: "Sign in to YouInc",
      description: SIGNIN_DESCRIPTION,
      url: `${SITE_URL}/signin`,
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Sign in", path: "/signin" },
    ]),
  ]),
);

export const Route = createFileRoute("/signin/")({
  head: () => ({
    meta: [
      { title: "Sign in — YouInc" },
      { name: "description", content: SIGNIN_DESCRIPTION },
    ],
    scripts: [SIGNIN_JSON_LD],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { notice?: "expired" } =>
    search.notice === "expired" ? { notice: "expired" } : {},
  // The loader intentionally does NOT create the flow: it stays offline-safe
  // (only the no-network getUser check runs). The flow + passkey autofill are a
  // progressive enhancement set up on mount; plain password sign-in still works
  // if the flow service is unreachable.
  loader: async () => {
    const { authenticated } = await checkAuthed();
    if (authenticated) throw redirect({ to: "/onboarding" });
  },
  component: SigninEmailPage,
});

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong — please try again.";
}

function SigninEmailPage() {
  const { notice } = Route.useSearch();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flowRef = useRef<{
    token: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  } | null>(null);
  const started = useRef(false);

  // On mount: create a signin flow and fire a passive conditional-mediation
  // request. If the user picks a saved passkey from the autofill popover, verify
  // and skip straight to a session. Any failure (flow service down, no passkey,
  // dismissed popover) is a silent no-op — the email/password path still works.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      let flow: {
        token: string;
        options: PublicKeyCredentialRequestOptionsJSON;
      };
      try {
        flow = await initSigninFlow();
      } catch {
        return; // flow service unreachable — degrade to password-only.
      }
      if (cancelled) return;
      flowRef.current = flow;
      const {
        browserSupportsWebAuthnAutofill,
        runConditionalAuthentication,
      } = await import("~/lib/passkeyBrowser");
      if (!(await browserSupportsWebAuthnAutofill())) return;
      try {
        const response = await runConditionalAuthentication(flow.options);
        if (cancelled) return;
        await finishAuthentication({ data: { token: flow.token, response } });
        clearAuthCache();
        await router.navigate({ to: "/onboarding" });
      } catch {
        // Popover dismissed or no passkey chosen — ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);

    const flow = flowRef.current;
    if (flow) {
      // Full flow: record whether this email has a passkey, then step forward.
      try {
        await checkEmailForPasskey({
          data: { token: flow.token, email: cleanEmail },
        });
        await router.navigate({
          to: "/signin/password",
          search: { flow: flow.token },
        });
        return;
      } catch {
        // fall through to the degraded (password-only) path below.
      }
    }

    // Degraded path: no flow available — go straight to password entry with the
    // email carried in the URL (plain email+password sign-in, no passkey).
    await router.navigate({
      to: "/signin/password",
      search: { email: cleanEmail },
    });
  }

  return (
    <AuthShell>
      <section className="auth-card" aria-labelledby="signin-heading">
        <AuthStepper index={0} count={2} />
        <p className="auth-eyebrow">Welcome back</p>
        <h1 id="signin-heading">Sign in</h1>
        <p className="auth-lede">Access your workspace and dashboard.</p>

        {notice === "expired" ? (
          <p className="auth-notice" role="alert">
            That link expired — let's start again.
          </p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username webauthn"
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

        <AuthCardFooter
          prompt={
            <>
              New here? <Link to="/signup">Create an account</Link>
            </>
          }
        />
      </section>
    </AuthShell>
  );
}
