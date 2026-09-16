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
  health: () => fetch('/api/health').then(json<{ ok: boolean; plugins: string[]; publicUrl: string; dataDir: string }>),
  exportUrl: (secrets: boolean) => `/api/export?secrets=${secrets ? 1 : 0}`,
  importBackup: (backup: unknown, opts: { layout: boolean; settings: boolean }) =>
    fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backup, ...opts }) }).then(
      json<{ ok: true; layout: boolean; settings: string[]; files: number }>,
    ),
};
