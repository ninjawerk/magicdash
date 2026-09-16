import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express, { Router } from 'express';
import type { PluginManifest } from '../src/sdk/types';
import type { PluginServerContext, ServerPluginSetup, SettingsStore } from '../src/sdk/server';
import { createCache } from './cache';
import { broadcast } from './events';
import { DATA_DIR, settingsStore } from './storage';

export const PLUGINS_DIR = path.resolve('plugins');

export interface LoadedPlugin {
  manifest: PluginManifest;
  router: Router;
  hasServer: boolean;
  shutdown: Array<() => void | Promise<void>>;
}

const plugins = new Map<string, LoadedPlugin>();
const settingsListeners = new Map<string, Set<(next: Record<string, unknown>, prev: Record<string, unknown>) => void>>();

function makeLogger(id: string) {
  const tag = `[${id}]`;
  return {
    info: (...a: unknown[]) => console.log(tag, ...a),
    warn: (...a: unknown[]) => console.warn(tag, ...a),
    error: (...a: unknown[]) => console.error(tag, ...a),
    debug: (...a: unknown[]) => {
      if (process.env.DEBUG) console.debug(tag, ...a);
    },
  };
}

export function getPlugin(id: string) {
  return plugins.get(id);
}

export function allPlugins() {
  return [...plugins.values()];
}

/** Settings for a plugin, with secrets included. */
export function getPluginSettings(id: string): Record<string, unknown> {
  return settingsStore.get()[id] ?? {};
}

export async function setPluginSettings(id: string, next: Record<string, unknown>) {
  const all = settingsStore.get();
  const prev = all[id] ?? {};
  await settingsStore.set({ ...all, [id]: next });
  settingsListeners.get(id)?.forEach((cb) => {
    try {
      cb(next, prev);
    } catch (e) {
      console.error(`[${id}] settings listener failed`, e);
    }
  });
}

function makeSettingsStore(id: string): SettingsStore {
  return {
    get: () => getPluginSettings(id),
    set: async (patch) => setPluginSettings(id, { ...getPluginSettings(id), ...patch }),
    onChange: (cb) => {
      let set = settingsListeners.get(id);
      if (!set) settingsListeners.set(id, (set = new Set()));
      set.add(cb);
      return () => set!.delete(cb);
    },
  };
}

export async function loadPlugins(publicUrl: () => string): Promise<LoadedPlugin[]> {
  const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const dir = path.join(PLUGINS_DIR, entry.name);
    try {
      const manifestMod = await import(pathToFileURL(path.join(dir, 'manifest.ts')).href);
      const manifest = (manifestMod.default ?? manifestMod.manifest) as PluginManifest;
      if (!manifest?.id) throw new Error('manifest.ts must default-export a PluginManifest with an id');
      if (manifest.id !== entry.name) {
        console.warn(`[plugins] folder "${entry.name}" has manifest id "${manifest.id}" — folder name should match.`);
      }

      const router = Router();
      router.use(express.json({ limit: '1mb' }));
      const loaded: LoadedPlugin = { manifest, router, hasServer: false, shutdown: [] };

      let hasServer = false;
      try {
        await fs.access(path.join(dir, 'server.ts'));
        hasServer = true;
      } catch {
        /* no server part */
      }

      if (hasServer) {
        const serverMod = await import(pathToFileURL(path.join(dir, 'server.ts')).href);
        const setup = (serverMod.default ?? serverMod.setup) as ServerPluginSetup;
        if (typeof setup !== 'function') throw new Error('server.ts must default-export defineServerPlugin(...)');
        const dataDir = path.join(DATA_DIR, 'plugins', manifest.id);
        await fs.mkdir(dataDir, { recursive: true });
        const ctx: PluginServerContext = {
          manifest,
          router,
          settings: makeSettingsStore(manifest.id),
          cache: createCache(),
          log: makeLogger(manifest.id),
          dataDir,
          emit: (event, payload) => broadcast({ plugin: manifest.id, event, payload }),
          publicUrl,
          onShutdown: (cb) => loaded.shutdown.push(cb),
        };
        await setup(ctx);
        loaded.hasServer = true;
      }

      // Plugins without a server still get a router (for optionsFrom etc. returning 404 nicely).
      router.use((_req, res) => res.status(404).json({ error: `No such route on plugin "${manifest.id}"` }));
      plugins.set(manifest.id, loaded);
      console.log(`[plugins] loaded ${manifest.id} v${manifest.version}${hasServer ? ' (server)' : ''}`);
    } catch (e) {
      console.error(`[plugins] failed to load "${entry.name}":`, e);
    }
  }
  return allPlugins();
}

export async function shutdownPlugins() {
  for (const p of plugins.values()) {
    for (const cb of p.shutdown) {
      try {
        await cb();
      } catch (e) {
        console.error(`[${p.manifest.id}] shutdown failed`, e);
      }
    }
  }
}
