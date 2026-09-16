import { useEffect, useMemo, useRef, useState } from 'react';
import RGL, { type Layout } from 'react-grid-layout';
import { useStore } from '../lib/store';
import { WidgetShell } from './WidgetShell';
import { getClientPlugin } from '../lib/registry';
import { applyRects, pushDown } from '../lib/layoutUtils';

export function Dashboard() {
  const { layout, editMode, updateLayout, draggingRef } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Incremented when a gesture is rejected so RGL re-syncs from the stored layout.
  const [bounce, setBounce] = useState(0);

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
      (layout?.widgets ?? []).map((w) => {
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
    [layout?.widgets, editMode],
  );

  if (!layout || !grid) return null;

  /**
   * Called when a drag or resize ends. `next` is RGL's layout, which may contain overlaps because we let the
   * user drop onto other tiles. We keep the moved tile where the user put it, push anything it covers
   * downward, and revert the whole gesture if that would overflow the screen.
   */
  const commit = (next: Layout[], actor: Layout) => {
    if (!editMode) return;
    updateLayout((l) => {
      const rects = next.map((n) => ({ id: n.i, x: n.x, y: n.y, w: n.w, h: n.h }));
      const resolved = pushDown(rects, actor.i, l.grid.rows);
      if (!resolved) {
        setBounce((b) => b + 1); // force RGL back to the stored layout
        return l;
      }
      const widgets = applyRects(l.widgets, resolved);
      return widgets === l.widgets || widgets.every((w, i) => w === l.widgets[i]) ? l : { ...l, widgets };
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
          preventCollision={false}
          isBounded
          isDraggable={editMode}
          isResizable={editMode}
          draggableCancel=".no-drag"
          resizeHandles={['se']}
          onDragStart={() => (draggingRef.current = true)}
          onDragStop={(layout, _old, item) => {
            draggingRef.current = false;
            commit(layout, item);
          }}
          onResizeStart={() => (draggingRef.current = true)}
          onResizeStop={(layout, _old, item) => {
            draggingRef.current = false;
            commit(layout, item);
          }}
        >
          {layout.widgets.map((w) => (
            <div key={w.id}>
              <WidgetShell widget={w} />
            </div>
          ))}
        </RGL>
      )}
    </div>
  );
}
