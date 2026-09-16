import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { SECRET_MASK, normalizeLayout, type DashboardLayout, type ConfigField } from '../src/sdk/types';
import { addSseClient, broadcast, clientCount } from './events';
import { allPlugins, getPlugin, getPluginSettings, loadPlugins, setPluginSettings, shutdownPlugins } from './plugins';
import { DATA_DIR, layoutStore, settingsStore } from './storage';
import { createBackup, restoreBackup, validateBackup } from './backup';
import { registerInstallRoutes } from './install';
import { registerCatalogRoutes } from './catalog';
import { loadAuth, registerAuthRoutes, requireAuth } from './auth';
import { installLogCapture, registerLogRoutes } from './logs';
import { registerUpdateRoutes } from './update';
import { HOST_VERSION } from './version';
import { SDK_VERSION } from '../src/sdk/types';

const PORT = Number(process.env.MAGICDASH_PORT ?? 3210);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

function detectPublicUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  // Dev: the Vite dev server proxies /api to us, so OAuth redirects go through it.
  return IS_PROD ? `http://${os.hostname()}:${PORT}` : `http://localhost:5173`;
}

/** URLs other devices on the LAN can use to open the dashboard. */
function lanAddresses(): string[] {
  const port = IS_PROD ? PORT : 5173;
  const out = [`http://${os.hostname().toLowerCase().replace(/\.local$/, '')}.local:${port}`];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(`http://${ni.address}:${port}`);
    }
  }
  return out;
}

function secretKeys(fields: ConfigField[] | undefined): Set<string> {
  return new Set((fields ?? []).filter((f) => f.type === 'string' && f.secret).map((f) => f.key));
}

async function main() {
  installLogCapture();
  await Promise.all([layoutStore.load(), settingsStore.load(), loadAuth()]);
  const publicUrl = detectPublicUrl();
  await loadPlugins(() => publicUrl);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '20mb' }));
  registerAuthRoutes(app);
  app.use(requireAuth); // everything under /api that isn't on the public allowlist needs a session or token

  // --- Core API ---------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // the kiosk waiting page polls this from file://
    res.json({
      ok: true,
      version: HOST_VERSION,
      sdkVersion: SDK_VERSION,
      clients: clientCount(),
      plugins: allPlugins().map((p) => p.manifest.id),
      publicUrl,
      dataDir: DATA_DIR,
      addresses: lanAddresses(),
    });
  });

  app.get('/api/plugins', (_req, res) => {
    res.json(allPlugins().map((p) => ({ manifest: p.manifest, hasServer: p.hasServer })));
  });

  app.get('/api/layout', (_req, res) => res.json(layoutStore.get()));

  app.put('/api/layout', async (req, res) => {
    const raw = req.body as DashboardLayout;
    if (!raw || raw.version !== 1 || !raw.grid || (!Array.isArray(raw.screens) && !Array.isArray(raw.widgets))) {
      res.status(400).json({ error: 'Invalid layout payload' });
      return;
    }
    const body = normalizeLayout(raw);
    if (body.screens.some((s) => !s.id || !Array.isArray(s.widgets))) {
      res.status(400).json({ error: 'Invalid screens' });
      return;
    }
    await layoutStore.set(body);
    broadcast({ plugin: '$host', event: 'layout', payload: body });
    res.json({ ok: true });
  });

  /** Plugin-wide settings with secrets masked. */
  app.get('/api/settings/:pluginId', (req, res) => {
    const plugin = getPlugin(req.params.pluginId);
    if (!plugin) {
      res.status(404).json({ error: 'Unknown plugin' });
      return;
    }
    const secrets = secretKeys(plugin.manifest.settings);
    const raw = getPluginSettings(plugin.manifest.id);
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      masked[k] = secrets.has(k) ? (v ? SECRET_MASK : '') : v;
    }
    res.json(masked);
  });

  /** Save plugin-wide settings. Masked secrets are left untouched. */
  app.put('/api/settings/:pluginId', async (req, res) => {
    const plugin = getPlugin(req.params.pluginId);
    if (!plugin) {
      res.status(404).json({ error: 'Unknown plugin' });
      return;
    }
    const secrets = secretKeys(plugin.manifest.settings);
    const prev = getPluginSettings(plugin.manifest.id);
    const incoming = (req.body ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...prev };
    for (const [k, v] of Object.entries(incoming)) {
      if (secrets.has(k) && v === SECRET_MASK) continue; // unchanged secret
      next[k] = v;
    }
    await setPluginSettings(plugin.manifest.id, next);
    broadcast({ plugin: '$host', event: 'settings', payload: { pluginId: plugin.manifest.id } });
    res.json({ ok: true });
  });

  app.get('/api/events', (_req, res) => addSseClient(res));

  // --- Host controls (used by the MCP server and by automations, e.g. a Home Assistant curl) --------
  /** POST /api/screens/show { screenId } — switch every connected dashboard to a screen (no lock). */
  app.post('/api/screens/show', (req, res) => {
    const { screenId } = (req.body ?? {}) as { screenId?: string };
    const screen = layoutStore.get().screens.find((s) => s.id === screenId || s.name.toLowerCase() === String(screenId).toLowerCase());
    if (!screen) {
      res.status(404).json({ error: 'No such screen' });
      return;
    }
    broadcast({ plugin: '$host', event: 'showScreen', payload: { screenId: screen.id } });
    res.json({ ok: true, screenId: screen.id });
  });

  /**
   * POST /api/attention { action: 'request' | 'release', screenId?, holder?, reason? }
   * Same lock rules as plugins: one holder, 120 s max. `holder` defaults to "api".
   */
  app.post('/api/attention', (req, res) => {
    const { action = 'request', screenId, holder = 'api', reason } = (req.body ?? {}) as { action?: string; screenId?: string; holder?: string; reason?: string };
    if (action === 'request') {
      const screen = layoutStore.get().screens.find((s) => s.id === screenId || s.name.toLowerCase() === String(screenId).toLowerCase());
      if (!screen) {
        res.status(404).json({ error: 'No such screen' });
        return;
      }
      broadcast({ plugin: '$host', event: 'attention', payload: { action, screenId: screen.id, holder: `api:${holder}`, reason } });
    } else {
      broadcast({ plugin: '$host', event: 'attention', payload: { action: 'release', holder: `api:${holder}` } });
    }
    res.json({ ok: true, note: 'Delivered to connected dashboards; each enforces the lock locally.' });
  });

  // --- Backup / restore ---------------------------------------------------------
  /** GET /api/export?secrets=1 → downloadable JSON backup. */
  app.get('/api/export', async (req, res) => {
    const includeSecrets = req.query.secrets === '1' || req.query.secrets === 'true';
    const backup = await createBackup(includeSecrets);
    const stamp = backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="magicdash-backup-${stamp}${includeSecrets ? '' : '-no-secrets'}.json"`);
    res.json(backup);
  });

  /** POST /api/import { backup, layout?: bool, settings?: bool } */
  app.post('/api/import', async (req, res) => {
    const { backup, layout = true, settings = true } = (req.body ?? {}) as { backup?: unknown; layout?: boolean; settings?: boolean };
    if (!validateBackup(backup)) {
      res.status(400).json({ error: 'That file is not a MagicDash backup.' });
      return;
    }
    try {
      const result = await restoreBackup(backup, { layout, settings });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // --- Plugin install / remove / rebuild ---------------------------------------------
  registerInstallRoutes(app);
  registerCatalogRoutes(app);
  registerLogRoutes(app);
  registerUpdateRoutes(app);

  // --- Plugin routers -----------------------------------------------------------
  for (const p of allPlugins()) {
    app.use(`/api/plugins/${p.manifest.id}`, p.router);
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // --- Static frontend (production) -------------------------------------------
  const dist = path.resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else if (IS_PROD) {
    console.warn('[server] dist/ not found — run `npm run build` first.');
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n  MagicDash server  →  http://localhost:${PORT}  (public: ${publicUrl})`);
    console.log(`  Admin             →  ${IS_PROD ? publicUrl : 'http://localhost:5173'}/admin`);
    if (!IS_PROD) console.log(`  Dev UI            →  http://localhost:5173\n`);
  });

  const stop = async () => {
    console.log('\n[server] shutting down…');
    await shutdownPlugins();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
