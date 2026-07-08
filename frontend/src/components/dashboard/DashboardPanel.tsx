import { type ReactNode, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { WidgetPlacement } from "./grid";
import { useGridResize } from "./useGridResize";
import { DragIcon, SwapIcon, RemoveIcon } from "./icons";

const ROW_HEIGHT = 80;

interface DashboardPanelProps {
  placement: WidgetPlacement;
  title: string;
  isEditing: boolean;
  isMiniMetric?: boolean;
  onRemove: (id: string) => void;
  onReplace: (id: string) => void;
  onResize: (id: string, w: number, h: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

export function DashboardPanel({
  placement,
  title,
  isEditing,
  isMiniMetric,
  onRemove,
  onReplace,
  onResize,
  containerRef,
  children,
}: DashboardPanelProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: placement.id,
    disabled: !isEditing,
  });

  const { startResize } = useGridResize(containerRef, onResize);

  const style: React.CSSProperties = {
    gridColumn: `${placement.x + 1} / span ${placement.w}`,
    gridRow: `${placement.y + 1} / span ${placement.h}`,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : undefined,
    position: "relative",
  };

  if (isMiniMetric) {
    return (
      <article
        ref={setNodeRef}
        style={style}
        className={`metric${isEditing ? " metric--editing" : ""}`}
      >
        {isEditing && (
          <>
            <button
              className="widget-drag-handle"
              type="button"
              aria-label="Drag"
              {...listeners}
              {...attributes}
            >
              <DragIcon />
            </button>
            <button
              className="widget-replace"
              type="button"
              aria-label="Replace widget"
              onClick={() => onReplace(placement.id)}
            >
              <SwapIcon />
            </button>
            <button
              className="widget-remove"
              type="button"
              aria-label="Remove"
              onClick={() => onRemove(placement.id)}
            >
              <RemoveIcon />
            </button>
          </>
        )}
        {children}
        {isEditing && (
          <div
            className="widget-resize-handle"
            onMouseDown={(e) => startResize(e, placement.id, placement.w, placement.h)}
            aria-label="Resize"
          />
        )}
      </article>
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`panel${isEditing ? " panel--editing" : ""}`}
    >
      <header>
        {isEditing && (
          <button
            className="widget-drag-handle"
            type="button"
            aria-label="Drag"
            {...listeners}
            {...attributes}
          >
            <DragIcon />
          </button>
        )}
        <h2>{title}</h2>
        {isEditing && (
          <>
            <button
              className="widget-replace"
              type="button"
              aria-label="Replace widget"
              onClick={() => onReplace(placement.id)}
            >
              <SwapIcon />
            </button>
            <button
              className="widget-remove"
              type="button"
              aria-label="Remove widget"
              onClick={() => onRemove(placement.id)}
            >
              <RemoveIcon />
            </button>
          </>
        )}
      </header>
      <div className="panel-body">{children}</div>
      {isEditing && (
        <div
          className="widget-resize-handle"
          onMouseDown={(e) => startResize(e, placement.id, placement.w, placement.h)}
          aria-label="Resize"
        />
      )}
    </section>
  );
}
