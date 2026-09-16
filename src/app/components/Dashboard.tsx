import { useEffect, useMemo, useRef, useState } from 'react';
import { inWindow, type Screen } from '@sdk';
import RGL, { type Layout } from 'react-grid-layout';
import { useStore } from '../lib/store';
import { WidgetShell } from './WidgetShell';
import { getClientPlugin } from '../lib/registry';
import { applyRects, pushDown } from '../lib/layoutUtils';

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
  const SWAP_DWELL_MS = 750;
  const dragOrigin = useRef<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const hoverTarget = useRef<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [swapTarget, setSwapTargetState] = useState<string | null>(null);
  const pendingSwap = useRef<string | null>(null);
  const setSwapTarget = (id: string | null) => {
    pendingSwap.current = id;
    setSwapTargetState(id);
  };
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = undefined;
    hoverTarget.current = null;
    setSwapTarget(null);
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
    if (id === hoverTarget.current) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTarget.current = id;
    setSwapTarget(null);
    if (id) hoverTimer.current = setTimeout(() => setSwapTarget(id), SWAP_DWELL_MS);
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

  /** Drop with a swap intent: dragged tile takes the target's slot, target takes the dragged tile's original slot. */
  const commitSwap = (next: Layout[], actor: Layout, targetId: string): boolean => {
    const origin = dragOrigin.current;
    const cur = layout?.screens.find((s) => s.id === screen.id);
    const target = cur?.widgets.find((w) => w.id === targetId);
    if (!origin || !cur || !target) return false;
    const rects = rectsFor(next, actor.i);
    const a = rects?.find((r) => r.id === actor.i);
    const t = rects?.find((r) => r.id === targetId);
    if (!rects || !a || !t) return false;
    a.x = target.x;
    a.y = target.y;
    t.x = origin.x;
    t.y = origin.y;
    // Keep both inside the grid.
    const cols = layout!.grid.cols;
    const rows = layout!.grid.rows;
    a.x = Math.max(0, Math.min(a.x, cols - a.w));
    t.x = Math.max(0, Math.min(t.x, cols - t.w));
    if (a.y + a.h > rows || t.y + t.h > rows) return false;
    const resolved = pushDown(rects, [actor.i, targetId], rows);
    if (!resolved) return false;
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
            const target = swapTarget ?? pendingSwap.current;
            clearHover();
            if (target && commitSwap(layout, item, target)) {
              dragOrigin.current = null;
              return;
            }
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
            if (swapTarget === w.id && dragOrigin.current) {
              const colW = (size.width - grid.padding * 2 - grid.gap * (grid.cols - 1)) / grid.cols;
              const dx = (dragOrigin.current.x - w.x) * (colW + grid.gap);
              const dy = (dragOrigin.current.y - w.y) * (rowHeight + grid.gap);
              preview = { transform: `translate(${dx}px, ${dy}px)`, transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)', zIndex: 25, position: 'relative' };
            }
            return (
              <div key={w.id} style={hidden.has(w.id) ? { visibility: 'hidden' } : undefined}>
                <div className={`h-full w-full ${swapTarget === w.id ? 'swap-target' : ''}`} style={preview ?? { transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
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
