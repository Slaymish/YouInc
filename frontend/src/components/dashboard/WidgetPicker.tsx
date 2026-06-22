import {
  WIDGET_REGISTRY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type WidgetId,
  type WidgetCategory,
} from "./widgets";
import type { WidgetPlacement } from "./grid";

interface WidgetPickerProps {
  layout: WidgetPlacement[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
  replacingId?: string;
}

export function WidgetPicker({ layout, onAdd, onClose, replacingId }: WidgetPickerProps) {
  const activeIds = new Set(layout.map((w) => w.id).filter((id) => id !== replacingId));

  const byCategory = CATEGORY_ORDER.reduce<Record<WidgetCategory, typeof WIDGET_REGISTRY>>(
    (acc, cat) => {
      acc[cat] = WIDGET_REGISTRY.filter((w) => w.category === cat && !activeIds.has(w.id));
      return acc;
    },
    {} as Record<WidgetCategory, typeof WIDGET_REGISTRY>,
  );

  const hasAny = CATEGORY_ORDER.some((cat) => byCategory[cat].length > 0);
  const title = replacingId ? "Replace Widget" : "Add Widget";

  return (
    <div className="widget-picker-overlay" onClick={onClose}>
      <aside className="widget-picker" onClick={(e) => e.stopPropagation()}>
        <header className="widget-picker-header">
          <span>{title}</span>
          <button type="button" className="widget-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="widget-picker-body">
          {!hasAny ? (
            <p className="widget-picker-empty">All widgets are on your dashboard.</p>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const widgets = byCategory[cat];
              if (!widgets.length) return null;
              return (
                <div key={cat} className="widget-picker-category">
                  <p className="widget-picker-category-label">{CATEGORY_LABELS[cat]}</p>
                  <div className="widget-picker-grid">
                    {widgets.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className="widget-picker-item"
                        onClick={() => onAdd(w.id)}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
