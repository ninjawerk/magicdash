import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DashboardLayout } from '../src/sdk/types';
import { DATA_DIR, layoutStore, settingsStore } from './storage';
import { allPlugins, setPluginSettings } from './plugins';
import { broadcast } from './events';

export interface Backup {
  magicdash: 1;
  exportedAt: string;
  includesSecrets: boolean;
  layout: DashboardLayout;
  /** Plugin-wide settings keyed by plugin id. Secret fields are omitted when includesSecrets is false. */
  settings: Record<string, Record<string, unknown>>;
  /** Small text files under data/plugins/<id>/ (e.g. OAuth tokens), keyed by relative path. */
  pluginFiles: Record<string, string>;
}

const MAX_FILE = 512 * 1024;

function secretKeys(pluginId: string): Set<string> {
  const m = allPlugins().find((p) => p.manifest.id === pluginId)?.manifest;
  return new Set((m?.settings ?? []).filter((f) => f.type === 'string' && f.secret).map((f) => f.key));
}

async function collectPluginFiles(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const root = path.join(DATA_DIR, 'plugins');
  let plugins: string[] = [];
  try {
    plugins = await fs.readdir(root);
  } catch {
    return out;
  }
  for (const id of plugins) {
    const dir = path.join(root, id);
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!/\.(json|txt|ics|md)$/i.test(f)) continue;
      const full = path.join(dir, f);
      const st = await fs.stat(full);
      if (!st.isFile() || st.size > MAX_FILE) continue;
      out[`${id}/${f}`] = await fs.readFile(full, 'utf8');
    }
  }
  return out;
}

export async function createBackup(includeSecrets: boolean): Promise<Backup> {
  const settings: Backup['settings'] = {};
  for (const [id, values] of Object.entries(settingsStore.get())) {
    const secrets = secretKeys(id);
    settings[id] = Object.fromEntries(Object.entries(values).filter(([k]) => includeSecrets || !secrets.has(k)));
  }
  return {
    magicdash: 1,
    exportedAt: new Date().toISOString(),
    includesSecrets: includeSecrets,
    layout: layoutStore.get(),
    settings,
    pluginFiles: includeSecrets ? await collectPluginFiles() : {},
  };
}

export function validateBackup(b: unknown): b is Backup {
  if (!b || typeof b !== 'object') return false;
  const x = b as Partial<Backup>;
  return x.magicdash === 1 && !!x.layout && x.layout.version === 1 && Array.isArray(x.layout.widgets) && !!x.layout.grid && typeof x.settings === 'object';
}

export interface RestoreOptions {
  layout: boolean;
  settings: boolean;
}

export async function restoreBackup(b: Backup, opts: RestoreOptions): Promise<{ layout: boolean; settings: string[]; files: number }> {
  const result = { layout: false, settings: [] as string[], files: 0 };
  if (opts.layout) {
    await layoutStore.set(b.layout);
    broadcast({ plugin: '$host', event: 'layout', payload: b.layout });
    result.layout = true;
  }
  if (opts.settings) {
    for (const [id, values] of Object.entries(b.settings ?? {})) {
      const prev = settingsStore.get()[id] ?? {};
      // Keep existing secrets when the backup was exported without them.
      const secrets = secretKeys(id);
      const merged = { ...values };
      if (!b.includesSecrets) for (const k of secrets) if (prev[k] !== undefined && merged[k] === undefined) merged[k] = prev[k];
      await setPluginSettings(id, merged);
      broadcast({ plugin: '$host', event: 'settings', payload: { pluginId: id } });
      result.settings.push(id);
    }
    for (const [rel, content] of Object.entries(b.pluginFiles ?? {})) {
      const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
      if (safe.includes('..') || path.isAbsolute(safe) || safe.split(/[/\\]/).length !== 2) continue;
      const full = path.join(DATA_DIR, 'plugins', safe);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, { mode: 0o600 });
      result.files++;
    }
  }
  return result;
}
