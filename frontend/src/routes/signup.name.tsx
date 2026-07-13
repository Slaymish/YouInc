import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import { AuthStepper } from "~/components/auth/AuthStepper";
import { checkAuthed, loadFlow, advanceFlow } from "~/lib/authServerFns";

export const Route = createFileRoute("/signup/name")({
  head: () => ({ meta: [{ title: "Your name | YouInc" }] }),
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
  component: SignupNamePage,
});

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function SignupNamePage() {
  const { flow } = Route.useLoaderData();
  const router = useRouter();
  const [firstName, setFirstName] = useState(flow.firstName ?? "");
  const [lastName, setLastName] = useState(flow.lastName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance() {
    setBusy(true);
    setError(null);
    try {
      await advanceFlow({
        data: {
          token: flow.token,
          nextStep: "credential",
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        },
      });
      await router.navigate({
        to: "/signup/credential",
        search: { flow: flow.token },
      });
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await advance();
  }

  return (
    <AuthShell aside={flow.email ? <>Signing up as {flow.email}</> : null}>
      <section className="auth-card" aria-labelledby="name-heading">
        <AuthStepper index={1} count={3} />
        <p className="auth-eyebrow">Step 2 of 3</p>
        <h1 id="name-heading">What should we call you?</h1>
        <p className="auth-lede">Optional. You can add or change this later.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signup-first">First name</label>
            <input
              id="signup-first"
              name="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-last">Last name</label>
            <input
              id="signup-last"
              name="lastName"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
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

        <button
          type="button"
          className="auth-linkbtn"
          onClick={advance}
          disabled={busy}
        >
          Skip for now
        </button>

        <AuthCardFooter />
      </section>
    </AuthShell>
  );
}
