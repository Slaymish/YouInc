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

/**
 * Packs widgets into the first available grid cell in their supplied order.
 * Unlike vertical-only compaction, this repairs horizontal holes and stale
 * persisted coordinates as well as collisions. The array order is therefore
 * the dashboard's stable reading and drag-reorder order.
 */
export function reflowLayout(layout: WidgetPlacement[]): WidgetPlacement[] {
  const fullWidth = new Set<string>();

  function pack(): WidgetPlacement[] {
    const packed: WidgetPlacement[] = [];
    for (const widget of layout) {
      const w = fullWidth.has(widget.id) ? 12 : Math.max(1, Math.min(12, widget.w));
      const h = Math.max(1, widget.h);
      let placed = false;

      for (let y = 0; !placed; y += 1) {
        for (let x = 0; x <= 12 - w; x += 1) {
          const candidate = { ...widget, x, y, w, h };
          if (!packed.some((existing) => overlaps(existing, candidate))) {
            packed.push(candidate);
            placed = true;
            break;
          }
        }
      }
    }
    return packed;
  }

  let result = pack();
  for (let pass = 0; pass < layout.length; pass += 1) {
    const bottom = result.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
    const orphans = result.filter((widget) => {
      const widgetBottom = widget.y + widget.h;
      if (widgetBottom >= bottom) return false;
      return !result.some(
        (other) =>
          other.id !== widget.id &&
          other.y === widgetBottom,
      );
    });
    if (!orphans.length) break;
    for (const widget of orphans) fullWidth.add(widget.id);
    result = pack();
  }

  // A final unopposed row should read as a complete dashboard band rather
  // than a few tiles marooned on the left. Share its spare columns without
  // shrinking any widget. Rows beside a taller widget are intentionally left
  // alone so editorial hero/sidebar compositions keep their proportions.
  const bands = new Map<string, WidgetPlacement[]>();
  for (const widget of result) {
    const key = `${widget.y}:${widget.h}`;
    bands.set(key, [...(bands.get(key) ?? []), widget]);
  }

  for (const band of bands.values()) {
    const { y, h } = band[0];
    const ids = new Set(band.map((widget) => widget.id));
    const hasBlocker = result.some(
      (widget) =>
        !ids.has(widget.id) && widget.y < y + h && widget.y + widget.h > y,
    );
    const used = band.reduce((sum, widget) => sum + widget.w, 0);
    if (hasBlocker || used >= 12) continue;

    const ordered = [...band].sort((a, b) => a.x - b.x);
    const spare = 12 - used;
    let x = 0;
    for (const [index, widget] of ordered.entries()) {
      const extra = Math.floor(spare / ordered.length) +
        (index < spare % ordered.length ? 1 : 0);
      widget.x = x;
      widget.w += extra;
      x += widget.w;
    }
  }

  // Mixed-height rows cannot be distributed evenly, but each tile can still
  // claim empty columns to its right until the next vertically-overlapping
  // tile. This closes the remaining ragged edge without disturbing order.
  for (const widget of result) {
    const rightBoundary = result.reduce((boundary, other) => {
      if (other.id === widget.id || other.x < widget.x + widget.w) return boundary;
      const overlapsVertically = other.y < widget.y + widget.h && other.y + other.h > widget.y;
      return overlapsVertically ? Math.min(boundary, other.x) : boundary;
    }, 12);
    widget.w = rightBoundary - widget.x;
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
