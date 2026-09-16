import type { WidgetInstance } from '@sdk';

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function collides(a: Rect, b: Rect): boolean {
  return a.id !== b.id && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Free-placement collision resolution: the `actor`(s) keep their new position and any tile they now overlap is
 * pushed straight down (cascading). Tiles that weren't touched stay where they are — including tiles that already
 * overlapped each other before the gesture (a broken layout must not block every gesture).
 * Returns null when something would fall off the bottom of the grid — the caller should then revert.
 */
export function pushDown(items: Rect[], actorId: string | string[], rows: number): Rect[] | null {
  const actorIds = Array.isArray(actorId) ? actorId : [actorId];
  const actors = items.filter((i) => actorIds.includes(i.id)).map((a) => ({ ...a }));
  if (actors.length === 0) return items;
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) if (collides(actors[i], actors[j])) return null;
  // "blockers" are rects that others must not overlap: the actors plus anything we pushed.
  const blockers: Rect[] = [...actors];
  const out: Rect[] = [...actors];
  const others = items.filter((i) => !actorIds.includes(i.id)).map((i) => ({ ...i })).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of others) {
    let moved = false;
    for (let guard = 0; guard < 100; guard++) {
      const hit = blockers.filter((b) => collides(b, it));
      if (hit.length === 0) break;
      it.y = Math.max(...hit.map((b) => b.y + b.h));
      moved = true;
    }
    if (it.y + it.h > rows) return null;
    if (moved) blockers.push(it);
    out.push(it);
  }
  return out;
}

/**
 * Untangle a layout that already has overlapping or out-of-bounds tiles (e.g. from an older "stack at the bottom"
 * fallback). Tiles are kept in reading order; a colliding tile moves to the first free spot, or is clamped if there
 * is none. Returns the same array when nothing needed fixing.
 */
export function repairLayout<T extends Rect>(items: T[], cols: number, rows: number): T[] {
  const placed: Rect[] = [];
  let changed = false;
  const out = [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((it) => {
      let r: Rect = { id: it.id, x: it.x, y: it.y, w: Math.min(it.w, cols), h: Math.min(it.h, rows) };
      r.x = Math.max(0, Math.min(r.x, cols - r.w));
      r.y = Math.max(0, Math.min(r.y, rows - r.h));
      if (placed.some((p) => collides(p, r))) {
        // Find room at the current size, then progressively smaller (the grid library would otherwise push an
        // overlapping tile below the bottom edge where nobody can see it).
        const find = (w: number, h: number) => {
          for (let y = 0; y + h <= rows; y++)
            for (let x = 0; x + w <= cols; x++) {
              const cand = { id: r.id, x, y, w, h };
              if (!placed.some((p) => collides(p, cand))) return cand;
            }
          return undefined;
        };
        let found: Rect | undefined;
        for (let shrink = 0; !found && shrink < Math.max(r.w, r.h); shrink++) {
          // Prefer giving up width or height alone before both.
          found = find(Math.max(1, r.w - shrink), r.h) ?? find(r.w, Math.max(1, r.h - shrink)) ?? find(Math.max(1, r.w - shrink), Math.max(1, r.h - shrink));
        }
        if (found) r = found;
      }
      if (r.x !== it.x || r.y !== it.y || r.w !== it.w || r.h !== it.h) changed = true;
      placed.push(r);
      return { ...it, x: r.x, y: r.y, w: r.w, h: r.h };
    });
  if (!changed) return items;
  const order = new Map(items.map((it, i) => [it.id, i]));
  return out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function applyRects(widgets: WidgetInstance[], rects: Rect[]): WidgetInstance[] {
  const byId = new Map(rects.map((r) => [r.id, r]));
  return widgets.map((w) => {
    const r = byId.get(w.id);
    return r && (r.x !== w.x || r.y !== w.y || r.w !== w.w || r.h !== w.h) ? { ...w, x: r.x, y: r.y, w: r.w, h: r.h } : w;
  });
}
