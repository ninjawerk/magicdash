import { useEffect, useMemo, useRef, useState } from 'react';
import RGL, { type Layout } from 'react-grid-layout';
import { useStore } from '../lib/store';
import { WidgetShell } from './WidgetShell';
import { getClientPlugin } from '../lib/registry';

export function Dashboard() {
  const { layout, editMode, updateLayout, draggingRef } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

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

  const onLayoutChange = (next: Layout[]) => {
    if (!editMode) return;
    updateLayout((l) => {
      const byId = new Map(next.map((n) => [n.i, n]));
      let changed = false;
      const widgets = l.widgets.map((w) => {
        const n = byId.get(w.id);
        if (!n) return w;
        if (n.x !== w.x || n.y !== w.y || n.w !== w.w || n.h !== w.h) {
          changed = true;
          return { ...w, x: n.x, y: n.y, w: n.w, h: n.h };
        }
        return w;
      });
      return changed ? { ...l, widgets } : l;
    });
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {size.width > 0 && (
        <RGL
          className="layout"
          width={size.width}
          layout={rglLayout}
          cols={grid.cols}
          rowHeight={rowHeight}
          maxRows={grid.rows}
          margin={[grid.gap, grid.gap]}
          containerPadding={[grid.padding, grid.padding]}
          compactType={null}
          preventCollision
          isBounded
          isDraggable={editMode}
          isResizable={editMode}
          draggableCancel=".no-drag"
          resizeHandles={['se']}
          onDragStart={() => (draggingRef.current = true)}
          onDragStop={() => (draggingRef.current = false)}
          onResizeStart={() => (draggingRef.current = true)}
          onResizeStop={() => (draggingRef.current = false)}
          onLayoutChange={onLayoutChange}
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
