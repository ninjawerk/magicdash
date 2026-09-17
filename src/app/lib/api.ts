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

const post = <T,>(url: string, body?: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(json<T>);

export const hostApi = {
  authStatus: () => fetch('/api/auth/status').then(json<{ configured: boolean; authenticated: boolean }>),
  login: (password: string) => post<{ ok: true }>('/api/auth/login', { password }),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
  setupPassword: (password: string) => post<{ ok: true }>('/api/auth/setup', { password }),
  changePassword: (current: string, password: string) => post<{ ok: true }>('/api/auth/password', { current, password }),
  tokens: () => fetch('/api/auth/tokens').then(json<Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string }>>),
  createToken: (name: string) => post<{ ok: true; token: string; name: string }>('/api/auth/tokens', { name }),
  revokeToken: (id: string) => fetch(`/api/auth/tokens/${id}`, { method: 'DELETE' }).then(json<{ ok: true }>),
  logs: (after = 0, level = 'debug', limit = 500) =>
    fetch(`/api/logs?after=${after}&level=${level}&limit=${limit}`).then(json<{ entries: Array<{ seq: number; ts: string; level: string; msg: string }>; latest: number; total: number }>),
  updateStatus: () =>
    fetch('/api/update/status').then(
      json<{
        version: string;
        git: { available: boolean; branch?: string; commit?: string; dirty?: boolean; behind?: number; remoteCommit?: string; fetchError?: string; error?: string };
        latestRelease: { tag: string; name: string; publishedAt: string; url: string; notes?: string } | null;
        updateAvailable: boolean;
        running: boolean;
        prod: boolean;
      }>,
    ),
  runUpdate: () => post<{ ok: true; started: boolean }>('/api/update/run'),
  restart: () => post<{ ok: true; prod: boolean }>('/api/system/restart'),
  display: () =>
    fetch('/api/display').then(
      json<{
        state: { on: boolean; brightness: number; hardware: { backlight: boolean; power: boolean }; reason?: string };
        settings: { schedule: { enabled: boolean; offAt: string; onAt: string; days?: number[] }; presenceEntities: string[]; wakeSeconds: number; stayOnWhilePresent: boolean; brightness: number };
        manual: { on?: boolean; until: string | null } | null;
      }>,
    ),
  setDisplay: (b: { on?: boolean; brightness?: number; forSeconds?: number; clear?: boolean }) => post<{ ok: true }>('/api/display', b),
  saveDisplaySettings: (s: unknown) => fetch('/api/display/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) }).then(json<{ ok: true }>),
  notify: (t: { message: string; title?: string; level?: string; durationSec?: number; icon?: string }) => post<{ ok: true }>('/api/notify', t),
  devices: () =>
    fetch('/api/devices').then(
      json<Array<{ id: string; name: string; online: boolean; firstSeen: string; lastSeen: string; ip?: string; userAgent?: string; viewport?: { width: number; height: number }; currentScreen?: string; appVersion?: string; config: { screens?: string[]; rotation?: { enabled: boolean; intervalSec: number }; brightness?: number; power?: 'auto' | 'on' | 'off' } }>>,
    ),
  updateDevice: (id: string, body: { name?: string; config?: unknown }) => fetch(`/api/devices/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(json<{ ok: true }>),
  forgetDevice: (id: string) => fetch(`/api/devices/${id}`, { method: 'DELETE' }).then(json<{ ok: true }>),
  deviceAction: (id: string, action: 'identify' | 'reload' | 'show', screenId?: string) => post<{ ok: true }>(`/api/devices/${id}/action`, { action, screenId }),
  systemInfo: () =>
    fetch('/api/system/info').then(
      json<{ version: string; node: string; platform: string; hostname: string; uptimeSec: number; systemUptimeSec: number; memory: { total: number; free: number; rss: number }; load: number[]; cpuTemp?: number; prod: boolean; cwd: string }>,
    ),
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
  health: () => fetch('/api/health').then(json<{ ok: boolean; version: string; sdkVersion: number; clients: number; plugins: string[]; publicUrl: string; dataDir: string; addresses: string[] }>),
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
  listWallpapers: () => fetch('/api/wallpapers').then(json<Array<{ file: string; url: string; bytes: number }>>),
  uploadWallpaper: (file: File) =>
    fetch(`/api/wallpapers?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } }).then(json<{ file: string; url: string; bytes: number }>),
  deleteWallpaper: (file: string) => fetch(`/api/wallpapers/${encodeURIComponent(file)}`, { method: 'DELETE' }).then(json<{ ok: true }>),
  importBackup: (backup: unknown, opts: { layout: boolean; settings: boolean }) =>
    fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backup, ...opts }) }).then(
      json<{ ok: true; layout: boolean; settings: string[]; files: number }>,
    ),
};
