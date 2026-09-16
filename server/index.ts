import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { SECRET_MASK, type DashboardLayout, type ConfigField } from '../src/sdk/types';
import { addSseClient, broadcast, clientCount } from './events';
import { allPlugins, getPlugin, getPluginSettings, loadPlugins, setPluginSettings, shutdownPlugins } from './plugins';
import { layoutStore, settingsStore } from './storage';

const PORT = Number(process.env.MAGICDASH_PORT ?? 3210);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

function detectPublicUrl(): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  // Dev: the Vite dev server proxies /api to us, so OAuth redirects go through it.
  return IS_PROD ? `http://${os.hostname()}:${PORT}` : `http://localhost:5173`;
}

function secretKeys(fields: ConfigField[] | undefined): Set<string> {
  return new Set((fields ?? []).filter((f) => f.type === 'string' && f.secret).map((f) => f.key));
}

async function main() {
  await Promise.all([layoutStore.load(), settingsStore.load()]);
  const publicUrl = detectPublicUrl();
  await loadPlugins(() => publicUrl);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  // --- Core API ---------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clients: clientCount(), plugins: allPlugins().map((p) => p.manifest.id), publicUrl });
  });

  app.get('/api/plugins', (_req, res) => {
    res.json(allPlugins().map((p) => ({ manifest: p.manifest, hasServer: p.hasServer })));
  });

  app.get('/api/layout', (_req, res) => res.json(layoutStore.get()));

  app.put('/api/layout', async (req, res) => {
    const body = req.body as DashboardLayout;
    if (!body || body.version !== 1 || !Array.isArray(body.widgets) || !body.grid) {
      res.status(400).json({ error: 'Invalid layout payload' });
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
