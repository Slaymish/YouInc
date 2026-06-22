import type { LedgerDashboardData } from "~/server/ledger";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}

export function LiquidityWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const assets = dashboard.balances.filter((r) => r.accountType === "Assets");

  const cashCents = assets.filter((r) => r.liquidityTier === "cash").reduce((s, r) => s + r.balanceCents, 0);
  const semiLiquidCents = assets.filter((r) => r.liquidityTier === "semi_liquid").reduce((s, r) => s + r.balanceCents, 0);
  const illiquidCents = assets.filter((r) => r.liquidityTier === "illiquid").reduce((s, r) => s + r.balanceCents, 0);

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
    </div>
  );
}
