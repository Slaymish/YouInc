import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, formatPercent, leafAccount } from "./format";
import { NoData } from "./NoData";
import { incomeConcentration } from "./derive";

const LEVEL_LABEL = {
  diversified: "Diversified",
  moderate: "Moderate",
  concentrated: "Concentration risk",
} as const;

const MAX_SHARE_ROWS = 6;

export function IncomeConcentrationWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const concentration = incomeConcentration(dashboard.incomeBreakdown);
  if (!concentration) return <NoData
        message="No income recorded yet."
        hint="This flags when most of your income comes from a single source."
      />;

  const { topShare, topAccount, effectiveSources, level, shares } = concentration;
  const visible = shares.slice(0, MAX_SHARE_ROWS);
  const rest = shares.slice(MAX_SHARE_ROWS);
  const restShare = rest.reduce((sum, row) => sum + row.share, 0);
  const restCents = rest.reduce((sum, row) => sum + row.cents, 0);

  return (
    <div className="stack">
      <div className={`concentration concentration--${level}`}>
        <strong>{formatPercent(topShare)}</strong>
        <span>
          from {leafAccount(topAccount)} · {LEVEL_LABEL[level]}
        </span>
      </div>

      <div className="hhi-row">
        <span className="hhi-figure">{effectiveSources.toFixed(1)}</span>
        <span className="hhi-caption">
          effective income sources
          <small>{shares.length} total · lower = riskier</small>
        </span>
      </div>

      <div
        className="hhi-bar"
        role="img"
        aria-label="Income source composition"
      >
        {visible.map((share, index) => (
          <div
            key={share.account}
            className={`hhi-seg hhi-seg--${index === 0 ? "top" : "rest"}`}
            style={{ width: `${share.share * 100}%` }}
            title={`${leafAccount(share.account)} ${formatPercent(share.share)}`}
          />
        ))}
        {restShare > 0 ? (
          <div
            className="hhi-seg hhi-seg--other"
            style={{ width: `${restShare * 100}%` }}
            title={`Other ${formatPercent(restShare)}`}
          />
        ) : null}
      </div>

      <dl className="hhi-legend">
        {visible.map((share) => (
          <div key={share.account}>
            <dt title={share.account}>{leafAccount(share.account)}</dt>
            <dd>
              {formatPercent(share.share)}
              <small>{formatMoney(share.cents)}</small>
            </dd>
          </div>
        ))}
        {rest.length ? (
          <div>
            <dt>+{rest.length} more</dt>
            <dd>
              {formatPercent(restShare)}
              <small>{formatMoney(restCents)}</small>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
