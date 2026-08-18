// The "Noticed" feed: the app spotted something so you didn't have to.
//
// Same detection the Spending Anomalies card already ran — reframed from a
// z-score table into sentences, which is the whole difference between a stern
// report and the thing people screenshot for their partner. Tone rule: warm
// when the news is good, plain and useful when it isn't, never cute about
// money problems.
import type { CategoryMonthPoint } from "~/server/analytics";
import type { RecurringPayment } from "~/server/analytics";
import { spendingAnomalies } from "~/components/widgets/derive";

export interface Observation {
  /** Stable key so a re-render doesn't reorder or re-animate the list. */
  id: string;
  text: string;
  /** Good news, plain news, or something worth a look. */
  tone: "good" | "neutral" | "watch";
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(Math.abs(cents) / 100);
}

function label(account: string): string {
  const parts = account.split(":");
  return parts[parts.length - 1] || account;
}

/** Three or more months of increases in a row, in the same category. */
export function risingStreaks(
  categoryMonthly: readonly CategoryMonthPoint[],
  minMonths = 3,
): Observation[] {
  const byAccount = new Map<string, CategoryMonthPoint[]>();
  for (const row of categoryMonthly) {
    const rows = byAccount.get(row.account) ?? [];
    rows.push(row);
    byAccount.set(row.account, rows);
  }

  const out: Observation[] = [];
  for (const [account, rows] of byAccount) {
    const series = [...rows].sort((a, b) => a.month.localeCompare(b.month));
    if (series.length < minMonths) continue;
    const tail = series.slice(-minMonths);
    const climbing = tail.every(
      (row, index) => index === 0 || row.amountCents > tail[index - 1].amountCents,
    );
    if (!climbing) continue;
    out.push({
      id: `rising:${account}`,
      tone: "watch",
      text: `${label(account)} has gone up ${minMonths} months running — ${tail
        .map((row) => money(row.amountCents))
        .join(", ")}.`,
    });
  }
  return out;
}

/** A category that ran well above or below its own history last month. */
export function monthlySurprises(
  categoryMonthly: readonly CategoryMonthPoint[],
): Observation[] {
  const { anomalies } = spendingAnomalies([...categoryMonthly]);
  return anomalies.map((anomaly) => {
    const gap = money(anomaly.deltaCents);
    return anomaly.direction === "below"
      ? {
          id: `below:${anomaly.account}`,
          tone: "good" as const,
          text: `You spent ${gap} less on ${label(anomaly.account)} this month than you usually do.`,
        }
      : {
          id: `above:${anomaly.account}`,
          tone: "watch" as const,
          text: `${label(anomaly.account)} is ${gap} above its usual month — ${money(
            anomaly.currentCents,
          )} against about ${money(anomaly.meanCents)}.`,
        };
  });
}

/** What the regular payments add up to, once there are enough to matter. */
export function committedSpend(
  recurring: readonly RecurringPayment[],
  minCount = 3,
): Observation[] {
  if (recurring.length < minCount) return [];
  const monthly = recurring.reduce((sum, row) => sum + row.monthlyEquivalentCents, 0);
  if (monthly <= 0) return [];
  return [
    {
      id: "committed",
      tone: "neutral",
      text: `${recurring.length} payments repeat on a schedule, adding up to about ${money(
        monthly,
      )} a month.`,
    },
  ];
}

export interface ObservationInput {
  categoryMonthly: readonly CategoryMonthPoint[];
  recurringPayments: readonly RecurringPayment[];
  limit?: number;
}

/**
 * Good news first — the point of the feed is a reason to come back, and a list
 * that opens with a warning every month stops being one. Deduplicated by
 * category so a rising streak and an above-average month don't both fire for
 * the same thing.
 */
export function observations({
  categoryMonthly,
  recurringPayments,
  limit = 4,
}: ObservationInput): Observation[] {
  const ranked = [
    ...monthlySurprises(categoryMonthly).filter((o) => o.tone === "good"),
    ...risingStreaks(categoryMonthly),
    ...monthlySurprises(categoryMonthly).filter((o) => o.tone !== "good"),
    ...committedSpend(recurringPayments),
  ];

  const seen = new Set<string>();
  const out: Observation[] = [];
  for (const observation of ranked) {
    const subject = observation.id.split(":").slice(1).join(":") || observation.id;
    if (seen.has(subject)) continue;
    seen.add(subject);
    out.push(observation);
    if (out.length === limit) break;
  }
  return out;
}
