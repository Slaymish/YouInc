import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { SUSPENSE_MINOR_THRESHOLD } from "./derive";
import { formatMoney, formatMonths } from "./format";

/**
 * One judgement over the whole ledger. Exported because Home promotes it out
 * of the card grid into the page headline (interface plan §04) — the card and
 * the headline must never drift into two different opinions.
 */
export function buildControlBrief(dashboard: LedgerDashboardData) {
  if (!dashboard.databaseExists) {
    return {
      status: "BLOCKED",
      tone: "blocked",
      title: "No accounts yet",
      body: "Add an account before we can show you anything.",
    };
  }
  const suspenseCount = dashboard.routing.suspenseCount;
  // A large backlog genuinely blocks decisions; a small one is routine
  // cleanup and shouldn't read as an alarm (see SUSPENSE_MINOR_THRESHOLD).
  if (suspenseCount > SUSPENSE_MINOR_THRESHOLD) {
    return {
      status: "EXCEPTION",
      tone: "exception",
      title: "Needs a few categories",
      body: `${suspenseCount.toLocaleString()} thing${suspenseCount === 1 ? "" : "s"} need a category. Sort them and your numbers will be spot on.`,
    };
  }
  if (dashboard.totals.runwayMonths !== null && dashboard.totals.runwayMonths < 3) {
    return {
      status: "PRESERVE",
      tone: "exception",
      title: "Cash is running low",
      body: `You have ${formatMonths(dashboard.totals.runwayMonths)} of cash left at this rate. Cutting costs or bringing in more money will stretch it.`,
    };
  }
  if (dashboard.totals.ebitdaCents > 0) {
    return {
      status: "ALLOCATE",
      tone: "ok",
      title: "Money spare this month",
      body: `You have ${formatMoney(dashboard.totals.ebitdaCents)} spare this month. Save it or pay something down — the choice is yours.`,
    };
  }
  if (suspenseCount > 0) {
    return {
      status: "REVIEW",
      tone: "neutral",
      title: "A few things need sorting",
      body: `${suspenseCount.toLocaleString()} thing${suspenseCount === 1 ? "" : "s"} need a category — nothing urgent, sort them whenever suits.`,
    };
  }
  return {
    status: "MONITOR",
    tone: "neutral",
    title: "Steady month",
    body: "Nothing needs you right now.",
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
