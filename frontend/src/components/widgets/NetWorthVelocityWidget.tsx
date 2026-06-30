import type { LedgerDashboardData } from "~/server/ledger";
import { formatMoney, shortMoney } from "./format";
import { NoData } from "./NoData";
import { netWorthVelocity } from "./derive";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMonthsAway(months: number | null): string {
  if (months === null) return "not at this pace";
  if (months < 1) return "under a month";
  if (months < 24) return `~${Math.round(months)} mo`;
  return `~${(months / 12).toFixed(1)} yr`;
}

export function NetWorthVelocityWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const velocity = netWorthVelocity(dashboard.netWorthTrend);
  if (!velocity) return <NoData message="NEED 2+ MONTHS OF POSTINGS" />;

  const { monthlyDeltaCents, direction, latestCents, milestones } = velocity;
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "→";
  const toneClass =
    direction === "up"
      ? "velocity-head--up"
      : direction === "down"
        ? "velocity-head--down"
        : "";

  return (
    <div className="stack">
      <div className={`velocity-head ${toneClass}`}>
        <strong>
          {arrow} {shortMoney(Math.abs(monthlyDeltaCents))}/mo
        </strong>
        <span>net-worth velocity · now {formatMoney(latestCents)}</span>
      </div>
      {direction === "up" && milestones.length ? (
        <ul className="milestone-list">
          {milestones.map((milestone) => (
            <li key={milestone.targetCents} className="milestone-item">
              <span className="milestone-target">
                {shortMoney(milestone.targetCents)}
              </span>
              <span className="milestone-date">{formatDate(milestone.date)}</span>
              <span className="milestone-away">
                {formatMonthsAway(milestone.monthsAway)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="form-hint">
          {direction === "flat"
            ? "Net worth is roughly flat — no milestone crossings to project."
            : "Net worth is trending down; no upward milestones to project."}
        </p>
      )}
      <p className="form-hint">
        Linear fit over {dashboard.netWorthTrend.length} months of journal-posted
        net worth.
      </p>
    </div>
  );
}
