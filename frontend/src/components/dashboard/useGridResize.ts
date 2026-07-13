import { useCallback, useRef } from "react";
import { snapToGrid } from "./grid";

const ROW_HEIGHT = 80;

interface ResizeState {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  colPx: number;
}

export function useGridResize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onResize: (id: string, w: number, h: number) => void,
) {
  const state = useRef<ResizeState | null>(null);
  const previewRef = useRef<{ w: number; h: number } | null>(null);

  const startResize = useCallback(
    (e: React.MouseEvent, id: string, currentW: number, currentH: number) => {
      e.preventDefault();
      e.stopPropagation();

      const containerWidth = containerRef.current?.offsetWidth ?? 1200;
      const colPx = containerWidth / 12;

      state.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startW: currentW,
        startH: currentH,
        colPx,
      };
      previewRef.current = { w: currentW, h: currentH };

      function onMove(ev: MouseEvent) {
        if (!state.current) return;
        const { startX, startY, startW, startH, colPx } = state.current;
        const deltaCol = snapToGrid(ev.clientX - startX, colPx);
        const deltaRow = snapToGrid(ev.clientY - startY, ROW_HEIGHT);
        const newW = Math.max(1, startW + deltaCol);
        const newH = Math.max(1, startH + deltaRow);
        previewRef.current = { w: newW, h: newH };
      }

      function onUp() {
        const current = state.current;
        const preview = previewRef.current;
        if (current && preview) {
          onResize(current.id, preview.w, preview.h);
        }
        state.current = null;
        previewRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [containerRef, onResize],
  );

  return { startResize };
}
