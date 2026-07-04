import type { WidgetId } from "./widgets";
import type { LedgerDashboardData } from "./dashboardData";
import type { AttentionTargetView } from "../widgets/derive";

import { AttentionWidget } from "../widgets/AttentionWidget";
import { ControlBriefWidget } from "../widgets/ControlBriefWidget";
import { MetricWidget } from "../widgets/MetricWidget";
import { OperatingStatementWidget } from "../widgets/OperatingStatementWidget";
import { LedgerConfidenceWidget } from "../widgets/LedgerConfidenceWidget";
import { BalanceSheetWidget } from "../widgets/BalanceSheetWidget";
import { JournalWidget } from "../widgets/JournalWidget";
import {
  LiquidityWidget,
  CreditFacilityWidget,
} from "../widgets/LiquidityWidget";
import { ExpenseBreakdownWidget } from "../widgets/ExpenseBreakdownWidget";
import { IncomeBreakdownWidget } from "../widgets/IncomeBreakdownWidget";
import { MonthPulseWidget } from "../widgets/MonthPulseWidget";
import { AssetMixWidget } from "../widgets/AssetMixWidget";
import { RollingAverageWidget } from "../widgets/RollingAverageWidget";
import { NetWorthTrendWidget } from "../widgets/NetWorthTrendWidget";
import { RunwayProjectionWidget } from "../widgets/RunwayProjectionWidget";
import { RecurringWidget } from "../widgets/RecurringWidget";
import { NetWorthVelocityWidget } from "../widgets/NetWorthVelocityWidget";
import { IncomeConcentrationWidget } from "../widgets/IncomeConcentrationWidget";
import { CashflowWaterfallWidget } from "../widgets/CashflowWaterfallWidget";
import { SpendingAnomaliesWidget } from "../widgets/SpendingAnomaliesWidget";
import { SpendCalendarWidget } from "../widgets/SpendCalendarWidget";

export const METRIC_IDS = new Set<string>([
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "metric-assets",
  "metric-liabilities",
  "metric-available-liquidity",
]);

export function renderWidgetContent(
  id: WidgetId,
  dashboard: LedgerDashboardData,
  onNavigate: (view: AttentionTargetView) => void,
) {
  if (METRIC_IDS.has(id)) {
    return <MetricWidget id={id} dashboard={dashboard} />;
  }
  switch (id) {
    case "attention":
      return <AttentionWidget dashboard={dashboard} onNavigate={onNavigate} />;
    case "control-brief":
      return <ControlBriefWidget dashboard={dashboard} />;
    case "operating-statement":
      return <OperatingStatementWidget dashboard={dashboard} />;
    case "ledger-confidence":
      return <LedgerConfidenceWidget dashboard={dashboard} />;
    case "balance-sheet":
      return <BalanceSheetWidget dashboard={dashboard} />;
    case "journal":
      return <JournalWidget dashboard={dashboard} />;
    case "liquidity":
      return <LiquidityWidget dashboard={dashboard} />;
    case "credit-facility":
      return <CreditFacilityWidget dashboard={dashboard} />;
    case "expense-breakdown":
      return <ExpenseBreakdownWidget dashboard={dashboard} />;
    case "income-breakdown":
      return <IncomeBreakdownWidget dashboard={dashboard} />;
    case "month-pulse":
      return <MonthPulseWidget dashboard={dashboard} />;
    case "asset-mix":
      return <AssetMixWidget dashboard={dashboard} />;
    case "rolling-burn":
      return <RollingAverageWidget dashboard={dashboard} />;
    case "net-worth-trend":
      return <NetWorthTrendWidget dashboard={dashboard} />;
    case "runway-projection":
      return <RunwayProjectionWidget dashboard={dashboard} />;
    case "recurring":
      return <RecurringWidget dashboard={dashboard} />;
    case "net-worth-velocity":
      return <NetWorthVelocityWidget dashboard={dashboard} />;
    case "income-concentration":
      return <IncomeConcentrationWidget dashboard={dashboard} />;
    case "cashflow-waterfall":
      return <CashflowWaterfallWidget dashboard={dashboard} />;
    case "spending-anomalies":
      return <SpendingAnomaliesWidget dashboard={dashboard} />;
    case "spend-calendar":
      return <SpendCalendarWidget dashboard={dashboard} />;
    default:
      return null;
  }
}
