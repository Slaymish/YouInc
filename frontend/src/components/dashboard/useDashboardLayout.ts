import { useState, useCallback } from "react";
import {
  compact,
  clampPlacement,
  resolveCollisions,
  findDropPosition,
} from "./grid";
import type { WidgetPlacement } from "./grid";
import { WIDGET_MAP } from "./widgets";
import type { WidgetId } from "./widgets";
import { defaultViews, type DashboardView } from "./views";

// Bumped to v2 for the journey-based default tabs (This Week / Cash Flow /
// Wealth / Books). The v1 layout would otherwise shadow the new defaults.
const STORAGE_KEY = "youinc-dashboard-views-v2";

interface DashboardState {
  views: DashboardView[];
  activeId: string;
}

function loadState(): DashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.views) &&
        parsed.views.length > 0 &&
        parsed.views.every(
          (v: unknown): v is DashboardView =>
            !!v &&
            typeof (v as DashboardView).id === "string" &&
            Array.isArray((v as DashboardView).layout),
        )
      ) {
        const activeId = parsed.views.some(
          (v: DashboardView) => v.id === parsed.activeId,
        )
          ? parsed.activeId
          : parsed.views[0].id;
        return { views: parsed.views, activeId };
      }
    }
  } catch {
    // fall through to defaults
  }
  const views = defaultViews();
  return { views, activeId: views[0].id };
}

function persist(state: DashboardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/availability errors
  }
}

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

export function useDashboardLayout() {
  const [state, setState] = useState<DashboardState>(loadState);
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<WidgetPlacement[] | null>(null);

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
      persist(prev);
      return prev;
    });
    setSnapshot(null);
    setIsEditing(false);
  }, []);

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
        const widget = prev.find((w) => w.id === id);
        if (!widget) return prev;
        const def = WIDGET_MAP.get(id as WidgetId);
        const moved = clampPlacement(
          { ...widget, x, y },
          def?.minW ?? 1,
          def?.minH ?? 1,
        );
        return compact(resolveCollisions(prev, moved));
      });
    },
    [updateActiveLayout],
  );

  const resizeWidget = useCallback(
    (id: string, w: number, h: number) => {
      updateActiveLayout((prev) => {
        const widget = prev.find((wid) => wid.id === id);
        if (!widget) return prev;
        const def = WIDGET_MAP.get(id as WidgetId);
        const resized = clampPlacement(
          { ...widget, w, h },
          def?.minW ?? 1,
          def?.minH ?? 1,
        );
        return compact(resolveCollisions(prev, resized));
      });
    },
    [updateActiveLayout],
  );

  const addWidget = useCallback(
    (id: WidgetId) => {
      updateActiveLayout((prev) => {
        if (prev.find((w) => w.id === id)) return prev;
        const def = WIDGET_MAP.get(id);
        if (!def) return prev;
        const { x, y } = findDropPosition(prev, id, def.defaultW, def.defaultH);
        const placement: WidgetPlacement = {
          id,
          x,
          y,
          w: def.defaultW,
          h: def.defaultH,
        };
        return compact([...prev, placement]);
      });
    },
    [updateActiveLayout],
  );

  const removeWidget = useCallback(
    (id: string) => {
      updateActiveLayout((prev) => compact(prev.filter((w) => w.id !== id)));
    },
    [updateActiveLayout],
  );

  const replaceWidget = useCallback(
    (oldId: string, newId: WidgetId) => {
      updateActiveLayout((prev) => {
        if (!prev.find((w) => w.id === oldId)) return prev;
        if (prev.find((w) => w.id === newId)) return prev;
        return prev.map((w) => (w.id === oldId ? { ...w, id: newId } : w));
      });
    },
    [updateActiveLayout],
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
        persist(next);
        return next;
      });
    },
    [discardEdit],
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
      persist(next);
      return next;
    });
    setIsEditing(true);
    setSnapshot([]);
  }, [discardEdit]);

  const renameView = useCallback((id: string, name: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        views: prev.views.map((view) =>
          view.id === id ? { ...view, name } : view,
        ),
      };
      persist(next);
      return next;
    });
  }, []);

  const deleteView = useCallback((id: string) => {
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
      persist(next);
      return next;
    });
  }, []);

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
