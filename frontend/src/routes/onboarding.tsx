import {
  createFileRoute,
  redirect,
  Link,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AuthShell } from "~/components/auth/AuthShell";
import { AuthCardFooter } from "~/components/auth/AuthCardFooter";
import type { AccountState, TenantSummary } from "~/server/accounts";
import { clearQuizState, loadQuizState } from "~/components/onboarding/quizStorage";
import { quizToLedger } from "~/components/onboarding/quizToLedger";

// --- Server functions --------------------------------------------------------

const loadAccount = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccountState | null> => {
    const { getAccountState } = await import("~/server/accounts");
    return getAccountState();
  },
);

const createTenantFn = createServerFn({ method: "POST" })
  .validator((name: string) => name)
  .handler(async ({ data: name }): Promise<TenantSummary> => {
    const { createTenant } = await import("~/server/accounts");
    return createTenant(name);
  });

// Replays the anonymous quiz answers (held in the browser) as manual balances
// on the freshly-created tenant. Tenant is derived from the RLS session inside
// upsertWorkspaceBalance — never passed by the caller.
const persistQuizBalancesFn = createServerFn({ method: "POST" })
  .validator((entries: { account: string; balanceCents: number }[]) => entries)
  .handler(async ({ data: entries }): Promise<void> => {
    const { upsertWorkspaceBalance } = await import("~/server/workspaceLedger");
    for (const entry of entries) {
      await upsertWorkspaceBalance(entry);
    }
  });

export const Route = createFileRoute("/onboarding")({
  loader: async () => {
    const account = await loadAccount();
    // Not signed in → send to sign-in (production email-confirm path also lands here).
    if (!account) throw redirect({ to: "/signin" });
    return account;
  },
  component: OnboardingPage,
});

type Step = "welcome" | "workspace" | "connect";

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

function Stepper({ index }: { index: number }) {
  const steps = [0, 1, 2];
  return (
    <div className="onb-steps" aria-hidden="true">
      {steps.map((s) => (
        <span
          key={s}
          className={
            "onb-steps__dot" +
            (s < index
              ? " onb-steps__dot--done"
              : s === index
                ? " onb-steps__dot--active"
                : "")
          }
        />
      ))}
    </div>
  );
}

function OnboardingPage() {
  const account = Route.useLoaderData();

  // If the user already has a workspace, they've finished onboarding. Jump
  // straight to the connect/finish step so they can proceed to the dashboard.
  const [step, setStep] = useState<Step>(
    account.tenant ? "connect" : "welcome",
  );
  const [tenant, setTenant] = useState<TenantSummary | null>(account.tenant);
  const [workspaceName, setWorkspaceName] = useState(
    account.displayName ? `${account.displayName.split(" ")[0]}'s Inc.` : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quiz answers from an anonymous /start session (client-only; read after mount
  // to avoid an SSR/hydration mismatch). If present, skip the generic welcome.
  const [quizEntries, setQuizEntries] = useState<
    { account: string; balanceCents: number }[]
  >([]);

  useEffect(() => {
    const entries = quizToLedger(loadQuizState());
    if (entries.length > 0) {
      setQuizEntries(entries);
      setStep((s) => (s === "welcome" ? "workspace" : s));
    }
  }, []);

  const firstName = account.displayName?.split(" ")[0] ?? null;

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (name.length === 0) {
      setError("Give your workspace a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createTenantFn({ data: name });
      if (quizEntries.length > 0) {
        await persistQuizBalancesFn({ data: quizEntries });
        clearQuizState();
      }
      setTenant(created);
      setStep("connect");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = step === "welcome" ? 0 : step === "workspace" ? 1 : 2;

  return (
    <AuthShell aside={account.email ? <>Signed in as {account.email}</> : null}>
      <section
        className="auth-card auth-card--wide"
        aria-labelledby="onb-heading"
      >
        <Stepper index={stepIndex} />

        {step === "welcome" && (
          <>
            <p className="auth-eyebrow">Welcome</p>
            <h1 id="onb-heading">
              {firstName ? `Welcome, ${firstName}.` : "Welcome to YouInc."}
            </h1>
            <p className="auth-lede">
              You're three quick steps from a live CFO view of your finances.
              Here's what you'll set up:
            </p>
            <ul className="onb-benefits">
              <li>Name your workspace, your personal "You Inc."</li>
              <li>
                Connect your bank securely through Akahu (or add accounts
                manually).
              </li>
              <li>
                Watch your accounts become a live double-entry ledger and
                dashboard.
              </li>
            </ul>
            <div className="onb-actions">
              <button
                className="auth-primary"
                type="button"
                onClick={() => setStep("workspace")}
              >
                Let's go →
              </button>
            </div>
          </>
        )}

        {step === "workspace" && (
          <>
            <p className="auth-eyebrow">Step 1 of 2</p>
            <h1 id="onb-heading">Name your workspace</h1>
            <p className="auth-lede">
              This is the entity your ledger belongs to. Think of it as your
              personal company. You can change it later.
            </p>
            <form className="auth-form" onSubmit={createWorkspace} noValidate>
              <div className="auth-field">
                <label htmlFor="onb-workspace">Workspace name</label>
                <input
                  id="onb-workspace"
                  name="workspace"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="You Inc."
                  autoFocus
                  required
                />
              </div>
              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="onb-actions">
                <button
                  className="auth-secondary"
                  type="button"
                  onClick={() => setStep("welcome")}
                  disabled={busy}
                >
                  ← Back
                </button>
                <button className="auth-primary" type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create workspace →"}
                </button>
              </div>
            </form>
          </>
        )}

        {step === "connect" && (
          <>
            <p className="auth-eyebrow">
              {account.tenant ? "You're set up" : "Step 2 of 2"}
            </p>
            <h1 id="onb-heading">
              {tenant ? `${tenant.name} is ready.` : "Your workspace is ready."}
            </h1>
            <p className="auth-lede">
              Next, connect your accounts so YouInc can build your ledger. You
              can do this now from your workspace, or explore first.
            </p>

            {tenant ? (
              <dl className="onb-summary">
                <dt>Workspace</dt>
                <dd>{tenant.name}</dd>
                <dt>Plan</dt>
                <dd>
                  {tenant.tier === "concierge" ? "Concierge" : "Self-serve"}
                </dd>
              </dl>
            ) : null}

            <ul className="onb-benefits">
              <li>
                Connect a bank via Akahu and choose exactly which accounts to
                share.
              </li>
              <li>No bank in Akahu? Add manual accounts and balances.</li>
              <li>
                Re-classify anything that looks off before you rely on the
                reports.
              </li>
            </ul>

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="onb-actions">
              <button
                className="auth-primary"
                type="button"
                onClick={() => window.location.replace("/workspace")}
              >
                Go to my workspace →
              </button>
            </div>
            <p className="auth-note">
              Want a hand setting it up?{" "}
              <Link to="/custom-builds">Book a concierge build →</Link>
            </p>
          </>
        )}

        <AuthCardFooter />
      </section>
    </AuthShell>
  );
}
