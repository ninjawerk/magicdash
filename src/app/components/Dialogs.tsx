import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ExternalLink, FolderOpen, Loader2, PackagePlus, Plus, RefreshCw, Search, Settings2, ShieldAlert, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { subscribeEvents } from '@sdk/client';
import { useT } from '@sdk/i18n';
import { defaultsFor, type ConfigField, type DashboardLayout, type TileLook } from '@sdk';
import { hostApi } from '../lib/api';
import { getClientPlugin, listClientPlugins } from '../lib/registry';
import { useStore } from '../lib/store';
import { Modal } from './Modal';
import { SchemaForm } from './SchemaForm';
import { ThemeDialog, LOCALE_FIELDS } from './ThemeDialog';
import { ConfirmButton } from './ConfirmButton';
export { LOCALE_FIELDS };

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
    case 'install':
      return <InstallPluginDialog onClose={close} />;
    case 'screens':
      return <ScreensDialog onClose={close} />;
    case 'login':
      return <LoginDialog onClose={close} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------

export function AddWidgetDialog({ onClose }: { onClose: () => void }) {
  const { addWidget, setDialog } = useStore();
  const plugins = listClientPlugins();
  return (
    <Modal
      title="Add a widget"
      subtitle="Pick a plugin. You can add the same plugin several times with different settings."
      onClose={onClose}
      width={680}
      footer={
        <button className="btn btn-default mr-auto" onClick={() => setDialog({ kind: 'install' })}>
          <PackagePlus size={14} /> Browse & install plugins…
        </button>
      }
    >
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

export function WidgetSettingsDialog({ widgetId, onClose }: { widgetId: string; onClose: () => void }) {
  const { getWidget, updateWidget, apiFor, setDialog } = useStore();
  const widget = getWidget(widgetId)?.widget;
  const plugin = widget ? getClientPlugin(widget.pluginId) : undefined;
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...defaultsFor(plugin?.manifest.widgetConfig), ...(widget?.config ?? {}) });
  const [title, setTitle] = useState(widget?.title ?? '');
  const [look, setLook] = useState<Record<string, unknown>>({ ...(widget?.look ?? {}) });
  const [sched, setSched] = useState<Record<string, unknown>>({
    mode: widget?.schedule?.from ? 'window' : 'always',
    from: widget?.schedule?.from,
    to: widget?.schedule?.to,
    days: widget?.schedule?.days?.map(String) ?? [],
  });

  if (!widget || !plugin) return null;
  const fields = plugin.manifest.widgetConfig ?? [];
  const hasGlobal = (plugin.manifest.settings?.length ?? 0) > 0;

  const save = () => {
    const days = (sched.days as string[]).map(Number);
    const schedule =
      sched.mode === 'window' && sched.from && sched.to
        ? { from: String(sched.from), to: String(sched.to), days: days.length ? days : undefined }
        : days.length && days.length < 7
          ? { days }
          : undefined;
    const cleaned = Object.fromEntries(Object.entries(look).filter(([, v]) => v !== undefined && v !== '' && v !== false && v !== null)) as TileLook;
    updateWidget(widget.id, { config: draft, title: title.trim() || undefined, schedule, look: Object.keys(cleaned).length ? cleaned : undefined });
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
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/50">Look</h3>
          <p className="mb-3 text-xs text-white/45">Overrides for this tile only. Leave empty to follow the theme.</p>
          <SchemaForm fields={LOOK_FIELDS} value={look} onChange={setLook} api={apiFor(plugin.manifest.id)} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">Visibility</h3>
          <SchemaForm fields={SCHEDULE_FIELDS} value={sched} onChange={setSched} api={apiFor(plugin.manifest.id)} />
        </div>
      </div>
    </Modal>
  );
}

const LOOK_FIELDS: ConfigField[] = [
  { key: 'background', label: 'Tile background', type: 'string', placeholder: 'e.g. linear-gradient(135deg, var(--accent), transparent)', help: 'Any CSS background. Tokens: var(--accent) var(--cool) var(--warm) var(--fg) var(--tile-bg).' },
  { key: 'border', label: 'Border', type: 'string', placeholder: 'e.g. 2px solid var(--accent)', help: 'CSS border shorthand, or "none".' },
  { key: 'radius', label: 'Corner radius', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'shadow', label: 'Shadow', type: 'select', options: [{ value: 'none', label: 'None' }, { value: 'soft', label: 'Soft' }, { value: 'lifted', label: 'Lifted' }, { value: 'hard', label: 'Hard offset' }, { value: 'glow', label: 'Accent glow' }] },
  { key: 'blur', label: 'Frosted blur', type: 'number', min: 0, max: 40, unit: 'px' },
  { key: 'opacity', label: 'Opacity', type: 'number', min: 10, max: 100, step: 5, unit: '%' },
  { key: 'hideTitle', label: 'Hide the title on this tile', type: 'boolean' },
];

const DAY_OPTIONS = [
  { label: 'Mon', value: '1' },
  { label: 'Tue', value: '2' },
  { label: 'Wed', value: '3' },
  { label: 'Thu', value: '4' },
  { label: 'Fri', value: '5' },
  { label: 'Sat', value: '6' },
  { label: 'Sun', value: '0' },
];
const SCHEDULE_FIELDS: ConfigField[] = [
  {
    key: 'mode',
    label: 'Show this',
    type: 'select',
    default: 'always',
    options: [
      { label: 'Always', value: 'always' },
      { label: 'Only between two times', value: 'window' },
    ],
  },
  { key: 'from', label: 'From', type: 'time', showWhen: { key: 'mode', equals: 'window' } },
  { key: 'to', label: 'Until', type: 'time', showWhen: { key: 'mode', equals: 'window' }, help: 'May pass midnight, e.g. 22:00 → 06:00.' },
  { key: 'days', label: 'Only on these days (empty = every day)', type: 'multiselect', options: DAY_OPTIONS },
];

// ---------------------------------------------------------------------------

export function PluginSettingsDialog({ pluginId, onClose }: { pluginId: string; onClose: () => void }) {
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


// ---------------------------------------------------------------------------

interface BackupFile {
  magicdash: 1;
  exportedAt: string;
  includesSecrets: boolean;
  layout: DashboardLayout;
  settings: Record<string, Record<string, unknown>>;
  pluginFiles?: Record<string, string>;
}

export function BackupDialog({ onClose }: { onClose: () => void }) {
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
      if (data?.magicdash !== 1 || !(data.layout?.screens || data.layout?.widgets)) throw new Error('Not a MagicDash backup file.');
      setFile({ name: f.name, data });
    } catch (e) {
      setFileError((e as Error).message);
    }
  };

  const restore = async () => {
    if (!file) return;
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
                  Exported {new Date(d.exportedAt).toLocaleString()} · {d.layout.screens ? d.layout.screens.reduce((n, sc) => n + sc.widgets.length, 0) : (d.layout.widgets?.length ?? 0)} tiles · {Object.keys(d.settings ?? {}).length} plugins configured ·{' '}
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
              <ConfirmButton className="btn btn-danger" armedClassName="btn bg-red-500/50 text-red-50 border border-red-400/50" disabled={busy || (!restoreLayout && !restoreSettings)} confirmLabel="Tap again to replace current data" onConfirm={restore}>
                {busy && <Loader2 className="animate-spin" size={14} />} Restore — replaces current data
              </ConfirmButton>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

type InstalledPlugin = { id: string; name: string; version?: string; source: 'bundled' | 'custom'; loaded: boolean; incompatible?: string };

async function readFolder(list: FileList): Promise<Array<{ path: string; content: string; encoding?: 'utf8' | 'base64' }>> {
  const files: Array<{ path: string; content: string; encoding?: 'utf8' | 'base64' }> = [];
  for (const f of Array.from(list)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (rel.split('/').some((seg) => seg.startsWith('.') || seg === 'node_modules')) continue;
    const binary = /\.(png|jpe?g|webp|gif|ico|woff2?)$/i.test(rel);
    if (binary) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      buf.forEach((b) => (bin += String.fromCharCode(b)));
      files.push({ path: rel, content: btoa(bin), encoding: 'base64' });
    } else {
      files.push({ path: rel, content: await f.text(), encoding: 'utf8' });
    }
  }
  return files;
}

type CatalogItem = Awaited<ReturnType<typeof hostApi.catalog>>['items'][number];

export function InstallPluginDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'browse' | 'upload' | 'installed'>('browse');
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof hostApi.catalog>>>();
  const [catalogError, setCatalogError] = useState<string>();
  const [query, setQuery] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesDraft, setSourcesDraft] = useState<string[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [enabled, setEnabled] = useState<{ enabled: boolean; prod: boolean }>();
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [log, setLog] = useState<string[]>([]);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'building' | 'restarting' | 'done' | 'dev-done'>('idle');
  const [pendingRebuild, setPendingRebuild] = useState(false);

  const refresh = () => hostApi.installedPlugins().then(setInstalled).catch(() => undefined);
  const loadCatalog = (force = false) => {
    setCatalogError(undefined);
    hostApi
      .catalog(force)
      .then((c) => {
        setCatalog(c);
        setSourcesDraft(c.sources.map((x) => x.url));
      })
      .catch((e) => setCatalogError((e as Error).message));
  };
  useEffect(() => {
    refresh();
    loadCatalog();
    hostApi.uploadEnabled().then(setEnabled).catch(() => setEnabled({ enabled: false, prod: false }));
  }, []);

  const installFromCatalog = async (item: CatalogItem) => {
    setError(undefined);
    setStage('uploading');
    setBusy('Downloading & verifying…');
    try {
      const r = await hostApi.installFromCatalog(item.id, item.installedVersion !== undefined);
      setLog((l) => [...l, `Verified SHA-256 and installed ${r.name ?? r.id} v${r.version ?? ''}`]);
      await refresh();
      loadCatalog();
      setPendingRebuild(true);
      await runRebuild();
    } catch (e) {
      setStage('idle');
      setBusy(undefined);
      setError((e as Error).message);
    }
  };
  useEffect(
    () =>
      subscribeEvents((ev) => {
        if (ev.plugin !== '$host') return;
        if (ev.event === 'build') setLog((l) => [...l.slice(-200), (ev.payload as { line: string }).line]);
        if (ev.event === 'restarting') setStage('restarting');
      }),
    [],
  );

  const waitForServer = async () => {
    // The server exits after a build in production; poll until it's back, then reload to pick up the new bundle.
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < 90; i++) {
      try {
        await hostApi.health();
        window.location.reload();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setError('The server did not come back. Check: journalctl -u magicdash -e');
  };

  const runRebuild = async () => {
    setError(undefined);
    setLog([]);
    setStage('building');
    setBusy('Building…');
    try {
      const r = await hostApi.rebuild();
      setPendingRebuild(false);
      if (r.restarting) {
        setStage('restarting');
        setBusy('Restarting server…');
        await waitForServer();
      } else {
        setStage('dev-done');
        setBusy(undefined);
      }
    } catch (e) {
      setStage('idle');
      setBusy(undefined);
      setError((e as Error).message);
    }
  };

  const afterInstall = async (r: { id: string; name?: string; files: number; replaced: boolean }) => {
    setLog((l) => [...l, `Installed ${r.name ?? r.id} (${r.files} files${r.replaced ? ', replaced' : ''}) to plugins/${r.id}/`]);
    await refresh();
    setPendingRebuild(true);
    await runRebuild();
  };

  const onZip = async (f: File | undefined) => {
    if (!f) return;
    setError(undefined);
    setStage('uploading');
    setBusy('Uploading…');
    try {
      await afterInstall(await hostApi.installPluginZip(f, replace));
    } catch (e) {
      setStage('idle');
      setBusy(undefined);
      setError((e as Error).message);
    }
  };
  const onFolder = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(undefined);
    setStage('uploading');
    setBusy('Uploading…');
    try {
      const files = await readFolder(list);
      await afterInstall(await hostApi.installPluginFiles(files, replace));
    } catch (e) {
      setStage('idle');
      setBusy(undefined);
      setError((e as Error).message);
    }
  };
  const remove = async (p: InstalledPlugin) => {
    setError(undefined);
    try {
      await hostApi.removePlugin(p.id);
      await refresh();
      setLog((l) => [...l, `Removed plugins/${p.id}/`]);
      setPendingRebuild(true);
      await runRebuild();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const custom = installed.filter((p) => p.source === 'custom');
  const working = !!busy;

  const q = query.trim().toLowerCase();
  const items = (catalog?.items ?? []).filter(
    (it) => !q || it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q) || it.author.toLowerCase().includes(q) || it.tags?.some((t) => t.toLowerCase().includes(q)),
  );
  const updates = (catalog?.items ?? []).filter((it) => it.updateAvailable).length;

  return (
    <Modal title="Plugins" subtitle="Browse the catalog, upload your own, or manage what's installed." onClose={onClose} width={720}>
      <div className="mb-5 flex gap-1 rounded-xl bg-white/5 p-1">
        {(
          [
            ['browse', 'Browse catalog'],
            ['upload', 'Upload'],
            ['installed', `Installed${updates ? ` · ${updates} update${updates === 1 ? '' : 's'}` : ''}`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === k ? 'bg-[var(--accent)] text-[#0b0f17]' : 'hover:bg-white/10'}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {(error || busy || log.length > 0 || stage === 'dev-done' || (pendingRebuild && !working)) && (
        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {error && <p className="text-xs text-red-300 whitespace-pre-wrap">{error}</p>}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-white/70">
              <Loader2 className="animate-spin" size={14} /> {busy}
            </p>
          )}
          {stage === 'dev-done' && (
            <p className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30 p-3 text-xs text-emerald-100">
              Built. You’re running the dev server, so restart <code className="font-mono">npm run dev</code> to load the plugin’s backend, then reload this page.
            </p>
          )}
          {pendingRebuild && !working && stage !== 'dev-done' && (
            <button className="btn btn-default mt-2" onClick={runRebuild}>
              Rebuild & restart now
            </button>
          )}
          {log.length > 0 && <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap">{log.join('\n')}</pre>}
        </div>
      )}

      {tab === 'browse' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input className="input pl-9" placeholder="Search plugins… (name, tag, author)" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button className="btn btn-ghost p-2" title="Refresh catalog" onClick={() => loadCatalog(true)}>
              <RefreshCw size={16} />
            </button>
            <button className="btn btn-ghost px-2 py-2 text-xs" onClick={() => setSourcesOpen((o) => !o)}>
              Sources
            </button>
          </div>
          {sourcesOpen && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <p className="text-xs text-white/50">
                Each source is a JSON index the dashboard downloads and searches locally — a GitHub repo’s raw file, a gist, or your own URL. The first source
                wins when two list the same plugin id.
              </p>
              {sourcesDraft.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input font-mono text-xs" value={u} onChange={(e) => setSourcesDraft(sourcesDraft.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button className="btn btn-ghost px-2" onClick={() => setSourcesDraft(sourcesDraft.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn btn-default text-xs" onClick={() => setSourcesDraft([...sourcesDraft, ''])}>
                  <Plus size={12} /> Add source
                </button>
                <button
                  className="btn btn-primary text-xs"
                  onClick={async () => {
                    await hostApi.setCatalogSources(sourcesDraft.filter(Boolean));
                    setSourcesOpen(false);
                    loadCatalog(true);
                  }}
                >
                  Save sources
                </button>
              </div>
              {catalog?.sources.some((x) => x.error) && (
                <ul className="text-xs text-amber-200">
                  {catalog.sources.filter((x) => x.error).map((x) => (
                    <li key={x.url}>Couldn’t load {x.url}: {x.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {catalogError && <p className="text-xs text-red-300">{catalogError}</p>}
          {!catalog && !catalogError && (
            <p className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="animate-spin" size={14} /> Loading catalog…
            </p>
          )}
          {catalog && items.length === 0 && <p className="text-sm text-white/40">{q ? 'No plugins match.' : 'The catalog is empty or unreachable.'}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                {it.screenshot && <img src={it.screenshot} alt="" className="h-28 w-full rounded-lg object-cover" loading="lazy" />}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{it.name}</div>
                    <div className="text-xs text-white/45 truncate">
                      by {it.author} · v{it.version}
                      {it.installedVersion ? ` · installed v${it.installedVersion}` : ''}
                    </div>
                  </div>
                  {it.reviewed ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300" title="A catalog maintainer has read this version's code.">
                      <ShieldCheck size={11} /> reviewed
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200" title="Listed but not read by the catalog maintainers. Runs code on your device.">
                      <ShieldAlert size={11} /> unreviewed
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/65 line-clamp-3">{it.description}</p>
                {it.tags && it.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {it.tags.map((t) => (
                      <button key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10" onClick={() => setQuery(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <a className="btn btn-ghost px-2 py-1 text-xs" href={`https://github.com/${it.repo}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} /> Source
                  </a>
                  <span className="ml-auto" />
                  {it.bundled ? (
                    <span className="text-xs text-white/40">bundled</span>
                  ) : it.incompatible ? (
                    <span className="text-xs text-amber-200" title={it.incompatible}>
                      {it.incompatible}
                    </span>
                  ) : it.installedVersion && !it.updateAvailable ? (
                    <span className="text-xs text-emerald-300">installed</span>
                  ) : (
                    it.reviewed ? (
                    <button className="btn btn-primary px-3 py-1 text-xs" disabled={working || enabled?.enabled === false} onClick={() => installFromCatalog(it)}>
                      <Download size={12} /> {it.updateAvailable ? `Update to v${it.version}` : 'Install'}
                    </button>
                    ) : (
                    <ConfirmButton className="btn btn-primary px-3 py-1 text-xs" armedClassName="btn px-3 py-1 text-xs bg-amber-500/30 text-amber-50 border border-amber-400/40" disabled={working || enabled?.enabled === false} confirmLabel="Unreviewed — install anyway?" onConfirm={() => installFromCatalog(it)}>
                      <Download size={12} /> {it.updateAvailable ? `Update to v${it.version}` : 'Install'}
                    </ConfirmButton>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/35">
            Installing runs the plugin’s code on this device. Every entry is pinned to a release file and its SHA-256, which is verified before install. “Reviewed”
            means a catalog maintainer has read that version; “unreviewed” means it is listed on trust alone.
          </p>
        </div>
      )}

      {tab === 'upload' && (
      <div className="space-y-6">
        {enabled && !enabled.enabled && (
          <p className="rounded-lg bg-amber-500/10 border border-amber-400/30 p-3 text-sm text-amber-100">
            Plugin upload is turned off on this server (<code className="font-mono text-xs">MAGICDASH_PLUGIN_UPLOAD=off</code>). Copy the folder into{' '}
            <code className="font-mono text-xs">plugins/</code> and rebuild instead.
          </p>
        )}

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-white/70">
            A plugin is a folder with <code className="font-mono text-xs">manifest.ts</code>, <code className="font-mono text-xs">client.tsx</code> and optionally{' '}
            <code className="font-mono text-xs">server.ts</code>. Share one with <code className="font-mono text-xs">npm run pack-plugin &lt;id&gt;</code>. Only install plugins you
            trust — they run on this machine.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className={`btn btn-primary ${working || enabled?.enabled === false ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}`}>
              <Upload size={14} /> Upload .zip
              <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onZip(e.target.files?.[0])} />
            </label>
            <label className={`btn btn-default ${working || enabled?.enabled === false ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}`}>
              <FolderOpen size={14} /> Upload folder
              <input
                type="file"
                className="hidden"
                // @ts-expect-error non-standard but supported by Chromium/Safari/Firefox
                webkitdirectory=""
                multiple
                onChange={(e) => onFolder(e.target.files)}
              />
            </label>
            <label className="ml-auto flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input type="checkbox" className="accent-[var(--accent)]" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace if already installed
            </label>
          </div>
        </section>
      </div>
      )}

      {tab === 'installed' && (
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold mb-2 text-white/70">Installed plugins</h3>
          <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
            {installed.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-xs text-white/40">
                    {p.id}
                    {p.version ? ` · v${p.version}` : ''}
                  </span>
                  {!p.loaded && !p.incompatible && <span className="ml-2 text-xs text-amber-300">not loaded yet — rebuild & restart</span>}
                  {p.incompatible && <span className="ml-2 text-xs text-red-300">{p.incompatible}</span>}
                  {catalog?.items.find((c) => c.id === p.id)?.updateAvailable && (
                    <button className="ml-2 text-xs text-[var(--accent)] hover:underline" onClick={() => installFromCatalog(catalog.items.find((c) => c.id === p.id)!)}>
                      update to v{catalog.items.find((c) => c.id === p.id)!.version}
                    </button>
                  )}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${p.source === 'custom' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-white/5 text-white/40'}`}>
                  {p.source}
                </span>
                {p.source === 'custom' && (
                  <ConfirmButton className="btn btn-ghost p-1.5 hover:bg-red-500/20 hover:text-red-200" armedClassName="btn px-2 py-1 bg-red-500/40 text-red-50 text-xs" title="Remove" disabled={working} confirmLabel="Remove plugin?" onConfirm={() => remove(p)}>
                    <Trash2 size={14} />
                  </ConfirmButton>
                )}
              </li>
            ))}
            {installed.length === 0 && <li className="px-4 py-3 text-sm text-white/40">Loading…</li>}
          </ul>
          {custom.length === 0 && installed.length > 0 && <p className="mt-2 text-xs text-white/40">No custom plugins installed yet.</p>}
        </section>
      </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function ScreensDialog({ onClose }: { onClose: () => void }) {
  const { layout, updateLayout, addScreen, removeScreen, renameScreen, moveScreen, activeScreenId, showScreen, apiFor } = useStore();
  const [rotation, setRotation] = useState<Record<string, unknown>>({ ...(layout?.rotation ?? {}) });
  const api = apiFor('$host');
  if (!layout) return null;
  const save = () => {
    updateLayout((l) => ({ ...l, rotation: { enabled: !!rotation.enabled, intervalSec: Math.max(3, Number(rotation.intervalSec) || 30) } }));
    onClose();
  };
  return (
    <Modal
      title="Screens"
      subtitle="Several pages of tiles that rotate. Plugins can pull their screen forward when something needs you."
      onClose={onClose}
      width={600}
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
      <div className="space-y-6">
        <section>
          <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
            {layout.screens.map((sc, i) => (
              <li key={sc.id} className={`flex items-center gap-2 px-3 py-2 ${sc.id === activeScreenId ? 'bg-[var(--accent)]/10' : ''}`}>
                <span className="w-6 text-center font-mono text-xs text-white/40">{i + 1}</span>
                <input className="input py-1.5" value={sc.name} onChange={(e) => renameScreen(sc.id, e.target.value)} />
                <span className="w-16 shrink-0 text-right text-xs text-white/40">{sc.widgets.length} tiles</span>
                <button className="btn btn-ghost p-1.5" disabled={i === 0} onClick={() => moveScreen(sc.id, -1)} title="Move up">
                  <ArrowUp size={14} />
                </button>
                <button className="btn btn-ghost p-1.5" disabled={i === layout.screens.length - 1} onClick={() => moveScreen(sc.id, 1)} title="Move down">
                  <ArrowDown size={14} />
                </button>
                <button
                  className={`btn btn-ghost px-2 py-1.5 text-xs ${sc.schedule?.from ? 'text-[var(--accent)]' : ''}`}
                  title="When this screen is in rotation"
                  onClick={() => {
                    const from = prompt('Include this screen from (HH:MM, empty = always)', sc.schedule?.from ?? '');
                    if (from === null) return;
                    if (!from.trim()) return updateLayout((l) => ({ ...l, screens: l.screens.map((x) => (x.id === sc.id ? { ...x, schedule: undefined } : x)) }));
                    const to = prompt('…until (HH:MM)', sc.schedule?.to ?? '') ?? '';
                    if (!/^\d{1,2}:\d{2}$/.test(from) || !/^\d{1,2}:\d{2}$/.test(to)) return alert('Use HH:MM');
                    updateLayout((l) => ({ ...l, screens: l.screens.map((x) => (x.id === sc.id ? { ...x, schedule: { from, to } } : x)) }));
                  }}
                >
                  {sc.schedule?.from ? `${sc.schedule.from}–${sc.schedule.to}` : '⏱ always'}
                </button>
                <button className="btn btn-ghost px-2 py-1.5 text-xs" onClick={() => showScreen(sc.id)} disabled={sc.id === activeScreenId}>
                  Show
                </button>
                <ConfirmButton className="btn btn-ghost p-1.5 hover:bg-red-500/20 hover:text-red-200" armedClassName="btn px-2 py-1 bg-red-500/40 text-red-50 text-xs" disabled={layout.screens.length <= 1} title="Delete screen" confirmLabel={`Delete ${sc.widgets.length} tiles?`} onConfirm={() => removeScreen(sc.id)}>
                  <Trash2 size={14} />
                </ConfirmButton>
              </li>
            ))}
          </ul>
          <button className="btn btn-default mt-3" onClick={() => addScreen()}>
            <Plus size={14} /> Add screen
          </button>
        </section>
        <section>
          <h3 className="text-sm font-semibold mb-3 text-white/70">Rotation</h3>
          <SchemaForm
            fields={[
              { key: 'enabled', label: 'Rotate through screens automatically', type: 'boolean', help: 'Pauses while editing, while a dialog is open, and while a plugin holds attention.' },
              { key: 'intervalSec', label: 'Show each screen for', type: 'number', min: 3, max: 3600, unit: 'seconds', showWhen: { key: 'enabled', equals: true } },
            ]}
            value={rotation}
            onChange={setRotation}
            api={api}
          />
          <p className="mt-4 text-xs text-white/40">
            Attention lock: a plugin (for example the Schedule in the last minute of an event) can bring its screen forward and hold it. Only one plugin can
            hold it at a time, for at most 2 minutes, unless it lets go sooner.
          </p>
        </section>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** Sign-in prompt used by the kiosk when entering edit mode. */
export function LoginDialog({ onClose }: { onClose: () => void }) {
  const { auth, login, setEditMode } = useStore();
  const t = useT('host');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The "E" that opened this dialog would otherwise land in the focused field.
  useEffect(() => {
    const t = setTimeout(() => setPw(''), 60);
    return () => clearTimeout(t);
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    try {
      await login(pw);
      setEditMode(true);
      onClose();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t('login.title')} subtitle={auth.configured ? t('login.subtitle') : 'No admin password is set yet.'} onClose={onClose} width={420}>
      {auth.configured ? (
        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="password" autoFocus placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-xs text-red-300">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-default" onClick={onClose}>
              {t('login.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !pw}>
              {busy && <Loader2 className="animate-spin" size={14} />} {t('login.button')}
            </button>
          </div>
          <p className="text-xs text-white/40">
            Manage everything at <a className="underline" href="/admin">/admin</a>.
          </p>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-white/70">Set one in the admin panel first.</p>
          <a className="btn btn-primary" href="/admin">
            Open admin panel
          </a>
        </div>
      )}
    </Modal>
  );
}
