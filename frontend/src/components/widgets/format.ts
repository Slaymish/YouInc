export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("en-NZ", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMonths(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}m`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function shortMoney(cents: number): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${Math.round(dollars)}`;
}

/**
 * Drops the top-level account type (e.g. "Expenses:") so a constrained widget
 * shows the meaningful leaf path. Single-segment accounts are returned as-is.
 */
export function leafAccount(account: string): string {
  const parts = account.split(":");
  return parts.length <= 2 ? account : parts.slice(1).join(":");
}
