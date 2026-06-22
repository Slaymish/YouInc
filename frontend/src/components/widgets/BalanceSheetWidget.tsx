import type { LiquidityTier, BalanceRow, LedgerDashboardData } from "~/server/ledger";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}

function NoData({ message }: { message: string }) {
  return <p className="no-data">{message}</p>;
}

const TIER_LABELS: Record<LiquidityTier, string> = {
  cash: "Cash",
  semi_liquid: "Semi-Liquid (~2 days)",
  illiquid: "Illiquid",
};

const TIER_ORDER: LiquidityTier[] = ["cash", "semi_liquid", "illiquid"];

function TierSection({ tier, rows }: { tier: LiquidityTier; rows: BalanceRow[] }) {
  const subtotal = rows.reduce((sum, r) => sum + r.balanceCents, 0);
  return (
    <>
      <tr className="tier-heading-row">
        <td colSpan={4}>{TIER_LABELS[tier]}</td>
      </tr>
      {rows.map((row) => (
        <tr key={`${row.account}-${row.currency}`} className={row.isManual ? "manual-row" : undefined}>
          <td className="indented">{row.account}</td>
          <td>{row.accountType}</td>
          <td>{row.currency}</td>
          <td className="numeric">{formatMoney(row.balanceCents)}</td>
        </tr>
      ))}
      <tr className="tier-subtotal-row">
        <td colSpan={3}>Subtotal</td>
        <td className="numeric">{formatMoney(subtotal)}</td>
      </tr>
    </>
  );
}

export function BalanceSheetWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  if (!dashboard.balances.length) return <NoData message="NO BALANCES" />;

  const assetsByTier = TIER_ORDER.map((tier) => ({
    tier,
    rows: dashboard.balances.filter((r) => r.accountType === "Assets" && r.liquidityTier === tier),
  })).filter(({ rows }) => rows.length > 0);

  const nonAssets = dashboard.balances.filter((r) => r.accountType !== "Assets");

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th>CCY</th>
            <th className="numeric">Balance</th>
          </tr>
        </thead>
        <tbody>
          {assetsByTier.map(({ tier, rows }) => (
            <TierSection key={tier} tier={tier} rows={rows} />
          ))}
          {nonAssets.map((row) => (
            <tr key={`${row.account}-${row.currency}`} className={row.isManual ? "manual-row" : undefined}>
              <td>{row.account}</td>
              <td>{row.accountType}</td>
              <td>{row.currency}</td>
              <td className="numeric">{formatMoney(row.balanceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
