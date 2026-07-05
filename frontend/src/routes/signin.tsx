import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { getSupabaseBrowserClient } from "~/lib/supabaseBrowser";

const checkAuthed = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerUser } = await import("~/server/supabaseServer");
  const user = await getServerUser();
  return { authenticated: Boolean(user) };
});

export const Route = createFileRoute("/signin")({
  loader: async () => {
    const { authenticated } = await checkAuthed();
    if (authenticated) throw redirect({ to: "/onboarding" });
  },
  component: SigninPage,
});

function messageFor(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

function SigninPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(messageFor(signInError));
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
    <AuthShell
      aside={
        <>
          New here? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <section className="auth-card" aria-labelledby="signin-heading">
        <p className="auth-eyebrow">Welcome back</p>
        <h1 id="signin-heading">Sign in to YouInc</h1>
        <p className="auth-lede">Access your workspace and dashboard.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <p className="auth-note">
          New here? <Link to="/signup">Create your workspace →</Link>
        </p>
      </section>
    </AuthShell>
  );
}
