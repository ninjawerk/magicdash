import { Layers, Plus } from 'lucide-react';
import { Dashboard } from '../../components/Dashboard';
import { useStore } from '../../lib/store';

/** Live editor: the real dashboard grid in edit mode. The kiosk mirrors every change instantly. */
export function LayoutPage() {
  const { layout, activeScreenId, showScreen, setDialog, addScreen } = useStore();
  if (!layout) return null;
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {layout.screens.map((sc) => (
            <button key={sc.id} className={`btn py-1.5 ${sc.id === activeScreenId ? 'btn-primary' : 'btn-ghost'}`} onClick={() => showScreen(sc.id)}>
              {sc.name} <span className="text-[10px] opacity-60">{sc.widgets.length}</span>
            </button>
          ))}
          <button className="btn btn-ghost py-1.5" title="Add screen" onClick={() => addScreen()}>
            <Layers size={14} /> <Plus size={12} />
          </button>
        </div>
        <button className="btn btn-primary ml-auto" onClick={() => setDialog({ kind: 'add' })}>
          <Plus size={16} /> Add tile
        </button>
        <span className="text-xs text-white/40">Drag to move · drag the corner to resize · ⚙ for tile settings. Changes save automatically and show on the kiosk live.</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10" style={{ background: layout.theme.background }}>
        <Dashboard />
      </div>
    </div>
  );
}
