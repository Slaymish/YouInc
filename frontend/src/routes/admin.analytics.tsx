import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useTheme } from "~/hooks/useTheme";
import { formatPercent } from "~/components/widgets/format";
import type { AccountState } from "~/server/accounts";
import type { ProductAnalyticsSummary } from "~/server/productAnalytics";
import "~/styles/auth.css";
import "~/styles/workspace.css";

type AnalyticsOutcome =
  | { status: "ok"; summary: ProductAnalyticsSummary }
  | { status: "forbidden" }
  | { status: "error"; message: string };

const loadAnalytics = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ account: AccountState | null; outcome: AnalyticsOutcome | null }> => {
    const { getAccountState } = await import("~/server/accounts");
    const account = await getAccountState();
    if (!account) return { account: null, outcome: null };

    try {
      const { getProductAnalyticsSummary } = await import("~/server/productAnalytics");
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return {
        account,
        outcome: { status: "ok", summary: await getProductAnalyticsSummary(since) },
      };
    } catch (error) {
      if ((error as { status?: number } | null)?.status === 403) {
        return { account, outcome: { status: "forbidden" } };
      }
      return {
        account,
        outcome: {
          status: "error",
          message: error instanceof Error ? error.message : "Could not load product analytics.",
        },
      };
    }
  },
);

export const Route = createFileRoute("/admin/analytics")({
  loader: async () => {
    const data = await loadAnalytics();
    if (!data.account) throw redirect({ to: "/signin" });
    return data as { account: AccountState; outcome: AnalyticsOutcome };
  },
  component: AdminAnalyticsPage,
});

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="ws-metric">
      <span className="ws-metric__label">{label}</span>
      <strong className="ws-metric__value">{value}</strong>
      <span className="ws-metric__hint">{note}</span>
    </article>
  );
}

function Funnel({ rows }: { rows: ProductAnalyticsSummary["funnel"] }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const transitions = rows.slice(1).map((row, index) => {
    const previous = rows[index];
    const lost = Math.max(previous.count - row.count, 0);
    return {
      from: previous.label,
      to: row.label,
      lost,
      conversion: previous.count > 0 ? row.count / previous.count : null,
    };
  });
  const biggestLeak = transitions.reduce<(typeof transitions)[number] | null>(
    (biggest, transition) =>
      !biggest || transition.lost > biggest.lost ? transition : biggest,
    null,
  );
  return (
    <>
      {biggestLeak && biggestLeak.lost > 0 ? (
        <div className="analytics-priority" role="status">
          <strong>Largest leak: {biggestLeak.lost}</strong>
          <span>{biggestLeak.from} → {biggestLeak.to}</span>
        </div>
      ) : null}
      <ol className="analytics-funnel">
        {rows.map((row, index) => {
          const transition = index > 0 ? transitions[index - 1] : null;
          return (
            <li key={row.event_name}>
              <div className="analytics-funnel__meta">
                <span>
                  {row.label}
                  {transition?.conversion !== null && transition ? (
                    <small>
                      {formatPercent(transition.conversion)} from prior · {transition.lost} lost
                    </small>
                  ) : null}
                </span>
                <strong>{row.count}</strong>
              </div>
              <div className="analytics-bar" aria-hidden="true">
                <span style={{ width: `${Math.max((row.count / max) * 100, row.count ? 2 : 0)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function ActivityBars({ rows }: { rows: ProductAnalyticsSummary["daily"] }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="analytics-days" aria-label="Daily event volume for the last 14 days">
      {rows.map((row) => (
        <div key={row.date} className="analytics-day">
          <span
            className="analytics-day__bar"
            style={{ height: `${Math.max((row.count / max) * 100, row.count ? 4 : 0)}%` }}
            title={`${row.date}: ${row.count} events`}
          />
          <small>{new Date(`${row.date}T00:00:00`).toLocaleDateString("en-NZ", { day: "numeric" })}</small>
        </div>
      ))}
    </div>
  );
}

function AnalyticsDashboard({ summary }: { summary: ProductAnalyticsSummary }) {
  const { kpis } = summary;
  return (
    <>
      <section className="ws-metrics" aria-label="Product health metrics">
        <Metric
          label="Engaged workspaces"
          value={String(kpis.engaged_workspaces_7d)}
          note="Reached value, then viewed the dashboard in the last 7 days"
        />
        <Metric
          label="30-day activation"
          value={kpis.activation_rate === null ? "—" : formatPercent(kpis.activation_rate)}
          note={`${kpis.activated_workspaces} of ${kpis.activation_eligible_workspaces} eligible workspaces reached first value within 7 days`}
        />
        <Metric
          label="Sync reliability"
          value={kpis.sync_success_rate === null ? "—" : formatPercent(kpis.sync_success_rate)}
          note={`${kpis.sync_succeeded} succeeded · ${kpis.sync_failed} failed in 30 days`}
        />
        <Metric
          label="New workspaces"
          value={String(kpis.workspaces_created_7d)}
          note="Created in the last 7 days"
        />
      </section>

      <div className="analytics-grid">
        <section className="ws-panel" aria-labelledby="analytics-funnel-heading">
          <div className="ws-panel__head">
            <h2 id="analytics-funnel-heading">Activation funnel · 30 days</h2>
          </div>
          <div className="ws-panel__body">
            <Funnel rows={summary.funnel} />
            <p className="analytics-note">
              One ordered cohort: account creation through first value and a return dashboard
              visit. The KPI above excludes workspaces too new to have a full seven-day window.
            </p>
          </div>
        </section>

        <section className="ws-panel" aria-labelledby="analytics-events-heading">
          <div className="ws-panel__head">
            <h2 id="analytics-events-heading">Highest-value events</h2>
          </div>
          <div className="ws-panel__body">
            {summary.top_events.length ? (
              <ol className="analytics-ranking">
                {summary.top_events.map((event) => (
                  <li key={event.event_name}>
                    <span>
                      {event.label}
                      <code>{event.event_name}</code>
                    </span>
                    <strong>{event.count}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mb-empty">No product events recorded in this period.</p>
            )}
          </div>
        </section>
      </div>

      <section className="ws-panel" aria-labelledby="analytics-activity-heading">
        <div className="ws-panel__head">
          <h2 id="analytics-activity-heading">Daily value-event volume · 14 days</h2>
        </div>
        <div className="ws-panel__body">
          <ActivityBars rows={summary.daily} />
        </div>
      </section>
    </>
  );
}

function AdminAnalyticsPage() {
  const { account, outcome } = Route.useLoaderData();
  useTheme();

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <span className="ws-topbar__logo">Product analytics</span>
        <div className="ws-topbar__account">
          <span>{account.email}</span>
        </div>
      </header>
      <main className="ws-main">
        <section className="ws-hero">
          <p className="ws-eyebrow">Admin · last 30 days</p>
          <h1>Where people reach value</h1>
          <p className="ws-lede">
            Acquisition, activation, bank-sync health, and recurring dashboard use in one view.
            Outcome events come from the database. Analytics stores pseudonymous IDs, but never
            financial details, emails, URLs, account identifiers, tokens, or free text.
          </p>
        </section>

        {outcome.status === "forbidden" ? (
          <section className="admin-callout admin-callout--forbidden">
            <h2>Not authorized</h2>
            <p>You are not authorized to view this page.</p>
          </section>
        ) : null}
        {outcome.status === "error" ? (
          <section className="admin-callout admin-callout--error">
            <h2>Could not load analytics</h2>
            <p>{outcome.message}</p>
          </section>
        ) : null}
        {outcome.status === "ok" ? <AnalyticsDashboard summary={outcome.summary} /> : null}
      </main>
    </div>
  );
}
