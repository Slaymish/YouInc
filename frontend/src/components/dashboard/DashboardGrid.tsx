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
import { WidgetPicker } from "./WidgetPicker";
import { WIDGET_MAP, type WidgetId } from "./widgets";
import type { LedgerDashboardData } from "~/server/ledger";

import { ControlBriefWidget } from "../widgets/ControlBriefWidget";
import { MetricWidget } from "../widgets/MetricWidget";
import { OperatingStatementWidget } from "../widgets/OperatingStatementWidget";
import { LedgerConfidenceWidget } from "../widgets/LedgerConfidenceWidget";
import { IngestionWidget } from "../widgets/IngestionWidget";
import { BalanceSheetWidget } from "../widgets/BalanceSheetWidget";
import { ManualAccountsWidget } from "../widgets/ManualAccountsWidget";
import { JournalWidget } from "../widgets/JournalWidget";
import { SourceSystemsWidget } from "../widgets/SourceSystemsWidget";
import { LiquidityWidget } from "../widgets/LiquidityWidget";
import { ExpenseBreakdownWidget } from "../widgets/ExpenseBreakdownWidget";
import { IncomeBreakdownWidget } from "../widgets/IncomeBreakdownWidget";
import { SuspenseQueueWidget } from "../widgets/SuspenseQueueWidget";
import { MonthPulseWidget } from "../widgets/MonthPulseWidget";
import { AssetMixWidget } from "../widgets/AssetMixWidget";
import { RollingAverageWidget } from "../widgets/RollingAverageWidget";
import { NetWorthTrendWidget } from "../widgets/NetWorthTrendWidget";
import { RunwayProjectionWidget } from "../widgets/RunwayProjectionWidget";

const ROW_HEIGHT = 80;
const METRIC_IDS = new Set([
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "metric-assets",
  "metric-liabilities",
]);

function renderWidgetContent(id: WidgetId, dashboard: LedgerDashboardData) {
  if (METRIC_IDS.has(id)) {
    return <MetricWidget id={id} dashboard={dashboard} />;
  }
  switch (id) {
    case "control-brief": return <ControlBriefWidget dashboard={dashboard} />;
    case "operating-statement": return <OperatingStatementWidget dashboard={dashboard} />;
    case "ledger-confidence": return <LedgerConfidenceWidget dashboard={dashboard} />;
    case "ingestion": return <IngestionWidget dashboard={dashboard} />;
    case "balance-sheet": return <BalanceSheetWidget dashboard={dashboard} />;
    case "manual-accounts": return <ManualAccountsWidget dashboard={dashboard} />;
    case "journal": return <JournalWidget dashboard={dashboard} />;
    case "source-systems": return <SourceSystemsWidget dashboard={dashboard} />;
    case "liquidity": return <LiquidityWidget dashboard={dashboard} />;
    case "expense-breakdown": return <ExpenseBreakdownWidget dashboard={dashboard} />;
    case "income-breakdown": return <IncomeBreakdownWidget dashboard={dashboard} />;
    case "suspense-queue": return <SuspenseQueueWidget dashboard={dashboard} />;
    case "month-pulse": return <MonthPulseWidget dashboard={dashboard} />;
    case "asset-mix": return <AssetMixWidget dashboard={dashboard} />;
    case "rolling-burn": return <RollingAverageWidget dashboard={dashboard} />;
    case "net-worth-trend": return <NetWorthTrendWidget dashboard={dashboard} />;
    case "runway-projection": return <RunwayProjectionWidget dashboard={dashboard} />;
    default: return null;
  }
}

interface DashboardGridProps {
  dashboard: LedgerDashboardData;
}

export function DashboardGrid({ dashboard }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingSize, setDraggingSize] = useState<{ width: number; height: number } | null>(null);

  const {
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
  } = useDashboardLayout();

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

  const draggingPlacement = draggingId ? layout.find((w) => w.id === draggingId) : null;
  const draggingDef = draggingId ? WIDGET_MAP.get(draggingId as WidgetId) : null;

  return (
    <>
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
            <button type="button" className="dashboard-edit-btn dashboard-edit-btn--done" onClick={saveEdits}>
              Done
            </button>
            <button type="button" className="dashboard-edit-btn" onClick={cancelEdits}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="dashboard-edit-btn" onClick={enterEditMode}>
            Customize
          </button>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={containerRef}
          className={`dashboard-grid${isEditing ? " dashboard-grid--editing" : ""}`}
        >
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
                onReplace={(id) => { setReplacingId(id); setShowPicker(true); }}
                onResize={resizeWidget}
                containerRef={containerRef}
              >
                {renderWidgetContent(placement.id as WidgetId, dashboard)}
              </DashboardPanel>
            );
          })}
        </div>

        <DragOverlay>
          {draggingPlacement && draggingDef ? (
            <div
              className="widget-drag-ghost"
              style={{
                width: draggingSize ? `${draggingSize.width}px` : `${(draggingPlacement.w / 12) * 100}%`,
                height: draggingSize ? `${draggingSize.height}px` : `${draggingPlacement.h * ROW_HEIGHT}px`,
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
          onAdd={(id) => {
            if (replacingId) {
              replaceWidget(replacingId, id);
            } else {
              addWidget(id);
            }
            setReplacingId(null);
            setShowPicker(false);
          }}
          onClose={() => { setReplacingId(null); setShowPicker(false); }}
        />
      )}
    </>
  );
}
