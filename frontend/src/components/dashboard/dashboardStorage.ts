import { compact } from "./grid";
import type { WidgetId } from "./widgets";
import { defaultViews, type DashboardView } from "./views";

// Bumped to v2 for the journey-based default tabs (This Week / Cash Flow /
// Wealth / Books). The v1 layout would otherwise shadow the new defaults.
export const DEFAULT_DASHBOARD_STORAGE_KEY = "youinc-dashboard-views-v2";

export interface DashboardState {
  views: DashboardView[];
  activeId: string;
}

function isPersistedState(
  parsed: unknown,
): parsed is { views: DashboardView[]; activeId: string } {
  return (
    !!parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { views?: unknown }).views) &&
    (parsed as { views: unknown[] }).views.length > 0 &&
    (parsed as { views: unknown[] }).views.every(
      (v: unknown): v is DashboardView =>
        !!v &&
        typeof (v as DashboardView).id === "string" &&
        Array.isArray((v as DashboardView).layout),
    )
  );
}

/**
 * Drops any placement whose widget id isn't in the allowlist, leaving every
 * other field of the state untouched. Pure/immutable — returns the same
 * reference when no allowlist is given so callers can skip work.
 */
export function filterStateToAllowed(
  state: DashboardState,
  allowedWidgetIds?: WidgetId[],
): DashboardState {
  if (!allowedWidgetIds) return state;
  const allowed = new Set(allowedWidgetIds);
  return {
    ...state,
    views: state.views.map((view) => ({
      ...view,
      layout: compact(view.layout.filter((w) => allowed.has(w.id as WidgetId))),
    })),
  };
}

/**
 * Loads dashboard state from the given localStorage key, falling back to
 * `defaultViews` (optionally scoped to `allowedWidgetIds`) when nothing is
 * persisted or the persisted payload is malformed. Persisted layouts are
 * also filtered against the allowlist, so a stale/disallowed widget id
 * saved under a previous allowlist never resurfaces.
 */
export function loadDashboardState(
  storageKey: string,
  allowedWidgetIds?: WidgetId[],
): DashboardState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isPersistedState(parsed)) {
        const activeId = parsed.views.some((v) => v.id === parsed.activeId)
          ? parsed.activeId
          : parsed.views[0].id;
        return filterStateToAllowed({ views: parsed.views, activeId }, allowedWidgetIds);
      }
    }
  } catch {
    // fall through to defaults
  }
  const views = defaultViews(allowedWidgetIds);
  return { views, activeId: views[0].id };
}

export function persistDashboardState(storageKey: string, state: DashboardState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore quota/availability errors
  }
}
