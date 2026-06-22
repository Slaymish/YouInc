import { useState, useCallback } from "react";
import { compact, clampPlacement, resolveCollisions, findDropPosition } from "./grid";
import type { WidgetPlacement } from "./grid";
import { DEFAULT_LAYOUT, WIDGET_MAP } from "./widgets";
import type { WidgetId } from "./widgets";

const STORAGE_KEY = "youinc-dashboard-v1";

function loadLayout(): WidgetPlacement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: WidgetPlacement[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<WidgetPlacement[]>(() => loadLayout());
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<WidgetPlacement[] | null>(null);

  const enterEditMode = useCallback(() => {
    setSnapshot(layout);
    setIsEditing(true);
  }, [layout]);

  const saveEdits = useCallback(() => {
    saveLayout(layout);
    setSnapshot(null);
    setIsEditing(false);
  }, [layout]);

  const cancelEdits = useCallback(() => {
    if (snapshot) setLayout(snapshot);
    setSnapshot(null);
    setIsEditing(false);
  }, [snapshot]);

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      setLayout((prev) => {
        const widget = prev.find((w) => w.id === id);
        if (!widget) return prev;
        const def = WIDGET_MAP.get(id as WidgetId);
        const moved = clampPlacement({ ...widget, x, y }, def?.minW ?? 1, def?.minH ?? 1);
        return compact(resolveCollisions(prev, moved));
      });
    },
    [],
  );

  const resizeWidget = useCallback(
    (id: string, w: number, h: number) => {
      setLayout((prev) => {
        const widget = prev.find((wid) => wid.id === id);
        if (!widget) return prev;
        const def = WIDGET_MAP.get(id as WidgetId);
        const resized = clampPlacement({ ...widget, w, h }, def?.minW ?? 1, def?.minH ?? 1);
        return compact(resolveCollisions(prev, resized));
      });
    },
    [],
  );

  const addWidget = useCallback((id: WidgetId) => {
    setLayout((prev) => {
      if (prev.find((w) => w.id === id)) return prev;
      const def = WIDGET_MAP.get(id);
      if (!def) return prev;
      const { x, y } = findDropPosition(prev, id, def.defaultW, def.defaultH);
      const placement: WidgetPlacement = { id, x, y, w: def.defaultW, h: def.defaultH };
      return compact([...prev, placement]);
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => compact(prev.filter((w) => w.id !== id)));
  }, []);

  const replaceWidget = useCallback((oldId: string, newId: WidgetId) => {
    setLayout((prev) => {
      if (!prev.find((w) => w.id === oldId)) return prev;
      if (prev.find((w) => w.id === newId)) return prev;
      return prev.map((w) => (w.id === oldId ? { ...w, id: newId } : w));
    });
  }, []);

  return {
    layout,
    isEditing,
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
