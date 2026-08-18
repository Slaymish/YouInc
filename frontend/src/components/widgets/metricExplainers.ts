// "Why this number?" — the working behind each figure, in the reader's own
// money. One source for both Home's headline numbers and the metric cards, so
// the two can never explain the same figure two different ways.
//
// Where the arithmetic is surprising, the text says so instead of hiding it:
// runway divides EVERYTHING you own by average monthly spend (see
// computeRunwayMonths in server/ledgerAggregates.ts), so a house counts.
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, formatMonths, formatPercent } from "./format";

/** Ids the metric cards use, plus "cash" for Home's fourth figure. */
export type ExplainableMetric =
  | "metric-net-worth"
  | "metric-assets"
  | "metric-liabilities"
  | "metric-runway"
  | "metric-burn"
  | "metric-margin"
  | "metric-available-liquidity"
  | "cash";

export function explainMetric(
  id: string,
  dashboard: LedgerDashboardData,
): string[] | null {
  const { totals } = dashboard;
  const months = dashboard.pnl.length;
  const monthWord = months === 1 ? "month" : "months";

  switch (id as ExplainableMetric) {
    case "metric-net-worth":
      return [
        `Everything you own comes to ${formatMoney(totals.assetsCents)}.`,
        `Everything you owe comes to ${formatMoney(totals.liabilitiesCents)}.`,
        `${formatMoney(totals.assetsCents)} − ${formatMoney(totals.liabilitiesCents)} = ${formatMoney(totals.netWorthCents)}`,
        "That's what would be left if you settled up today.",
      ];
    case "metric-assets":
      return [
        `Adding up every account with something in it: ${formatMoney(totals.assetsCents)}.`,
        "Bank balances, savings, and anything you've entered by hand.",
        "It counts things you'd have to sell, not just cash.",
      ];
    case "metric-liabilities":
      return [
        `Everything you owe adds up to ${formatMoney(totals.liabilitiesCents)}.`,
        "Credit cards, loans, and any negative balance you've entered.",
        "This is the number your net worth is measured against.",
      ];
    case "cash":
      return [
        `Your cash accounts hold ${formatMoney(totals.cashCents)} between them.`,
        "Savings and everyday accounts count; anything you'd have to sell doesn't.",
        "That's what you could spend this week without selling something.",
      ];
    case "metric-burn":
      return [
        `You've spent ${formatMoney(totals.expensesCents)} across ${months} ${monthWord} of records.`,
        `${formatMoney(totals.expensesCents)} ÷ ${months} = ${formatMoney(totals.monthlyOverheadCents)}`,
        "It's an average, so one unusual month pulls it around.",
      ];
    case "metric-margin":
      return totals.ebitdaMargin === null
        ? [
            "No income on record yet, so there's nothing to take a share of.",
            "This fills in once money starts coming in.",
          ]
        : [
            `Money in: ${formatMoney(totals.incomeCents)}.`,
            `Money out: ${formatMoney(totals.expensesCents)}.`,
            `What's left is ${formatMoney(totals.ebitdaCents)}, which is ${formatPercent(totals.ebitdaMargin)} of what came in.`,
            "That's the share of your income you didn't spend.",
          ];
    case "metric-available-liquidity":
      return [
        `Cash on hand: ${formatMoney(totals.cashCents)}.`,
        `Credit you haven't used: ${formatMoney(totals.creditHeadroomCents)}.`,
        `${formatMoney(totals.cashCents)} + ${formatMoney(totals.creditHeadroomCents)} = ${formatMoney(totals.availableLiquidityCents)}`,
        "That's what you could reach in a hurry — borrowing included.",
      ];
    case "metric-runway":
      return totals.runwayMonths === null
        ? [
            "There's no spending on record yet, so there's nothing to divide.",
            "This fills in once a month of transactions has come through.",
          ]
        : [
            `Everything you own comes to ${formatMoney(totals.assetsCents)}.`,
            `You spend about ${formatMoney(totals.monthlyOverheadCents)} a month.`,
            `${formatMoney(totals.assetsCents)} ÷ ${formatMoney(totals.monthlyOverheadCents)} = ${formatMonths(totals.runwayMonths)}`,
            "That's how long you'd last if the money stopped and you sold what you own as you went.",
          ];
    default:
      return null;
  }
}
