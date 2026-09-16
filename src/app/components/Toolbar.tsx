import { useEffect, useState } from 'react';
import { Check, DatabaseBackup, Layers, LayoutGrid, MonitorSmartphone, PackagePlus, Palette, Pencil, Pin, Plus, Puzzle, Shield } from 'lucide-react';
import { hostApi } from '../lib/api';
import { useT } from '@sdk/i18n';
import { listClientPlugins } from '../lib/registry';
import { useStore } from '../lib/store';

/**
 * A tiny control that stays out of the way on a kiosk:
 *  - hidden until the pointer moves / screen is tapped
 *  - keyboard: "e" toggles edit mode, Escape leaves it
 */
export function Toolbar() {
  const { editMode, setEditMode, setDialog, dialog, layout, activeScreenId, showScreen, attention, auth } = useStore();
  const t = useT('host');
  /** Entering edit mode requires the admin password; the kiosk view itself stays open. */
  const enterEdit = () => {
    if (auth.authenticated) setEditMode(true);
    else setDialog({ kind: 'login' });
  };
  const screens = layout?.screens ?? [];
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
      if (e.key === 'e' && dialog.kind === 'none') (editMode ? setEditMode(false) : enterEdit());
      if (e.key === 'Escape' && dialog.kind === 'none') setEditMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, setEditMode, dialog.kind, auth.authenticated]);

  const configurable = listClientPlugins().filter((p) => (p.manifest.settings?.length ?? 0) > 0);

  return (
    <>
      {/* Screen tabs (edit mode) or indicator dots (viewing) */}
      {screens.length > 1 && (
        <div
          className={`fixed left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
            editMode ? 'top-2 surface-glass flex items-center gap-1 rounded-2xl border border-white/10 p-1 shadow-2xl' : 'top-2 flex items-center gap-2 rounded-full px-3 py-1'
          } ${visible || editMode || attention ? 'opacity-100' : 'opacity-40'}`}
        >
          {editMode
            ? screens.map((sc) => (
                <button key={sc.id} className={`btn py-1.5 ${sc.id === activeScreenId ? 'btn-primary' : 'btn-ghost'}`} onClick={() => showScreen(sc.id)} title={`${sc.widgets.length} tiles`}>
                  {sc.name}
                </button>
              ))
            : screens.map((sc) => (
                <button
                  key={sc.id}
                  aria-label={sc.name}
                  onClick={() => showScreen(sc.id)}
                  className={`h-2.5 rounded-full transition-all ${sc.id === activeScreenId ? 'w-6 bg-[var(--accent)]' : 'w-2.5 bg-white/30 hover:bg-white/60'}`}
                />
              ))}
          {editMode && (
            <button className="btn btn-ghost py-1.5" onClick={() => setDialog({ kind: 'screens' })} title="Manage screens & rotation">
              <Layers size={16} />
            </button>
          )}
          {!editMode && attention && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]" title={attention.reason}>
              <Pin size={10} /> {attention.pluginId}
            </span>
          )}
        </div>
      )}
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-1 surface-glass rounded-2xl border border-white/10 p-1.5 shadow-2xl transition-all duration-300 ${
        visible || editMode ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      {editMode ? (
        <>
          <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'add' })} title="Add widget">
            <Plus size={16} /> {t('toolbar.add')}
          </button>
          {screens.length <= 1 && (
            <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'screens' })} title="Screens & rotation">
              <Layers size={16} /> {t('toolbar.screens')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setDialog({ kind: 'theme' })} title="Appearance & grid">
            <Palette size={16} /> {t('toolbar.theme')}
          </button>
          <div className="relative">
            <button className="btn btn-ghost" onClick={() => setPluginsOpen((o) => !o)} title="Plugin settings">
              <Puzzle size={16} /> {t('toolbar.plugins')}
            </button>
            {pluginsOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-60 surface rounded-xl border border-white/10 p-1 shadow-2xl" onMouseLeave={() => setPluginsOpen(false)}>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 border-b border-white/10 mb-1"
                  onClick={() => {
                    setPluginsOpen(false);
                    setDialog({ kind: 'install' });
                  }}
                >
                  <PackagePlus size={14} /> Install a plugin…
                </button>
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
              <MonitorSmartphone size={16} /> {t('toolbar.remote')}
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
            <DatabaseBackup size={16} /> {t('toolbar.backup')}
          </button>
          <button className="btn btn-primary" onClick={() => setEditMode(false)} title="Done (Esc)">
            <Check size={16} /> {t('toolbar.done')}
          </button>
        </>
      ) : (
        <>
          <button className="btn btn-ghost" onClick={enterEdit} title="Edit layout (E)">
            <Pencil size={16} />
            <span className="hidden sm:inline">{t('toolbar.edit')}</span>
          </button>
          <a className="btn btn-ghost" href="/admin" title="Admin panel">
            <Shield size={16} />
            <span className="hidden sm:inline">{t('toolbar.admin')}</span>
          </a>
        </>
      )}
      {editMode && (
        <div className="hidden md:flex items-center gap-1 pl-2 pr-1 text-[10px] uppercase tracking-wider text-white/40">
          <LayoutGrid size={12} /> drag · resize from corner
        </div>
      )}
    </div>
    </>
  );
}
