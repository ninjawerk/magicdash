import type { DashboardLayout } from '@sdk';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const hostApi = {
  getLayout: () => fetch('/api/layout').then(json<DashboardLayout>),
  saveLayout: (layout: DashboardLayout) =>
    fetch('/api/layout', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(layout) }).then(
      json<{ ok: true }>,
    ),
  getSettings: (pluginId: string) => fetch(`/api/settings/${pluginId}`).then(json<Record<string, unknown>>),
  saveSettings: (pluginId: string, settings: Record<string, unknown>) =>
    fetch(`/api/settings/${pluginId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    }).then(json<{ ok: true }>),
  health: () => fetch('/api/health').then(json<{ ok: boolean; plugins: string[]; publicUrl: string; dataDir: string; addresses: string[] }>),
  installedPlugins: () =>
    fetch('/api/plugins/installed').then(json<Array<{ id: string; name: string; version?: string; source: 'bundled' | 'custom'; loaded: boolean }>>),
  uploadEnabled: () => fetch('/api/plugins/upload-enabled').then(json<{ enabled: boolean; prod: boolean }>),
  installPluginFiles: (files: Array<{ path: string; content: string; encoding?: 'utf8' | 'base64' }>, replace: boolean) =>
    fetch('/api/plugins/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files, replace }) }).then(
      json<{ ok: true; id: string; name?: string; files: number; replaced: boolean; prod: boolean }>,
    ),
  installPluginZip: (zip: File, replace: boolean) =>
    fetch(`/api/plugins/install?replace=${replace ? 1 : 0}`, { method: 'POST', headers: { 'content-type': 'application/zip' }, body: zip }).then(
      json<{ ok: true; id: string; name?: string; files: number; replaced: boolean; prod: boolean }>,
    ),
  removePlugin: (id: string) => fetch(`/api/plugins/${id}`, { method: 'DELETE' }).then(json<{ ok: true; prod: boolean }>),
  rebuild: () => fetch('/api/plugins/rebuild', { method: 'POST' }).then(json<{ ok: true; restarting: boolean }>),
  catalog: (refresh = false) =>
    fetch(`/api/catalog${refresh ? '?refresh=1' : ''}`).then(
      json<{
        items: Array<{
          id: string; name: string; description: string; author: string; repo: string; version: string; download: string; sha256: string; sdkVersion: number; minHost?: string;
          tags?: string[]; screenshot?: string; reviewed?: boolean; source: string; installedVersion?: string; updateAvailable?: boolean; incompatible?: string; bundled?: boolean;
        }>;
        sources: Array<{ url: string; count: number; error?: string }>;
      }>,
    ),
  catalogSources: () => fetch('/api/catalog/sources').then(json<{ sources: string[]; defaults: string[] }>),
  setCatalogSources: (sources: string[]) =>
    fetch('/api/catalog/sources', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sources }) }).then(json<{ sources: string[] }>),
  installFromCatalog: (id: string, replace = false) =>
    fetch('/api/catalog/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, replace }) }).then(
      json<{ ok: true; id: string; name?: string; version?: string; files: number; replaced: boolean; reviewed: boolean; prod: boolean }>,
    ),
  exportUrl: (secrets: boolean) => `/api/export?secrets=${secrets ? 1 : 0}`,
  importBackup: (backup: unknown, opts: { layout: boolean; settings: boolean }) =>
    fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backup, ...opts }) }).then(
      json<{ ok: true; layout: boolean; settings: string[]; files: number }>,
    ),
};
