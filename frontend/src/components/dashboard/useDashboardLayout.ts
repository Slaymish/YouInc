import { useState, useCallback } from "react";
import {
  clampPlacement,
  reflowLayout,
} from "./grid";
import type { WidgetPlacement } from "./grid";
import { WIDGET_MAP } from "./widgets";
import type { WidgetId } from "./widgets";
import {
  DEFAULT_DASHBOARD_STORAGE_KEY,
  loadDashboardState,
  persistDashboardState,
  type DashboardState,
} from "./dashboardStorage";

function newViewId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `view-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `view-${Date.now().toString(36)}`;
}

export interface DashboardViewMeta {
  id: string;
  name: string;
}

export interface UseDashboardLayoutOptions {
  /**
   * localStorage key to persist under. Defaults to the real dashboard's key.
   * Callers that render sample data on a public page (e.g. /demo) must pass
   * a distinct key so demo edits never read from or clobber a real user's
   * saved layout.
   */
  storageKey?: string;
  /**
   * When set, restricts default views, persisted layouts, and widget
   * additions/replacements to this set of widget ids. Used by the public
   * /demo route to keep session-gated, mutation-triggering widgets off a
   * page that has no session.
   */
  allowedWidgetIds?: WidgetId[];
}

export function useDashboardLayout(options: UseDashboardLayoutOptions = {}) {
  const { storageKey = DEFAULT_DASHBOARD_STORAGE_KEY, allowedWidgetIds } = options;
  const [state, setState] = useState<DashboardState>(() =>
    loadDashboardState(storageKey, allowedWidgetIds),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<WidgetPlacement[] | null>(null);

  const isWidgetAllowed = useCallback(
    (id: WidgetId) => !allowedWidgetIds || allowedWidgetIds.includes(id),
    [allowedWidgetIds],
  );

  const activeView =
    state.views.find((view) => view.id === state.activeId) ?? state.views[0];
  const layout = activeView.layout;

  /** Replaces the active view's layout, leaving every other view untouched. */
  const updateActiveLayout = useCallback(
    (updater: (current: WidgetPlacement[]) => WidgetPlacement[]) => {
      setState((prev) => ({
        ...prev,
        views: prev.views.map((view) =>
          view.id === prev.activeId
            ? { ...view, layout: updater(view.layout) }
            : view,
        ),
      }));
    },
    [],
  );

  // ── Layout editing (scoped to the active view) ──

  const enterEditMode = useCallback(() => {
    setSnapshot(activeView.layout);
    setIsEditing(true);
  }, [activeView]);

  const saveEdits = useCallback(() => {
    setState((prev) => {
      persistDashboardState(storageKey, prev);
      return prev;
    });
    setSnapshot(null);
    setIsEditing(false);
  }, [storageKey]);

  const cancelEdits = useCallback(() => {
    if (snapshot) {
      const restore = snapshot;
      setState((prev) => ({
        ...prev,
        views: prev.views.map((view) =>
          view.id === prev.activeId ? { ...view, layout: restore } : view,
        ),
      }));
    }
    setSnapshot(null);
    setIsEditing(false);
  }, [snapshot]);

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      updateActiveLayout((prev) => {
        const ordered = [...prev].sort((a, b) => a.y - b.y || a.x - b.x);
        const widget = ordered.find((w) => w.id === id);
        if (!widget) return prev;
        const remaining = ordered.filter((w) => w.id !== id);
        const targetIndex = remaining.findIndex(
          (placement) => placement.y > y || (placement.y === y && placement.x >= x),
        );
        const insertion = targetIndex < 0 ? remaining.length : targetIndex;
        remaining.splice(insertion, 0, widget);
        return reflowLayout(remaining);
      });
    },
    [updateActiveLayout],
  );

  const resizeWidget = useCallback(
    (id: string, w: number, h: number) => {
      updateActiveLayout((prev) => {
        const ordered = [...prev].sort((a, b) => a.y - b.y || a.x - b.x);
        const widget = ordered.find((wid) => wid.id === id);
        if (!widget) return prev;
        const def = WIDGET_MAP.get(id as WidgetId);
        const resized = clampPlacement(
          { ...widget, w, h },
          def?.minW ?? 1,
          def?.minH ?? 1,
        );
        return reflowLayout(ordered.map((item) => (item.id === id ? resized : item)));
      });
    },
    [updateActiveLayout],
  );

  const addWidget = useCallback(
    (id: WidgetId) => {
      if (!isWidgetAllowed(id)) return;
      updateActiveLayout((prev) => {
        if (prev.find((w) => w.id === id)) return prev;
        const def = WIDGET_MAP.get(id);
        if (!def) return prev;
        const placement: WidgetPlacement = {
          id,
          x: 0,
          y: 0,
          w: def.defaultW,
          h: def.defaultH,
        };
        const ordered = [...prev].sort((a, b) => a.y - b.y || a.x - b.x);
        return reflowLayout([...ordered, placement]);
      });
    },
    [updateActiveLayout, isWidgetAllowed],
  );

  const removeWidget = useCallback(
    (id: string) => {
      updateActiveLayout((prev) =>
        reflowLayout(
          [...prev]
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .filter((w) => w.id !== id),
        ),
      );
    },
    [updateActiveLayout],
  );

  const replaceWidget = useCallback(
    (oldId: string, newId: WidgetId) => {
      if (!isWidgetAllowed(newId)) return;
      updateActiveLayout((prev) => {
        if (!prev.find((w) => w.id === oldId)) return prev;
        if (prev.find((w) => w.id === newId)) return prev;
        const def = WIDGET_MAP.get(newId);
        if (!def) return prev;
        const ordered = [...prev].sort((a, b) => a.y - b.y || a.x - b.x);
        return reflowLayout(
          ordered.map((w) =>
            w.id === oldId
              ? { id: newId, x: 0, y: 0, w: def.defaultW, h: def.defaultH }
              : w,
          ),
        );
      });
    },
    [updateActiveLayout, isWidgetAllowed],
  );

  // ── View (tab) management ──

  /** Discards any in-progress edit so a tab switch never half-applies it. */
  const discardEdit = useCallback(() => {
    if (snapshot) {
      const restore = snapshot;
      setState((prev) => ({
        ...prev,
        views: prev.views.map((view) =>
          view.id === prev.activeId ? { ...view, layout: restore } : view,
        ),
      }));
    }
    setSnapshot(null);
    setIsEditing(false);
  }, [snapshot]);

  const selectView = useCallback(
    (id: string) => {
      discardEdit();
      setState((prev) => {
        if (!prev.views.some((view) => view.id === id)) return prev;
        const next = { ...prev, activeId: id };
        persistDashboardState(storageKey, next);
        return next;
      });
    },
    [discardEdit, storageKey],
  );

  const addView = useCallback(() => {
    discardEdit();
    const id = newViewId();
    setState((prev) => {
      const name = `View ${prev.views.length + 1}`;
      const next: DashboardState = {
        views: [...prev.views, { id, name, layout: [] }],
        activeId: id,
      };
      persistDashboardState(storageKey, next);
      return next;
    });
    setIsEditing(true);
    setSnapshot([]);
  }, [discardEdit, storageKey]);

  const renameView = useCallback(
    (id: string, name: string) => {
      setState((prev) => {
        const next = {
          ...prev,
          views: prev.views.map((view) =>
            view.id === id ? { ...view, name } : view,
          ),
        };
        persistDashboardState(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const deleteView = useCallback(
    (id: string) => {
      setSnapshot(null);
      setIsEditing(false);
      setState((prev) => {
        if (prev.views.length <= 1) return prev;
        const index = prev.views.findIndex((view) => view.id === id);
        const views = prev.views.filter((view) => view.id !== id);
        const activeId =
          prev.activeId === id
            ? views[Math.max(0, index - 1)].id
            : prev.activeId;
        const next = { views, activeId };
        persistDashboardState(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const views: DashboardViewMeta[] = state.views.map((view) => ({
    id: view.id,
    name: view.name,
  }));

  return {
    views,
    activeId: state.activeId,
    layout,
    isEditing,
    canDeleteView: state.views.length > 1,
    selectView,
    addView,
    renameView,
    deleteView,
    enterEditMode,
    saveEdits,
    cancelEdits,
    moveWidget,
    resizeWidget,
    addWidget,
    removeWidget,
    replaceWidget,
  };
}
