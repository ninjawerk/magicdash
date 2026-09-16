import { useEffect, useState } from 'react';
import { Download, FolderOpen, Loader2, Settings2, Upload } from 'lucide-react';
import { defaultsFor, type ConfigField, type DashboardLayout } from '@sdk';
import { hostApi } from '../lib/api';
import { getClientPlugin, listClientPlugins } from '../lib/registry';
import { useStore } from '../lib/store';
import { Modal } from './Modal';
import { SchemaForm } from './SchemaForm';
import { THEME_PRESETS, applyTheme, normalizeTheme, stripPreset, type Theme } from '../lib/themes';
import { Check } from 'lucide-react';

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
    case 'backup':
      return <BackupDialog onClose={close} />;
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
  { key: 'fg', label: 'Text color', type: 'color' },
  { key: 'tileBackground', label: 'Tile background', type: 'string', help: 'e.g. rgba(255,255,255,0.05)' },
  { key: 'surface', label: 'Dialog & toolbar background', type: 'color' },
  { key: 'tileRadius', label: 'Tile corner radius', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'dark', label: 'Dark theme (affects form controls)', type: 'boolean' },
  { key: 'showTitles', label: 'Show tile titles', type: 'boolean' },
];

function PresetCard({ preset, active, onPick }: { preset: (typeof THEME_PRESETS)[number]; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`group relative overflow-hidden rounded-xl border text-left transition ${active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40' : 'border-white/10 hover:border-white/30'}`}
      style={{ background: preset.background, color: preset.fg }}
    >
      <div className="flex gap-1.5 p-3 pb-2">
        <div className="h-9 flex-1 rounded-md" style={{ background: preset.tileBackground, border: `1px solid ${preset.fg}22`, borderRadius: Math.min(10, preset.tileRadius / 2) }}>
          <div className="m-2 h-1.5 w-1/2 rounded-full" style={{ background: preset.accent }} />
        </div>
        <div className="h-9 w-9 rounded-md" style={{ background: preset.tileBackground, border: `1px solid ${preset.fg}22`, borderRadius: Math.min(10, preset.tileRadius / 2) }} />
      </div>
      <div className="px-3 pb-2.5">
        <div className="text-sm font-semibold leading-tight">{preset.name}</div>
        <div className="text-[11px] opacity-60 leading-snug">{preset.description}</div>
      </div>
      {active && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: preset.accent, color: '#0b0f17' }}>
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
const GRID_FIELDS: ConfigField[] = [
  { key: 'cols', label: 'Columns', type: 'number', min: 4, max: 48 },
  { key: 'rows', label: 'Rows', type: 'number', min: 2, max: 32, help: 'The grid always fills the screen; more rows = finer control.' },
  { key: 'gap', label: 'Gap between tiles', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'padding', label: 'Screen padding', type: 'number', min: 0, max: 120, unit: 'px' },
];

function ThemeDialog({ onClose }: { onClose: () => void }) {
  const { layout, updateLayout, apiFor } = useStore();
  const original = normalizeTheme(layout?.theme);
  const [theme, setTheme] = useState<Record<string, unknown>>({ ...original });
  const [grid, setGrid] = useState<Record<string, unknown>>({ ...(layout?.grid ?? {}) });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const api = apiFor('$host');

  // Live preview while the dialog is open; revert on cancel.
  useEffect(() => {
    applyTheme(normalizeTheme(theme as Partial<Theme>));
  }, [theme]);
  const cancel = () => {
    applyTheme(original);
    onClose();
  };
  const pick = (id: string) => {
    const p = THEME_PRESETS.find((x) => x.id === id);
    if (p) setTheme({ ...stripPreset(p), showTitles: theme.showTitles ?? p.showTitles });
  };
  const changeField = (next: Record<string, unknown>) => {
    // Manual edits detach from the preset unless they only touch showTitles.
    const onlyTitles = Object.keys(next).every((k) => k === 'showTitles' || next[k] === theme[k]);
    setTheme(onlyTitles ? next : { ...next, preset: undefined });
  };
  const save = () => {
    updateLayout((l) => ({
      ...l,
      theme: normalizeTheme({ ...l.theme, ...(theme as unknown as DashboardLayout['theme']) }),
      grid: { ...l.grid, ...(grid as unknown as DashboardLayout['grid']) },
    }));
    onClose();
  };
  return (
    <Modal
      title="Appearance & grid"
      subtitle="Pick a theme, or fine-tune every colour. Changes preview live."
      onClose={cancel}
      width={720}
      footer={
        <>
          <button className="btn btn-default" onClick={cancel}>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {THEME_PRESETS.map((p) => (
              <PresetCard key={p.id} preset={p} active={theme.preset === p.id} onPick={() => pick(p.id)} />
            ))}
          </div>
          <button type="button" className="btn btn-ghost mt-3 text-xs" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide' : 'Customise colours…'}
          </button>
          {showAdvanced && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <SchemaForm fields={THEME_FIELDS} value={theme} onChange={changeField} api={api} />
            </div>
          )}
          {!showAdvanced && (
            <div className="mt-2">
              <SchemaForm fields={THEME_FIELDS.filter((f) => f.key === 'showTitles')} value={theme} onChange={changeField} api={api} />
            </div>
          )}
        </section>
        <section>
          <h3 className="text-sm font-semibold mb-3 text-white/70">Grid</h3>
          <SchemaForm fields={GRID_FIELDS} value={grid} onChange={setGrid} api={api} />
        </section>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

interface BackupFile {
  magicdash: 1;
  exportedAt: string;
  includesSecrets: boolean;
  layout: DashboardLayout;
  settings: Record<string, Record<string, unknown>>;
  pluginFiles?: Record<string, string>;
}

function BackupDialog({ onClose }: { onClose: () => void }) {
  const { reloadPluginSettings } = useStore();
  const [dataDir, setDataDir] = useState<string>();
  const [withSecrets, setWithSecrets] = useState(true);
  const [file, setFile] = useState<{ name: string; data: BackupFile } | undefined>();
  const [fileError, setFileError] = useState<string>();
  const [restoreLayout, setRestoreLayout] = useState(true);
  const [restoreSettings, setRestoreSettings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>();

  useEffect(() => {
    hostApi.health().then((h) => setDataDir(h.dataDir)).catch(() => undefined);
  }, []);

  const onPick = async (f: File | undefined) => {
    setFile(undefined);
    setFileError(undefined);
    setResult(undefined);
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as BackupFile;
      if (data?.magicdash !== 1 || !data.layout?.widgets) throw new Error('Not a MagicDash backup file.');
      setFile({ name: f.name, data });
    } catch (e) {
      setFileError((e as Error).message);
    }
  };

  const restore = async () => {
    if (!file) return;
    if (!confirm(`Replace the current ${[restoreLayout && 'layout', restoreSettings && 'plugin settings'].filter(Boolean).join(' and ')} with "${file.name}"?`)) return;
    setBusy(true);
    try {
      const r = await hostApi.importBackup(file.data, { layout: restoreLayout, settings: restoreSettings });
      await reloadPluginSettings();
      setResult(`Restored${r.layout ? ' layout' : ''}${r.settings.length ? ` · settings for ${r.settings.length} plugin${r.settings.length === 1 ? '' : 's'}` : ''}${r.files ? ` · ${r.files} plugin file${r.files === 1 ? '' : 's'}` : ''}.`);
      setFile(undefined);
    } catch (e) {
      setFileError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const d = file?.data;
  return (
    <Modal title="Backup" subtitle="Export everything to a file, or restore from one." onClose={onClose} width={600}>
      <div className="space-y-7">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <div className="flex items-start gap-3">
            <FolderOpen size={18} className="mt-0.5 shrink-0 text-white/50" />
            <div className="min-w-0">
              <p className="font-medium">Where your data lives</p>
              <p className="mt-1 text-white/60">
                Everything is stored on the server in <code className="font-mono text-xs text-white/90 select-all break-all">{dataDir ?? '…'}</code>
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-white/50">
                <li>
                  <code className="font-mono">layout.json</code> — tiles, their settings, theme and grid
                </li>
                <li>
                  <code className="font-mono">settings.json</code> — plugin-wide settings, including tokens and API keys
                </li>
                <li>
                  <code className="font-mono">plugins/&lt;id&gt;/</code> — plugin files such as the Google sign-in tokens
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2 text-white/70">Export</h3>
          <label className="flex items-start gap-3 cursor-pointer mb-3">
            <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={withSecrets} onChange={(e) => setWithSecrets(e.target.checked)} />
            <span className="text-sm">
              Include secrets (tokens, API keys, Google sign-in)
              <span className="block text-xs text-white/45">Needed for a full restore on a new Pi. Keep the file private.</span>
            </span>
          </label>
          <a className="btn btn-primary" href={hostApi.exportUrl(withSecrets)} download>
            <Download size={14} /> Download backup
          </a>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2 text-white/70">Import</h3>
          <label className="btn btn-default cursor-pointer">
            <Upload size={14} /> Choose backup file…
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          </label>
          {fileError && <p className="mt-2 text-xs text-red-300">{fileError}</p>}
          {result && <p className="mt-2 text-xs text-emerald-300">{result}</p>}
          {d && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm space-y-3">
              <div>
                <p className="font-medium truncate">{file!.name}</p>
                <p className="text-xs text-white/50">
                  Exported {new Date(d.exportedAt).toLocaleString()} · {d.layout.widgets.length} tiles · {Object.keys(d.settings ?? {}).length} plugins configured ·{' '}
                  {d.includesSecrets ? 'includes secrets' : 'no secrets (yours are kept)'}
                </p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="accent-[var(--accent)]" checked={restoreLayout} onChange={(e) => setRestoreLayout(e.target.checked)} />
                <span>Restore layout, tiles and theme</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="accent-[var(--accent)]" checked={restoreSettings} onChange={(e) => setRestoreSettings(e.target.checked)} />
                <span>Restore plugin settings{d.includesSecrets ? ' and sign-ins' : ''}</span>
              </label>
              <button className="btn btn-danger" disabled={busy || (!restoreLayout && !restoreSettings)} onClick={restore}>
                {busy && <Loader2 className="animate-spin" size={14} />} Restore — replaces current data
              </button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
