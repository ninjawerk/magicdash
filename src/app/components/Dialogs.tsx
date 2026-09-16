import { useEffect, useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { defaultsFor, type ConfigField, type DashboardLayout } from '@sdk';
import { hostApi } from '../lib/api';
import { getClientPlugin, listClientPlugins } from '../lib/registry';
import { useStore } from '../lib/store';
import { Modal } from './Modal';
import { SchemaForm } from './SchemaForm';

export function Dialogs() {
  const { dialog, setDialog } = useStore();
  const close = () => setDialog({ kind: 'none' });
  switch (dialog.kind) {
    case 'add':
      return <AddWidgetDialog onClose={close} />;
    case 'widget':
      return <WidgetSettingsDialog widgetId={dialog.widgetId} onClose={close} />;
    case 'plugin':
      return <PluginSettingsDialog pluginId={dialog.pluginId} onClose={close} />;
    case 'theme':
      return <ThemeDialog onClose={close} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------

function AddWidgetDialog({ onClose }: { onClose: () => void }) {
  const { addWidget, setDialog } = useStore();
  const plugins = listClientPlugins();
  return (
    <Modal title="Add a widget" subtitle="Pick a plugin. You can add the same plugin several times with different settings." onClose={onClose} width={680}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
        {plugins.map((p) => (
          <div key={p.manifest.id} className="group rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none">{p.manifest.icon ?? '🧩'}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.manifest.name}</div>
                <div className="text-xs text-white/50 mt-0.5">{p.manifest.description}</div>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between pt-2">
              <span className="text-[10px] font-mono text-white/30">
                v{p.manifest.version}
                {p.manifest.author ? ` · ${p.manifest.author}` : ''}
              </span>
              <div className="flex gap-1">
                {p.manifest.settings && p.manifest.settings.length > 0 && (
                  <button className="btn btn-ghost px-2 py-1.5 text-xs" title="Plugin settings" onClick={() => setDialog({ kind: 'plugin', pluginId: p.manifest.id })}>
                    <Settings2 size={14} />
                  </button>
                )}
                <button className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => addWidget(p.manifest.id)}>
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function WidgetSettingsDialog({ widgetId, onClose }: { widgetId: string; onClose: () => void }) {
  const { layout, updateWidget, apiFor, setDialog } = useStore();
  const widget = layout?.widgets.find((w) => w.id === widgetId);
  const plugin = widget ? getClientPlugin(widget.pluginId) : undefined;
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...defaultsFor(plugin?.manifest.widgetConfig), ...(widget?.config ?? {}) });
  const [title, setTitle] = useState(widget?.title ?? '');

  if (!widget || !plugin) return null;
  const fields = plugin.manifest.widgetConfig ?? [];
  const hasGlobal = (plugin.manifest.settings?.length ?? 0) > 0;

  const save = () => {
    updateWidget(widget.id, { config: draft, title: title.trim() || undefined });
    onClose();
  };

  return (
    <Modal
      title={`${plugin.manifest.icon ?? ''} ${plugin.manifest.name}`.trim()}
      subtitle="Settings for this tile only."
      onClose={onClose}
      footer={
        <>
          {hasGlobal && (
            <button className="btn btn-ghost mr-auto" onClick={() => setDialog({ kind: 'plugin', pluginId: plugin.manifest.id })}>
              <Settings2 size={14} /> Plugin settings
            </button>
          )}
          <button className="btn btn-default" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">Tile title</label>
          <input className="input" placeholder={plugin.manifest.name} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <SchemaForm fields={fields} value={draft} onChange={setDraft} api={apiFor(plugin.manifest.id)} customFields={plugin.customFields} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function PluginSettingsDialog({ pluginId, onClose }: { pluginId: string; onClose: () => void }) {
  const { apiFor, reloadPluginSettings } = useStore();
  const plugin = getClientPlugin(pluginId);
  const [draft, setDraft] = useState<Record<string, unknown>>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    hostApi.getSettings(pluginId).then(setDraft).catch((e) => setError(e.message));
  }, [pluginId, version]);

  if (!plugin) return null;
  const api = apiFor(pluginId);
  const fields: ConfigField[] = plugin.manifest.settings ?? [];

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await hostApi.saveSettings(pluginId, draft);
      await reloadPluginSettings(pluginId);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${plugin.manifest.icon ?? ''} ${plugin.manifest.name} — plugin settings`}
      subtitle="Shared by every tile that uses this plugin. Secrets are stored on the server only."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-default" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !draft}>
            {saving && <Loader2 className="animate-spin" size={14} />} Save
          </button>
        </>
      }
    >
      {error && <p className="mb-4 rounded-lg bg-red-500/10 border border-red-400/30 p-3 text-sm text-red-200">{error}</p>}
      {!draft ? (
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Loader2 className="animate-spin" size={14} /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {plugin.SettingsPanel && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <plugin.SettingsPanel settings={draft} api={api} reload={() => setVersion((v) => v + 1)} />
            </div>
          )}
          <SchemaForm fields={fields} value={draft} onChange={setDraft} api={api} customFields={plugin.customFields} />
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

const THEME_FIELDS: ConfigField[] = [
  { key: 'background', label: 'Background', type: 'textarea', rows: 2, help: 'Any CSS background: a color, gradient or url(...).' },
  { key: 'accent', label: 'Accent color', type: 'color' },
  { key: 'tileBackground', label: 'Tile background', type: 'string', help: 'e.g. rgba(255,255,255,0.05)' },
  { key: 'tileRadius', label: 'Tile corner radius', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'showTitles', label: 'Show tile titles', type: 'boolean' },
];
const GRID_FIELDS: ConfigField[] = [
  { key: 'cols', label: 'Columns', type: 'number', min: 4, max: 48 },
  { key: 'rows', label: 'Rows', type: 'number', min: 2, max: 32, help: 'The grid always fills the screen; more rows = finer control.' },
  { key: 'gap', label: 'Gap between tiles', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'padding', label: 'Screen padding', type: 'number', min: 0, max: 120, unit: 'px' },
];

function ThemeDialog({ onClose }: { onClose: () => void }) {
  const { layout, updateLayout, apiFor } = useStore();
  const [theme, setTheme] = useState<Record<string, unknown>>({ ...(layout?.theme ?? {}) });
  const [grid, setGrid] = useState<Record<string, unknown>>({ ...(layout?.grid ?? {}) });
  const api = apiFor('$host');
  const save = () => {
    updateLayout((l) => ({
      ...l,
      theme: { ...l.theme, ...(theme as unknown as DashboardLayout['theme']) },
      grid: { ...l.grid, ...(grid as unknown as DashboardLayout['grid']) },
    }));
    onClose();
  };
  return (
    <Modal
      title="Appearance & grid"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-default" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold mb-3 text-white/70">Theme</h3>
          <SchemaForm fields={THEME_FIELDS} value={theme} onChange={setTheme} api={api} />
        </section>
        <section>
          <h3 className="text-sm font-semibold mb-3 text-white/70">Grid</h3>
          <SchemaForm fields={GRID_FIELDS} value={grid} onChange={setGrid} api={api} />
        </section>
      </div>
    </Modal>
  );
}
