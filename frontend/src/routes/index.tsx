import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTheme } from "~/hooks/useTheme";
import "~/styles/landing.css";

const checkSession = createServerFn({ method: "GET" }).handler(async () => {
  const { hasValidSession } = await import("~/server/auth");
  return { authenticated: hasValidSession() };
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const { authenticated } = await checkSession();
    if (authenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  useTheme();

  return (
    <main className="landing-shell">
      <section className="landing-card" aria-labelledby="landing-heading">
        <p className="landing-eyebrow">YouInc</p>
        <h1 id="landing-heading">Run yourself like a company.</h1>
        <p className="landing-lede">
          YouInc Ledger is a local-first executive dashboard over a personal double-entry ledger.
          It reads the SQLite books your own machine keeps, so your financial data never leaves
          your control.
        </p>
        <p className="landing-lede">
          Balances, P&amp;L, runway, and ingestion health, all in one control room.
        </p>
        <Link className="landing-primary" to="/login">
          Sign in with passkey
        </Link>
      </section>
    </main>
  );
}
