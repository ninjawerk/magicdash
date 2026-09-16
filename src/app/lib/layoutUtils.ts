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
 * Free-placement collision resolution: the `actor` keeps its new position and any tile it now overlaps is
 * pushed straight down (cascading). Tiles that weren't touched stay where they are.
 * Returns null when something would fall off the bottom of the grid — the caller should then revert.
 */
export function pushDown(items: Rect[], actorId: string | string[], rows: number): Rect[] | null {
  const actorIds = Array.isArray(actorId) ? actorId : [actorId];
  const actors = actorIds.map((id) => items.find((i) => i.id === id)).filter((a): a is Rect => !!a);
  if (actors.length === 0) return items;
  // Actors are fixed; if two actors overlap each other the arrangement is impossible.
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) if (collides(actors[i], actors[j])) return null;
  const placed: Rect[] = actors.map((a) => ({ ...a }));
  const others = items
    .filter((i) => !actorIds.includes(i.id))
    .map((i) => ({ ...i }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of others) {
    // Keep moving down until it collides with nothing already placed.
    for (let guard = 0; guard < 100; guard++) {
      const hit = placed.filter((p) => collides(p, it));
      if (hit.length === 0) break;
      it.y = Math.max(...hit.map((p) => p.y + p.h));
    }
    if (it.y + it.h > rows) return null;
    placed.push(it);
  }
  return placed;
}

export function applyRects(widgets: WidgetInstance[], rects: Rect[]): WidgetInstance[] {
  const byId = new Map(rects.map((r) => [r.id, r]));
  return widgets.map((w) => {
    const r = byId.get(w.id);
    return r && (r.x !== w.x || r.y !== w.y || r.w !== w.w || r.h !== w.h) ? { ...w, x: r.x, y: r.y, w: r.w, h: r.h } : w;
  });
}
