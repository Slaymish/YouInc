import type { LedgerDashboardData } from "~/server/ledger";
import { formatMoney, formatPercent } from "./format";

export function LiquidityWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const assets = dashboard.balances.filter((r) => r.accountType === "Assets");

  const cashCents = assets
    .filter((r) => r.liquidityTier === "cash")
    .reduce((s, r) => s + r.balanceCents, 0);
  const semiLiquidCents = assets
    .filter((r) => r.liquidityTier === "semi_liquid")
    .reduce((s, r) => s + r.balanceCents, 0);
  const illiquidCents = assets
    .filter((r) => r.liquidityTier === "illiquid")
    .reduce((s, r) => s + r.balanceCents, 0);
  const { creditHeadroomCents, availableLiquidityCents } = dashboard.totals;
  const hasFacilities = dashboard.creditFacilities.length > 0;

  return (
    <div className="liquidity-widget">
      <div className="liquidity-row liquidity-row--primary">
        <span className="liquidity-label">Cash</span>
        <span className="liquidity-value">{formatMoney(cashCents)}</span>
      </div>
      <div className="liquidity-row">
        <span className="liquidity-label">Semi-liquid</span>
        <span className="liquidity-value">{formatMoney(semiLiquidCents)}</span>
      </div>
      <div className="liquidity-row">
        <span className="liquidity-label">Illiquid</span>
        <span className="liquidity-value">{formatMoney(illiquidCents)}</span>
      </div>
      {hasFacilities ? (
        <>
          <div className="liquidity-row">
            <span className="liquidity-label">Credit headroom</span>
            <span className="liquidity-value">
              {formatMoney(creditHeadroomCents)}
            </span>
          </div>
          <div className="liquidity-row liquidity-row--primary liquidity-row--float">
            <span className="liquidity-label">Available liquidity</span>
            <span className="liquidity-value">
              {formatMoney(availableLiquidityCents)}
            </span>
          </div>
          <p className="liquidity-note">
            Cash + undrawn facility headroom. Not net worth — drawn balances
            remain liabilities serviced from income.
          </p>
        </>
      ) : null}
    </div>
  );
}

export function CreditFacilityWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const facilities = dashboard.creditFacilities;
  if (!facilities.length) {
    return <p className="no-data">NO CREDIT FACILITIES CONFIGURED</p>;
  }

  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Facility</th>
            <th className="numeric">Limit</th>
            <th className="numeric">Drawn</th>
            <th className="numeric">Headroom</th>
            <th className="numeric">Utilization</th>
          </tr>
        </thead>
        <tbody>
          {facilities.map((facility) => (
            <tr key={facility.account}>
              <td>{facility.account}</td>
              <td className="numeric">
                {facility.limitCents !== null
                  ? formatMoney(facility.limitCents)
                  : "n/a"}
              </td>
              <td className="numeric">{formatMoney(facility.drawnCents)}</td>
              <td className="numeric">
                {facility.headroomCents !== null
                  ? formatMoney(facility.headroomCents)
                  : "n/a"}
              </td>
              <td className="numeric">{formatPercent(facility.utilization)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
