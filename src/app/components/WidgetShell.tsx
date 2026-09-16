import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Settings2, Trash2, AlertTriangle, Puzzle } from 'lucide-react';
import { defaultsFor, type WidgetInstance } from '@sdk';
import { getClientPlugin } from '../lib/registry';
import { useStore } from '../lib/store';

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: undefined });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-red-200">
          <AlertTriangle />
          <p className="text-sm font-medium">Widget crashed</p>
          <p className="text-xs text-red-200/70 font-mono break-all">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function WidgetShell({ widget }: { widget: WidgetInstance }) {
  const { editMode, layout, pluginSettings, apiFor, setDialog, removeWidget } = useStore();
  const plugin = getClientPlugin(widget.pluginId);
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState({ width: 0, height: 0 });
  const [alert, setAlert] = useState(false);
  const openSettings = useCallback(() => setDialog({ kind: 'widget', widgetId: widget.id }), [setDialog, widget.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPx({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showTitle = layout?.theme.showTitles && !plugin?.manifest.frameless;
  // Manifest defaults fill in anything the tile hasn't set explicitly.
  const config = useMemo(() => ({ ...defaultsFor(plugin?.manifest.widgetConfig), ...widget.config }), [plugin, widget.config]);
  const title = widget.title ?? plugin?.manifest.name ?? widget.pluginId;

  return (
    <div className={`tile h-full w-full ${editMode ? 'editing' : ''} ${alert ? 'alert' : ''}`} data-widget-id={widget.id}>
      {showTitle && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          <span className="truncate">{title}</span>
        </div>
      )}
      <div ref={ref} className="relative flex-1 min-h-0">
        {plugin ? (
          <ErrorBoundary resetKey={JSON.stringify(widget.config)}>
            <plugin.Widget
              instanceId={widget.id}
              config={config}
              settings={pluginSettings[widget.pluginId] ?? {}}
              size={{ w: widget.w, h: widget.h, ...px }}
              editMode={editMode}
              api={apiFor(widget.pluginId)}
              openSettings={openSettings}
              setAlert={setAlert}
            />
          </ErrorBoundary>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-white/50">
            <Puzzle />
            <p className="text-sm">
              Plugin <span className="font-mono">{widget.pluginId}</span> isn't installed.
            </p>
          </div>
        )}
      </div>

      {editMode && (
        <div className="absolute inset-0 z-10 flex items-start justify-end p-2">
          <div className="no-drag surface-glass flex gap-1 rounded-lg p-1 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <button className="btn btn-ghost p-2" title="Settings" onClick={openSettings}>
              <Settings2 size={16} />
            </button>
            <button
              className="btn btn-ghost p-2 hover:bg-red-500/30 hover:text-red-200"
              title="Remove"
              onClick={() => {
                if (confirm(`Remove "${title}"?`)) removeWidget(widget.id);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-mono text-white/40">
            {plugin?.manifest.name} · {widget.w}×{widget.h}
          </div>
        </div>
      )}
    </div>
  );
}
