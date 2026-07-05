// Admin-only view of variant-voting feedback stats (see todo.md "IN
// PROGRESS: Variant voting — make it useful"). Single-owner admin page, not
// tenant-facing — deliberately not linked from any nav.
//
// Auth is enforced in two independent layers (see design doc): (1) this
// route's loader requires any signed-in account (mirrors workspace.tsx —
// `getAccountState()` + redirect to /signin when signed out), and (2) the
// `feedback_variant_stats` RPC self-enforces admin-only access via
// `is_app_admin()` in Postgres. A signed-in non-admin therefore gets a clean
// 403 from `getFeedbackVariantStats`, which we catch here and render as a
// friendly "not authorized" state rather than letting it crash the loader.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { formatPercent } from "~/components/widgets/format";
import type { AccountState } from "~/server/accounts";
import type { FeedbackVariantStatsResult } from "~/server/feedbackStats";
import "~/styles/auth.css";
import "~/styles/workspace.css";

type FeedbackStatsOutcome =
  | { status: "ok"; stats: FeedbackVariantStatsResult }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const loadFeedbackStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    account: AccountState | null;
    outcome: FeedbackStatsOutcome | null;
  }> => {
    const { getAccountState } = await import("~/server/accounts");
    const account = await getAccountState();
    if (!account) return { account: null, outcome: null };

    const { getFeedbackVariantStats } = await import("~/server/feedbackStats");
    try {
      const stats = await getFeedbackVariantStats();
      return { account, outcome: { status: "ok", stats } };
    } catch (err) {
      // ServerFnError carries a `.status` set by throwServerError; the RPC's
      // 403 (non-admin) should render as a friendly notice, not a crash.
      const status = (err as { status?: number } | null)?.status;
      if (status === 403) {
        return { account, outcome: { status: "forbidden" } };
      }
      return {
        account,
        outcome: {
          status: "error",
          message: err instanceof Error ? err.message : "Could not load feedback stats.",
        },
      };
    }
  },
);

export const Route = createFileRoute("/admin/feedback")({
  loader: async () => {
    const data = await loadFeedbackStats();
    if (!data.account) throw redirect({ to: "/signin" });
    return data as { account: AccountState; outcome: FeedbackStatsOutcome };
  },
  component: AdminFeedbackPage,
});

function LeaderCallout({ stats }: { stats: FeedbackVariantStatsResult }) {
  const { leader } = stats;
  if (!leader.isSignificant || !leader.leaderVariant) return null;

  return (
    <div className="admin-callout admin-callout--leader" role="status">
      <strong>Variant {leader.leaderVariant} is a statistically significant leader.</strong>
      <p>
        Its up-vote rate is significantly higher than the other variant across
        the sample collected so far (p = {leader.pValue?.toFixed(4) ?? "n/a"}).
        Consider it for the next iteration. Auto-promotion is not implemented —
        assignment is still 100% client-side random; see todo.md for the
        deliberate follow-up to wire a remote-config read into
        FeedbackWidget's variant assignment.
      </p>
    </div>
  );
}

function StatsTable({ stats }: { stats: FeedbackVariantStatsResult }) {
  if (stats.aggregates.length === 0) {
    return <p className="mb-empty">No feedback votes recorded yet.</p>;
  }

  return (
    <div className="mb-table-wrap">
      <table className="mb-table">
        <thead>
          <tr>
            <th>Variant</th>
            <th>Source</th>
            <th>Path</th>
            <th className="mb-numeric">Up</th>
            <th className="mb-numeric">Down</th>
            <th className="mb-numeric">Total</th>
            <th className="mb-numeric">Up rate</th>
          </tr>
        </thead>
        <tbody>
          {stats.aggregates.map((row) => (
            <tr key={`${row.variant}:${row.source}:${row.path}`}>
              <td>
                <span className="mb-tag">{row.variant}</span>
              </td>
              <td>{row.source}</td>
              <td>
                <code className="mb-account">{row.path}</code>
              </td>
              <td className="mb-numeric">{row.upCount}</td>
              <td className="mb-numeric">{row.downCount}</td>
              <td className="mb-numeric">{row.total}</td>
              <td className="mb-numeric">{formatPercent(row.upRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminFeedbackPage() {
  const { account, outcome } = Route.useLoaderData();
  useLightTheme();

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <span className="ws-topbar__logo">Feedback stats</span>
        <div className="ws-topbar__account">
          <span>{account.email}</span>
        </div>
      </header>

      <main className="ws-main">
        <section className="ws-hero">
          <p className="ws-eyebrow">Admin</p>
          <h1>Variant voting results</h1>
          <p className="ws-lede">
            Aggregate up/down vote counts per variant, grouped by feedback
            source and path. Only visible to admins — access is enforced by
            Postgres, not by this page.
          </p>
        </section>

        {outcome.status === "forbidden" ? (
          <section
            className="admin-callout admin-callout--forbidden"
            aria-labelledby="admin-forbidden-heading"
          >
            <h2 id="admin-forbidden-heading">Not authorized</h2>
            <p>You are not authorized to view this page.</p>
          </section>
        ) : null}

        {outcome.status === "error" ? (
          <section
            className="admin-callout admin-callout--error"
            aria-labelledby="admin-error-heading"
          >
            <h2 id="admin-error-heading">Could not load feedback stats</h2>
            <p>{outcome.message}</p>
          </section>
        ) : null}

        {outcome.status === "ok" ? (
          <section className="ws-panel" aria-labelledby="admin-stats-heading">
            <div className="ws-panel__head">
              <h2 id="admin-stats-heading">Results by variant</h2>
            </div>
            <div className="mb-editor">
              <LeaderCallout stats={outcome.stats} />
              <StatsTable stats={outcome.stats} />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
