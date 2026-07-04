import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapToGrid } from "./grid";
import { useDashboardLayout } from "./useDashboardLayout";
import { DashboardPanel } from "./DashboardPanel";
import { DashboardTabs } from "./DashboardTabs";
import { WidgetPicker } from "./WidgetPicker";
import { WIDGET_MAP, type WidgetId } from "./widgets";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { METRIC_IDS, renderWidgetContent } from "./renderWidget";

const ROW_HEIGHT = 80;

interface DashboardGridProps {
  dashboard: LedgerDashboardData;
  /**
   * localStorage key to persist the layout under. Defaults to the real
   * dashboard's key; pass a distinct key (e.g. on the public /demo route) so
   * edits to sample data never read from or clobber a real user's layout.
   */
  storageKey?: string;
  /**
   * When set, restricts the widget picker and default views to this set of
   * widget ids. Used by the public /demo route to keep session-gated,
   * mutation-triggering widgets off a page rendered without a session.
   */
  allowedWidgetIds?: WidgetId[];
}

export function DashboardGrid({ dashboard, storageKey, allowedWidgetIds }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingSize, setDraggingSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const {
    views,
    activeId,
    layout,
    isEditing,
    canDeleteView,
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
  } = useDashboardLayout({ storageKey, allowedWidgetIds });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    const rect = event.active.rect.current.initial;
    setDraggingSize(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    setDraggingSize(null);
    if (!event.delta) return;

    const id = String(event.active.id);
    const placement = layout.find((w) => w.id === id);
    if (!placement) return;

    const containerWidth = containerRef.current?.offsetWidth ?? 1200;
    const colPx = containerWidth / 12;

    const deltaCol = snapToGrid(event.delta.x, colPx);
    const deltaRow = snapToGrid(event.delta.y, ROW_HEIGHT);

    if (deltaCol === 0 && deltaRow === 0) return;

    moveWidget(id, placement.x + deltaCol, placement.y + deltaRow);
  }

  const draggingPlacement = draggingId
    ? layout.find((w) => w.id === draggingId)
    : null;
  const draggingDef = draggingId
    ? WIDGET_MAP.get(draggingId as WidgetId)
    : null;

  return (
    <>
      <div className="dashboard-bar">
        <DashboardTabs
          views={views}
          activeId={activeId}
          isEditing={isEditing}
          canDelete={canDeleteView}
          onSelect={selectView}
          onAdd={addView}
          onRename={renameView}
          onDelete={deleteView}
        />
        <div className="dashboard-edit-controls">
          {isEditing ? (
            <>
              <button
                type="button"
                className="dashboard-edit-btn dashboard-edit-btn--add"
                onClick={() => setShowPicker(true)}
              >
                + Add widget
              </button>
              <button
                type="button"
                className="dashboard-edit-btn dashboard-edit-btn--done"
                onClick={saveEdits}
              >
                Done
              </button>
              <button
                type="button"
                className="dashboard-edit-btn"
                onClick={cancelEdits}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="dashboard-edit-btn"
              onClick={enterEditMode}
            >
              Customize
            </button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          key={activeId}
          ref={containerRef}
          className={`dashboard-grid${isEditing ? " dashboard-grid--editing" : ""}`}
        >
          {layout.length === 0 ? (
            <p className="dashboard-empty">
              {isEditing
                ? "Empty view — use “+ Add widget” to place widgets here."
                : "Empty view — click Customize to add widgets."}
            </p>
          ) : null}
          {layout.map((placement) => {
            const def = WIDGET_MAP.get(placement.id as WidgetId);
            const isMiniMetric = METRIC_IDS.has(placement.id);
            return (
              <DashboardPanel
                key={placement.id}
                placement={placement}
                title={def?.label ?? placement.id}
                isEditing={isEditing}
                isMiniMetric={isMiniMetric}
                onRemove={removeWidget}
                onReplace={(id) => {
                  setReplacingId(id);
                  setShowPicker(true);
                }}
                onResize={resizeWidget}
                containerRef={containerRef}
              >
                {renderWidgetContent(
                  placement.id as WidgetId,
                  dashboard,
                  selectView,
                )}
              </DashboardPanel>
            );
          })}
        </div>

        <DragOverlay>
          {draggingPlacement && draggingDef ? (
            <div
              className="widget-drag-ghost"
              style={{
                width: draggingSize
                  ? `${draggingSize.width}px`
                  : `${(draggingPlacement.w / 12) * 100}%`,
                height: draggingSize
                  ? `${draggingSize.height}px`
                  : `${draggingPlacement.h * ROW_HEIGHT}px`,
              }}
            >
              {draggingDef.label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showPicker && isEditing && (
        <WidgetPicker
          layout={layout}
          replacingId={replacingId ?? undefined}
          allowedWidgetIds={allowedWidgetIds}
          onAdd={(id) => {
            if (replacingId) {
              replaceWidget(replacingId, id);
            } else {
              addWidget(id);
            }
            setReplacingId(null);
            setShowPicker(false);
          }}
          onClose={() => {
            setReplacingId(null);
            setShowPicker(false);
          }}
        />
      )}
    </>
  );
}
