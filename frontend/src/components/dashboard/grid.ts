export interface WidgetPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function snapToGrid(px: number, cellPx: number): number {
  return Math.round(px / cellPx);
}

function overlaps(a: WidgetPlacement, b: WidgetPlacement): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function resolveCollisions(
  layout: WidgetPlacement[],
  moved: WidgetPlacement,
): WidgetPlacement[] {
  const result: WidgetPlacement[] = layout.map((w) =>
    w.id === moved.id ? moved : { ...w },
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const widget of result) {
      if (widget.id === moved.id) continue;
      const mover = result.find((w) => w.id === moved.id)!;
      if (overlaps(mover, widget)) {
        widget.y = mover.y + mover.h;
        changed = true;
      }
    }
  }

  return result;
}

export function compact(layout: WidgetPlacement[]): WidgetPlacement[] {
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const result: WidgetPlacement[] = [];

  for (const widget of sorted) {
    let y = 0;
    while (true) {
      const candidate = { ...widget, y };
      const collision = result.find((w) => overlaps(w, candidate));
      if (!collision) {
        result.push(candidate);
        break;
      }
      y = collision.y + collision.h;
    }
  }

  return result;
}

export function clampPlacement(
  placement: WidgetPlacement,
  minW: number,
  minH: number,
): WidgetPlacement {
  const w = Math.max(minW, Math.min(12, placement.w));
  const h = Math.max(minH, placement.h);
  const x = Math.max(0, Math.min(12 - w, placement.x));
  const y = Math.max(0, placement.y);
  return { ...placement, x, y, w, h };
}

export function findDropPosition(
  layout: WidgetPlacement[],
  widgetId: string,
  defaultW: number,
  defaultH: number,
): { x: number; y: number } {
  const maxY = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0);
  return { x: 0, y: maxY };
}
