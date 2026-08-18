import type { LedgerDashboardData, LiquidityTier } from "~/components/dashboard/dashboardData";
import { formatMoney, formatPercent } from "./format";
import { NoData } from "./NoData";
import { assetMix } from "./derive";

const TIER_LABELS: Record<LiquidityTier, string> = {
  cash: "Cash",
  semi_liquid: "Semi-liquid",
  illiquid: "Illiquid",
};

const TIER_CLASS: Record<LiquidityTier, string> = {
  cash: "tier-cash",
  semi_liquid: "tier-semi",
  illiquid: "tier-illiquid",
};

export function AssetMixWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const { slices, totalCents } = assetMix(dashboard.balances);
  if (!totalCents) return <NoData
        message="Nothing on the asset side yet."
        hint="Add what you own — a bank account, a house, KiwiSaver — and the mix shows here."
      />;

  return (
    <div className="asset-mix">
      <div className="asset-mix-bar" role="img" aria-label="Asset liquidity composition">
        {slices
          .filter((slice) => slice.cents > 0)
          .map((slice) => (
            <div
              key={slice.tier}
              className={`asset-mix-seg ${TIER_CLASS[slice.tier]}`}
              style={{ width: `${slice.fraction * 100}%` }}
              title={`${TIER_LABELS[slice.tier]} ${formatPercent(slice.fraction)}`}
            />
          ))}
      </div>
      <dl className="asset-mix-legend">
        {slices.map((slice) => (
          <div key={slice.tier}>
            <dt>
              <span className={`asset-mix-dot ${TIER_CLASS[slice.tier]}`} />
              {TIER_LABELS[slice.tier]}
            </dt>
            <dd>
              {formatPercent(slice.fraction)}
              <small>{formatMoney(slice.cents)}</small>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
