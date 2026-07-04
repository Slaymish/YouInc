import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import {
  buildAttentionItems,
  type AttentionSeverity,
  type AttentionTargetView,
} from "./derive";

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  critical: "Critical",
  action: "Action needed",
  review: "Review",
};

const TARGET_LABEL: Record<AttentionTargetView, string> = {
  "this-week": "This Week",
  "cash-flow": "Cash Flow",
  wealth: "Wealth",
  books: "Books",
};

export function AttentionWidget({
  dashboard,
  onNavigate,
}: {
  dashboard: LedgerDashboardData;
  onNavigate?: (view: AttentionTargetView) => void;
}) {
  const items = buildAttentionItems(dashboard);

  if (!items.length) {
    return (
      <div className="attention attention--clear">
        <strong>All clear</strong>
        <p>Books are decision-grade. Nothing needs you this week.</p>
      </div>
    );
  }

  return (
    <ul className="attention-list">
      {items.map((item) => (
        <li
          key={item.id}
          className={`attention-item attention-item--${item.severity}`}
        >
          <span
            className="attention-dot"
            role="img"
            aria-label={SEVERITY_LABEL[item.severity]}
          />
          <div className="attention-body">
            <span className="attention-label">{item.label}</span>
            <span className="attention-detail">{item.detail}</span>
          </div>
          {onNavigate ? (
            <button
              type="button"
              className="attention-go"
              onClick={() => onNavigate(item.targetView)}
            >
              {TARGET_LABEL[item.targetView]} →
            </button>
          ) : (
            <span className="attention-go attention-go--static">
              {TARGET_LABEL[item.targetView]} →
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
