import type { LedgerDashboardData } from "~/server/ledger";

function buildControlBrief(dashboard: LedgerDashboardData) {
  if (!dashboard.databaseExists) {
    return {
      status: "BLOCKED",
      tone: "blocked",
      title: "No ledger database",
      body: "No decision can be made until the local ledger exists.",
    };
  }
  if (dashboard.routing.suspenseCount > 0) {
    return {
      status: "EXCEPTION",
      tone: "exception",
      title: "Books not decision-grade",
      body: `${dashboard.routing.suspenseCount.toLocaleString()} suspense item${dashboard.routing.suspenseCount === 1 ? "" : "s"}. Resolve classification before board decisions.`,
    };
  }
  if (dashboard.totals.runwayMonths !== null && dashboard.totals.runwayMonths < 3) {
    return {
      status: "PRESERVE",
      tone: "exception",
      title: "Runway below threshold",
      body: "Prioritize liquidity. Reduce burn or increase revenue before discretionary allocation.",
    };
  }
  if (dashboard.totals.ebitdaCents > 0) {
    return {
      status: "ALLOCATE",
      tone: "ok",
      title: "Surplus available",
      body: "Retained income exists. Allocate to runway, debt reduction, assets or owner compensation.",
    };
  }
  return {
    status: "MONITOR",
    tone: "neutral",
    title: "Operating at baseline",
    body: "Review burn, revenue, liabilities and classification quality before changing commitments.",
  };
}

export function ControlBriefWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const brief = buildControlBrief(dashboard);
  return (
    <div className={`brief ${brief.tone}`}>
      <div>
        <span>{brief.status}</span>
        <h2>{brief.title}</h2>
      </div>
      <p>{brief.body}</p>
    </div>
  );
}
