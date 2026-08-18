// Where each "needs you" row goes. Attention items carry a `targetView` naming
// one of the old dashboard tabs; the everyday layer has pages instead, and a
// row that says "sort them" has to land somewhere you can actually sort.
import type { AttentionItem } from "~/components/widgets/derive";
import type { NavBase } from "~/components/app/nav";

export interface AttentionLink {
  to: string;
  label: string;
}

/** Page each signal points at, relative to the base, plus what the link says. */
const ROUTES: Record<string, { path: string; label: string }> = {
  "no-database": { path: "/accounts", label: "Add an account" },
  suspense: { path: "/activity", label: "Sort them" },
  runway: { path: "/spending", label: "See spending" },
  "runway-warn": { path: "/spending", label: "See spending" },
  anomalies: { path: "/spending", label: "See spending" },
  "new-recurring": { path: "/spending", label: "See spending" },
  "stale-sync": { path: "/accounts", label: "Update" },
  "credit-utilization": { path: "/accounts", label: "See accounts" },
  // Mappings are plumbing, so this is the one everyday row that opens the
  // Workshop — and it carries an explanation rather than the word "mapping".
  unmapped: { path: "/workshop", label: "Fix the routing" },
};

const FALLBACK = { path: "/activity", label: "Take a look" };

/**
 * The demo runs the same pages under /demo, so the base is a parameter — a row
 * that says "sort them" has to land somewhere you can actually sort, in both.
 * The Workshop only exists on a real instance; there, the row still points at
 * Activity rather than nowhere.
 */
export function attentionLink(
  item: Pick<AttentionItem, "id">,
  base: NavBase = "/app",
): AttentionLink {
  const route = ROUTES[item.id] ?? FALLBACK;
  const path = route.path === "/workshop" && base !== "/app" ? FALLBACK.path : route.path;
  return { to: `${base}${path}`, label: route.label };
}
