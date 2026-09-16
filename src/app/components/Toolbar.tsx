import { useEffect, useState } from 'react';
import { Check, DatabaseBackup, LayoutGrid, MonitorSmartphone, Palette, Pencil, Plus, Puzzle } from 'lucide-react';
import { hostApi } from '../lib/api';
import { listClientPlugins } from '../lib/registry';
import { useStore } from '../lib/store';

/**
 * A tiny control that stays out of the way on a kiosk:
 *  - hidden until the pointer moves / screen is tapped
 *  - keyboard: "e" toggles edit mode, Escape leaves it
 */
export function Toolbar() {
  const { editMode, setEditMode, setDialog, dialog } = useStore();
  const [visible, setVisible] = useState(true);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    if (!editMode) return;
    hostApi.health().then((h) => setAddresses(h.addresses ?? [])).catch(() => undefined);
  }, [editMode]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poke = () => {
      setVisible(true);
      document.body.classList.remove('hide-cursor');
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!editMode && dialog.kind === 'none') {
          setVisible(false);
          document.body.classList.add('hide-cursor');
        }
      }, 4000);
    };
    poke();
    window.addEventListener('pointermove', poke);
    window.addEventListener('pointerdown', poke);
    window.addEventListener('keydown', poke);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', poke);
      window.removeEventListener('pointerdown', poke);
      window.removeEventListener('keydown', poke);
    };
  }, [editMode, dialog.kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (e.key === 'e' && dialog.kind === 'none') setEditMode(!editMode);
      if (e.key === 'Escape' && dialog.kind === 'none') setEditMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, setEditMode, dialog.kind]);

  const configurable = listClientPlugins().filter((p) => (p.manifest.settings?.length ?? 0) > 0);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-1 surface-glass rounded-2xl border border-white/10 p-1.5 shadow-2xl transition-all duration-300 ${
        visible || editMode ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      {editMode ? (
        <>
          <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'add' })} title="Add widget">
            <Plus size={16} /> Add
          </button>
          <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'theme' })} title="Appearance & grid">
            <Palette size={16} /> Theme
          </button>
          <div className="relative">
            <button className="btn btn-ghost" onClick={() => setPluginsOpen((o) => !o)} title="Plugin settings">
              <Puzzle size={16} /> Plugins
            </button>
            {pluginsOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-60 surface rounded-xl border border-white/10 p-1 shadow-2xl" onMouseLeave={() => setPluginsOpen(false)}>
                {configurable.map((p) => (
                  <button
                    key={p.manifest.id}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => {
                      setPluginsOpen(false);
                      setDialog({ kind: 'plugin', pluginId: p.manifest.id });
                    }}
                  >
                    <span>{p.manifest.icon}</span> {p.manifest.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button className="btn btn-ghost" onClick={() => setRemoteOpen((o) => !o)} title="Edit from another device">
              <MonitorSmartphone size={16} /> Remote
            </button>
            {remoteOpen && (
              <div className="surface absolute bottom-full right-0 mb-2 w-80 rounded-xl border border-white/10 p-4 shadow-2xl text-sm" onMouseLeave={() => setRemoteOpen(false)}>
                <p className="font-semibold">Edit from your laptop or phone</p>
                <p className="mt-1 text-xs text-white/50">Open one of these on any device on the same network. Changes show up here instantly.</p>
                <ul className="mt-2 space-y-1">
                  {addresses.length === 0 && <li className="text-xs text-white/40">Looking up addresses…</li>}
                  {addresses.map((a) => (
                    <li key={a} className="font-mono text-xs text-white/90 select-all break-all">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'backup' })} title="Export / import">
            <DatabaseBackup size={16} /> Backup
          </button>
          <button className="btn btn-primary" onClick={() => setEditMode(false)} title="Done (Esc)">
            <Check size={16} /> Done
          </button>
        </>
      ) : (
        <button className="btn btn-ghost" onClick={() => setEditMode(true)} title="Edit layout (E)">
          <Pencil size={16} />
          <span className="hidden sm:inline">Edit</span>
        </button>
      )}
      {editMode && (
        <div className="hidden md:flex items-center gap-1 pl-2 pr-1 text-[10px] uppercase tracking-wider text-white/40">
          <LayoutGrid size={12} /> drag · resize from corner
        </div>
      )}
    </div>
  );
}
