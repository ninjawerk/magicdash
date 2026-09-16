/**
 * Plugin catalog: one or more JSON index files (a GitHub repo's raw file, a gist, your own server) that the
 * dashboard downloads and searches locally. Installing downloads the pinned release zip, verifies its SHA-256,
 * checks compatibility and hands it to the normal install path.
 */
import { createHash } from 'node:crypto';
import type { Express } from 'express';
import { compatibilityIssue, type PluginManifest } from '../src/sdk/types';
import { HOST_VERSION } from './version';
import { BUNDLED_PLUGINS, filesFromZip, installPluginFiles } from './install';
import { allPlugins, PLUGINS_DIR } from './plugins';
import { settingsStore } from './storage';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readManifestFields } from './install';

export const DEFAULT_SOURCES = ['https://raw.githubusercontent.com/ninjawerk/magicdash-plugins/main/index.json'];

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  version: string;
  download: string;
  sha256: string;
  sdkVersion: number;
  minHost?: string;
  tags?: string[];
  screenshot?: string;
  /** Set only by catalog maintainers after reading the code. */
  reviewed?: boolean;
  addedAt?: string;
  updatedAt?: string;
}
export interface CatalogIndex {
  name?: string;
  plugins: CatalogEntry[];
}
export interface CatalogItem extends CatalogEntry {
  source: string;
  installedVersion?: string;
  updateAvailable?: boolean;
  incompatible?: string;
  bundled?: boolean;
}

const UA = 'MagicDash/' + HOST_VERSION;
const cache = new Map<string, { at: number; index: CatalogIndex; error?: string }>();
const TTL = 15 * 60_000;

function sources(): string[] {
  const s = (settingsStore.get().$host?.catalogSources as string[] | undefined) ?? DEFAULT_SOURCES;
  return s.filter((u) => /^https?:\/\//i.test(u));
}

async function fetchIndex(url: string, force = false): Promise<{ index: CatalogIndex; error?: string }> {
  const hit = cache.get(url);
  if (hit && !force && Date.now() - hit.at < TTL) return hit;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(`${new URL(url).hostname} responded ${r.status}`);
    const raw = (await r.json()) as CatalogIndex | CatalogEntry[];
    const index: CatalogIndex = Array.isArray(raw) ? { plugins: raw } : raw;
    if (!Array.isArray(index.plugins)) throw new Error('index has no "plugins" array');
    const entry = { at: Date.now(), index };
    cache.set(url, entry);
    return entry;
  } catch (e) {
    const entry = { at: Date.now(), index: hit?.index ?? { plugins: [] }, error: (e as Error).message };
    cache.set(url, entry);
    return entry;
  }
}

async function installedVersions(): Promise<Map<string, string | undefined>> {
  const out = new Map<string, string | undefined>();
  for (const p of allPlugins()) out.set(p.manifest.id, p.manifest.version);
  // Also plugins installed but not yet loaded (awaiting rebuild)
  try {
    for (const d of await fs.readdir(PLUGINS_DIR)) {
      if (out.has(d) || d.startsWith('_') || d.startsWith('.')) continue;
      const src = await fs.readFile(path.join(PLUGINS_DIR, d, 'manifest.ts'), 'utf8').catch(() => '');
      if (src) out.set(d, readManifestFields(src).version);
    }
  } catch {
    /* ignore */
  }
  return out;
}

export async function loadCatalog(force = false): Promise<{ items: CatalogItem[]; sources: Array<{ url: string; count: number; error?: string }> }> {
  const installed = await installedVersions();
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  const srcInfo: Array<{ url: string; count: number; error?: string }> = [];
  for (const url of sources()) {
    const { index, error } = await fetchIndex(url, force);
    let count = 0;
    for (const e of index.plugins) {
      if (!e?.id || !e.download || !e.sha256 || seen.has(e.id)) continue; // first source wins on id clashes
      seen.add(e.id);
      count++;
      const iv = installed.get(e.id);
      items.push({
        ...e,
        source: url,
        installedVersion: iv,
        updateAvailable: iv !== undefined && iv !== e.version && compareVersions(e.version, iv) > 0,
        incompatible: compatibilityIssue(e, HOST_VERSION),
        bundled: BUNDLED_PLUGINS.has(e.id),
      });
    }
    srcInfo.push({ url, count, error });
  }
  return { items, sources: srcInfo };
}

function compareVersions(a: string, b: string) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  return 0;
}

export async function installFromCatalog(id: string, replace: boolean) {
  const { items } = await loadCatalog();
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`"${id}" is not in any configured catalog.`);
  if (item.bundled) throw new Error(`"${id}" is bundled with MagicDash.`);
  if (item.incompatible) throw new Error(`"${item.name}" ${item.incompatible}.`);
  if (!/^https:\/\//i.test(item.download)) throw new Error('Catalog downloads must use https.');
  const r = await fetch(item.download, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download failed (${r.status}) from ${new URL(item.download).hostname}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== item.sha256.toLowerCase()) throw new Error(`Checksum mismatch for ${item.name}: the download does not match what the catalog pinned. Not installed.`);
  const files = filesFromZip(buf);
  const manifestFile = files.find((f) => f.path === 'manifest.ts' || f.path.endsWith('/manifest.ts'));
  const fields = manifestFile ? readManifestFields(manifestFile.content) : {};
  if (fields.id !== item.id) throw new Error(`The zip's manifest id "${fields.id}" doesn't match the catalog entry "${item.id}". Not installed.`);
  const result = await installPluginFiles(files, replace || item.installedVersion !== undefined);
  return { ...result, version: fields.version, reviewed: !!item.reviewed, sha256: sha };
}

export function registerCatalogRoutes(app: Express) {
  app.get('/api/catalog', async (req, res) => {
    try {
      res.json(await loadCatalog(req.query.refresh === '1'));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
  app.get('/api/catalog/sources', (_req, res) => res.json({ sources: sources(), defaults: DEFAULT_SOURCES }));
  app.put('/api/catalog/sources', async (req, res) => {
    const { sources: next } = (req.body ?? {}) as { sources?: string[] };
    if (!Array.isArray(next)) {
      res.status(400).json({ error: 'sources must be an array of URLs' });
      return;
    }
    const all = settingsStore.get();
    await settingsStore.set({ ...all, $host: { ...(all.$host ?? {}), catalogSources: next.map((s) => String(s).trim()).filter(Boolean) } });
    cache.clear();
    res.json({ sources: sources() });
  });
  app.post('/api/catalog/install', async (req, res) => {
    const { id, replace } = (req.body ?? {}) as { id?: string; replace?: boolean };
    if (!id) {
      res.status(400).json({ error: 'id required' });
      return;
    }
    if (process.env.MAGICDASH_PLUGIN_UPLOAD === 'off') {
      res.status(403).json({ error: 'Plugin installation is disabled on this server (MAGICDASH_PLUGIN_UPLOAD=off).' });
      return;
    }
    try {
      const result = await installFromCatalog(id, !!replace);
      res.json({ ok: true, ...result, needsRebuild: true, prod: process.env.NODE_ENV === 'production' });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
}

export type { PluginManifest };
