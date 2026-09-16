import { useEffect, useMemo, useRef, useState } from 'react';
import { inWindow, type Screen } from '@sdk';
import RGL, { type Layout } from 'react-grid-layout';
import { useStore } from '../lib/store';
import { WidgetShell } from './WidgetShell';
import { getClientPlugin } from '../lib/registry';
import { applyRects, pushDown, type Rect } from '../lib/layoutUtils';

/** All screens stacked; only the active one is visible. Inactive screens stay mounted so their widgets keep running. */
export function Dashboard() {
  const { layout, activeScreenId } = useStore();
  if (!layout) return null;
  return (
    <>
      {layout.screens.map((screen) => {
        const active = screen.id === activeScreenId;
        return (
          <div
            key={screen.id}
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: active ? 1 : 0, visibility: active ? 'visible' : 'hidden', pointerEvents: active ? 'auto' : 'none' }}
            aria-hidden={!active}
          >
            <ScreenGrid screen={screen} active={active} />
          </div>
        );
      })}
    </>
  );
}

function ScreenGrid({ screen, active }: { screen: Screen; active: boolean }) {
  const { layout, editMode, updateLayout, draggingRef } = useStore();
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 15_000);
    return () => clearInterval(id);
  }, []);
  // Tiles outside their schedule are hidden while viewing (they keep their spot); all show in edit mode.
  const now = new Date(minute * 60_000);
  const hidden = new Set(editMode ? [] : screen.widgets.filter((w) => !inWindow(w.schedule, now)).map((w) => w.id));
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Incremented when a gesture is rejected so RGL re-syncs from the stored layout.
  const [bounce, setBounce] = useState(0);

  // --- Hover-to-swap (like phone home screens): hold a dragged tile over another for a moment and they trade places.
  const SWAP_DWELL_MS = (window as unknown as { __swapDwellMs?: number }).__swapDwellMs ?? 750;
  const dragOrigin = useRef<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const hoverTarget = useRef<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Where the hovered tile would go if we swapped now; `ok: false` means there is no room anywhere. */
  type SwapPlan = { targetId: string; x: number; y: number; ok: boolean; resolved?: Rect[] };
  const [swapPlan, setSwapPlanState] = useState<SwapPlan | null>(null);
  const pendingSwap = useRef<SwapPlan | null>(null);
  const setSwapPlan = (p: SwapPlan | null) => {
    pendingSwap.current = p;
    setSwapPlanState(p);
  };
  const swapTarget = swapPlan?.targetId ?? null;

  /**
   * Plan a swap: the dragged tile takes the target's slot; the target goes to the dragged tile's original slot if the
   * whole arrangement fits (bystanders may be pushed down), otherwise to the nearest free spot that makes it fit,
   * otherwise nowhere (ok: false → red highlight). The resolved layout is kept so the drop applies exactly the preview.
   */
  const planSwap = (targetId: string): SwapPlan | null => {
    const origin = dragOrigin.current;
    const cur = layout?.screens.find((s) => s.id === screen.id);
    const target = cur?.widgets.find((w) => w.id === targetId);
    if (!origin || !cur || !target || !grid) return null;
    const base: Rect[] = cur.widgets.map((w) => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }));
    const aX = Math.max(0, Math.min(target.x, grid.cols - origin.w));
    const attempt = (tx: number, ty: number): Rect[] | null => {
      if (tx < 0 || ty < 0 || tx + target.w > grid.cols || ty + target.h > grid.rows) return null;
      if (target.y + origin.h > grid.rows) return null;
      const rects = base.map((r) => (r.id === origin.id ? { ...r, x: aX, y: target.y } : r.id === targetId ? { ...r, x: tx, y: ty } : { ...r }));
      return pushDown(rects, [origin.id, targetId], grid.rows);
    };
    const ox = Math.max(0, Math.min(origin.x, grid.cols - target.w));
    const first = attempt(ox, origin.y);
    if (first) return { targetId, x: ox, y: origin.y, ok: true, resolved: first };
    // Nearest spot to the original slot where the whole arrangement fits.
    const candidates: Array<{ x: number; y: number; d: number }> = [];
    for (let y = 0; y + target.h <= grid.rows; y++) for (let x = 0; x + target.w <= grid.cols; x++) candidates.push({ x, y, d: Math.abs(x - origin.x) + Math.abs(y - origin.y) });
    candidates.sort((p, q) => p.d - q.d);
    for (const c of candidates) {
      const r = attempt(c.x, c.y);
      if (r) return { targetId, x: c.x, y: c.y, ok: true, resolved: r };
    }
    return { targetId, x: target.x, y: target.y, ok: false };
  };
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = undefined;
    hoverTarget.current = null;
    setSwapPlan(null);
  };
  const onDrag = (_l: Layout[], _old: Layout, item: Layout, _ph: Layout, e: Event) => {
    const origin = dragOrigin.current;
    const el = containerRef.current;
    if (!origin || !el || !grid) return;
    // Where is the pointer, in grid cells? (With collisions prevented, `item` stays at its last free cell, so use the event.)
    const te = e as unknown as TouchEvent & MouseEvent;
    const px = te.touches?.[0]?.clientX ?? te.clientX;
    const py = te.touches?.[0]?.clientY ?? te.clientY;
    if (px === undefined || py === undefined) return;
    const rect = el.getBoundingClientRect();
    const colW = (size.width - grid.padding * 2 - grid.gap * (grid.cols - 1)) / grid.cols;
    const cx = (px - rect.left - grid.padding) / (colW + grid.gap);
    const cy = (py - rect.top - grid.padding) / (rowHeight + grid.gap);
    const target = screen.widgets.find((w) => w.id !== item.i && cx >= w.x && cx < w.x + w.w && cy >= w.y && cy < w.y + w.h);
    const id = target ? target.id : null;
    const dbg = (window as unknown as { __magicdash?: Record<string, unknown> }).__magicdash;
    if (dbg) {
      // Small ring of recent drag samples for support (window.__magicdash.dragTrace).
      const trace = (dbg.dragTrace ??= []) as unknown[];
      trace.push({ t: Date.now() % 100000, type: e.type, id, cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10 });
      if (trace.length > 40) trace.splice(0, trace.length - 40);
    }
    if (id === hoverTarget.current) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTarget.current = id;
    setSwapPlan(null);
    if (id) {
      if (SWAP_DWELL_MS <= 0) setSwapPlan(planSwap(id));
      else hoverTimer.current = setTimeout(() => setSwapPlan(planSwap(id)), SWAP_DWELL_MS);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grid = layout?.grid;
  const rowHeight = useMemo(() => {
    if (!grid || !size.height) return 100;
    return Math.max(20, (size.height - grid.padding * 2 - grid.gap * (grid.rows - 1)) / grid.rows);
  }, [grid, size.height]);

  const rglLayout = useMemo<Layout[]>(
    () =>
      screen.widgets.map((w) => {
        const m = getClientPlugin(w.pluginId)?.manifest;
        return {
          i: w.id,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          minW: m?.minSize?.w ?? 1,
          minH: m?.minSize?.h ?? 1,
          maxW: m?.maxSize?.w,
          maxH: m?.maxSize?.h,
          static: !editMode,
        };
      }),
    [screen.widgets, editMode],
  );

  if (!layout || !grid) return null;

  /**
   * Rects for collision resolution: stored positions for everyone (RGL displaces bystanders while a tile passes over
   * them and we don't want that noise), with the actor's position taken from the gesture.
   */
  const rectsFor = (next: Layout[], actorId: string) => {
    const cur = layout?.screens.find((s) => s.id === screen.id);
    if (!cur) return undefined;
    const moved = next.find((n) => n.i === actorId);
    return cur.widgets.map((w) => (w.id === actorId && moved ? { id: w.id, x: moved.x, y: moved.y, w: moved.w, h: moved.h } : { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }));
  };

  /** Drop with a swap plan: apply exactly what the preview showed. */
  const commitSwap = (plan: SwapPlan): boolean => {
    if (!plan.ok || !plan.resolved) return false;
    const resolved = plan.resolved;
    updateLayout((l) => {
      const c = l.screens.find((s) => s.id === screen.id);
      if (!c) return l;
      const widgets = applyRects(c.widgets, resolved);
      return { ...l, screens: l.screens.map((s) => (s.id === screen.id ? { ...s, widgets } : s)) };
    });
    return true;
  };

  const commit = (next: Layout[], actor: Layout) => {
    if (!editMode) return;
    updateLayout((l) => {
      const cur = l.screens.find((s) => s.id === screen.id);
      if (!cur) return l;
      const moved = next.find((n) => n.i === actor.i);
      const rects = cur.widgets.map((w) => (w.id === actor.i && moved ? { id: w.id, x: moved.x, y: moved.y, w: moved.w, h: moved.h } : { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }));
      const resolved = pushDown(rects, actor.i, l.grid.rows);
      if (!resolved) {
        setBounce((b) => b + 1); // force RGL back to the stored layout
        return l;
      }
      const widgets = applyRects(cur.widgets, resolved);
      if (widgets.every((w, i) => w === cur.widgets[i])) return l;
      return { ...l, screens: l.screens.map((s) => (s.id === screen.id ? { ...s, widgets } : s)) };
    });
  };
  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {size.width > 0 && (
        <RGL
          className="layout"
          width={size.width}
          key={bounce}
          layout={rglLayout}
          style={{ height: size.height }}
          cols={grid.cols}
          rowHeight={rowHeight}
          maxRows={grid.rows}
          margin={[grid.gap, grid.gap]}
          containerPadding={[grid.padding, grid.padding]}
          compactType={null}
          preventCollision
          isBounded
          isDraggable={editMode && active}
          isResizable={editMode && active}
          draggableCancel=".no-drag"
          resizeHandles={['se']}
          onDragStart={(_l, item) => {
            draggingRef.current = true;
            dragOrigin.current = { id: item.i, x: item.x, y: item.y, w: item.w, h: item.h };
            clearHover();
          }}
          onDrag={onDrag}
          onDragStop={(layout, _old, item) => {
            draggingRef.current = false;
            const plan = pendingSwap.current;
            clearHover();
            const dbg = (window as unknown as { __magicdash?: Record<string, unknown> }).__magicdash;
            if (plan) {
              // A planned swap either happens or, if there was no room, nothing moves at all.
              const done = plan.ok && commitSwap(plan);
              if (dbg) dbg.lastDrop = { kind: 'swap', plan, done, item: { x: item.x, y: item.y } };
              if (!done) setBounce((b) => b + 1);
              dragOrigin.current = null;
              return;
            }
            if (dbg) dbg.lastDrop = { kind: 'move', item: { x: item.x, y: item.y }, origin: dragOrigin.current };
            dragOrigin.current = null;
            commit(layout, item);
          }}
          onResizeStart={() => (draggingRef.current = true)}
          onResizeStop={(layout, _old, item) => {
            draggingRef.current = false;
            commit(layout, item);
          }}
        >
          {screen.widgets.map((w) => {
            // Preview: the swap target slides into the dragged tile's original slot.
            let preview: React.CSSProperties | undefined;
            if (swapPlan && swapPlan.targetId === w.id && swapPlan.ok) {
              const colW = (size.width - grid.padding * 2 - grid.gap * (grid.cols - 1)) / grid.cols;
              const dx = (swapPlan.x - w.x) * (colW + grid.gap);
              const dy = (swapPlan.y - w.y) * (rowHeight + grid.gap);
              preview = { transform: `translate(${dx}px, ${dy}px)`, transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)', zIndex: 25, position: 'relative' };
            }
            const swapClass = swapTarget === w.id ? (swapPlan?.ok ? 'swap-target' : 'swap-blocked') : '';
            return (
              <div key={w.id} style={hidden.has(w.id) ? { visibility: 'hidden' } : undefined}>
                <div className={`h-full w-full ${swapClass}`} style={preview ?? { transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                  <WidgetShell widget={w} screenId={screen.id} />
                </div>
              </div>
            );
          })}
        </RGL>
      )}
    </div>
  );
}
