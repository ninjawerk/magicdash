/**
 * Plugin install / remove / rebuild.
 *
 * Plugins are compiled into the frontend bundle, so installing one means:
 *   1. write the folder to plugins/<id>/
 *   2. run `npm run build`
 *   3. restart the server (systemd brings it back; in dev you restart `npm run dev`)
 *
 * Installing a plugin runs its code on this machine. Disable with MAGICDASH_PLUGIN_UPLOAD=off.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import AdmZip from 'adm-zip';
import type { Express } from 'express';
import express from 'express';
import { broadcast } from './events';
import { PLUGINS_DIR, allPlugins } from './plugins';
import { HOST_VERSION } from './version';
import { compatibilityIssue } from '../src/sdk/types';

export const BUNDLED_PLUGINS = new Set(['clock', 'google-calendar', 'home-assistant', 'quotes', 'random-image', 'weather', 'news', 'word-of-the-day', 'qr-code']);
const RESERVED_IDS = new Set(['install', 'installed', 'rebuild', 'upload', '_template']);
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.md', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2']);
const MAX_FILES = 200;
const MAX_TOTAL = 20 * 1024 * 1024;
const UPLOAD_ENABLED = process.env.MAGICDASH_PLUGIN_UPLOAD !== 'off';
const IS_PROD = process.env.NODE_ENV === 'production';

interface IncomingFile {
  /** Path inside the plugin folder, e.g. "manifest.ts" or "lib/util.ts". */
  path: string;
  /** File contents, base64 for binary, utf8 text otherwise. */
  content: string;
  encoding?: 'utf8' | 'base64';
}

/** Strip a common leading folder ("my-plugin/manifest.ts" → "manifest.ts") and reject unsafe paths. */
function normalizeFiles(files: IncomingFile[]): IncomingFile[] {
  const cleaned = files
    .map((f) => ({ ...f, path: f.path.replace(/\\/g, '/').replace(/^\/+/, '') }))
    .filter((f) => f.path && !f.path.split('/').some((seg) => seg === '..' || seg === '' || seg.startsWith('.') && seg !== '.') && !f.path.includes('__MACOSX'));
  // Find the folder that holds manifest.ts
  const manifest = cleaned.find((f) => f.path === 'manifest.ts' || f.path.endsWith('/manifest.ts'));
  if (!manifest) throw new Error('No manifest.ts found in the upload.');
  const prefix = manifest.path.slice(0, -'manifest.ts'.length);
  return cleaned.filter((f) => f.path.startsWith(prefix)).map((f) => ({ ...f, path: f.path.slice(prefix.length) }));
}

/** Pull simple scalar fields out of a manifest.ts without executing it. */
export function readManifestFields(source: string): { id?: string; name?: string; version?: string; sdkVersion?: number; minHost?: string } {
  const str = (k: string) => source.match(new RegExp(`\\b${k}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`))?.[1];
  const num = (k: string) => {
    const m = source.match(new RegExp(`\\b${k}\\s*:\\s*(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  return { id: str('id'), name: str('name'), version: str('version'), sdkVersion: num('sdkVersion'), minHost: str('minHost') };
}

function idFromManifest(source: string): string {
  const m = source.match(/\bid\s*:\s*['"`]([^'"`]+)['"`]/);
  if (!m) throw new Error('manifest.ts must contain an `id: "..."` field.');
  const id = m[1];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`Plugin id "${id}" must be kebab-case (a-z, 0-9, -).`);
  if (RESERVED_IDS.has(id) || id.startsWith('_')) throw new Error(`Plugin id "${id}" is reserved.`);
  return id;
}

export interface InstallResult {
  id: string;
  name?: string;
  files: number;
  replaced: boolean;
}

export async function installPluginFiles(rawFiles: IncomingFile[], replace: boolean): Promise<InstallResult> {
  const files = normalizeFiles(rawFiles);
  if (files.length > MAX_FILES) throw new Error(`Too many files (${files.length} > ${MAX_FILES}).`);
  let total = 0;
  for (const f of files) {
    const ext = path.extname(f.path).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error(`File type not allowed: ${f.path}`);
    total += f.content.length;
  }
  if (total > MAX_TOTAL) throw new Error('Upload too large (20 MB max).');
  if (!files.some((f) => f.path === 'client.tsx')) throw new Error('client.tsx is required next to manifest.ts.');

  const manifestSrc = files.find((f) => f.path === 'manifest.ts')!;
  const manifestText = manifestSrc.encoding === 'base64' ? Buffer.from(manifestSrc.content, 'base64').toString('utf8') : manifestSrc.content;
  const id = idFromManifest(manifestText);
  const fields = readManifestFields(manifestText);
  const name = fields.name;
  if (BUNDLED_PLUGINS.has(id)) throw new Error(`"${id}" is a bundled plugin and can't be replaced by upload. Choose a different id.`);
  const issue = compatibilityIssue(fields, HOST_VERSION);
  if (issue) throw new Error(`Plugin "${id}" ${issue}.`);

  const dest = path.join(PLUGINS_DIR, id);
  let replaced = false;
  try {
    await fs.access(dest);
    if (!replace) throw new Error(`Plugin "${id}" is already installed. Tick "replace" to overwrite it.`);
    replaced = true;
    await fs.rm(dest, { recursive: true, force: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await fs.mkdir(dest, { recursive: true });
  for (const f of files) {
    const full = path.join(dest, f.path);
    if (!full.startsWith(dest + path.sep)) throw new Error(`Unsafe path: ${f.path}`);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, f.encoding === 'base64' ? Buffer.from(f.content, 'base64') : f.content);
  }
  return { id, name, files: files.length, replaced };
}

export function filesFromZip(buf: Buffer): IncomingFile[] {
  const zip = new AdmZip(buf);
  return zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => {
      const ext = path.extname(e.entryName).toLowerCase();
      const binary = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2'].includes(ext);
      const data = e.getData();
      return { path: e.entryName, content: binary ? data.toString('base64') : data.toString('utf8'), encoding: binary ? 'base64' : 'utf8' } as IncomingFile;
    });
}

// --- rebuild -----------------------------------------------------------------------

let building = false;

/** Run `npm run build`, streaming output to browsers as $host/build events. Resolves on success. */
export function rebuild(): Promise<void> {
  if (building) return Promise.reject(new Error('A build is already running.'));
  building = true;
  return new Promise((resolve, reject) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, ['run', 'build'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', FORCE_COLOR: '0' } });
    const send = (line: string) => broadcast({ plugin: '$host', event: 'build', payload: { line } });
    child.stdout.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach(send));
    child.stderr.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach(send));
    child.on('error', (e) => {
      building = false;
      reject(e);
    });
    child.on('close', (code) => {
      building = false;
      if (code === 0) resolve();
      else reject(new Error(`Build failed (exit ${code}). See the log above.`));
    });
  });
}

/** Ask the process to exit so systemd (or the user, in dev) restarts it. */
function scheduleRestart() {
  broadcast({ plugin: '$host', event: 'restarting', payload: { prod: IS_PROD } });
  setTimeout(() => process.exit(0), 500);
}

// --- routes -----------------------------------------------------------------------

export function registerInstallRoutes(app: Express) {
  app.get('/api/plugins/installed', async (_req, res) => {
    const loaded = new Map(allPlugins().map((p) => [p.manifest.id, p]));
    const dirs = (await fs.readdir(PLUGINS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'));
    res.json(
      await Promise.all(
        dirs.map(async (d) => {
          const p = loaded.get(d.name);
          const fields = p ? p.manifest : readManifestFields(await fs.readFile(path.join(PLUGINS_DIR, d.name, 'manifest.ts'), 'utf8').catch(() => ''));
          return {
            id: d.name,
            name: fields.name ?? d.name,
            version: fields.version,
            source: BUNDLED_PLUGINS.has(d.name) ? 'bundled' : 'custom',
            loaded: !!p,
            incompatible: compatibilityIssue(fields, HOST_VERSION),
          };
        }),
      ),
    );
  });

  app.get('/api/plugins/upload-enabled', (_req, res) => res.json({ enabled: UPLOAD_ENABLED, prod: IS_PROD }));

  const guard = (res: express.Response) => {
    if (!UPLOAD_ENABLED) {
      res.status(403).json({ error: 'Plugin upload is disabled on this server (MAGICDASH_PLUGIN_UPLOAD=off).' });
      return false;
    }
    return true;
  };

  /** POST /api/plugins/install — JSON { files: [{path, content, encoding?}], replace?: bool }  or  a raw application/zip body (?replace=1) */
  app.post(
    '/api/plugins/install',
    express.raw({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], limit: '25mb' }),
    express.json({ limit: '25mb' }),
    async (req, res) => {
      if (!guard(res)) return;
      try {
        let files: IncomingFile[];
        let replace = false;
        if (Buffer.isBuffer(req.body)) {
          files = filesFromZip(req.body);
          replace = req.query.replace === '1';
        } else {
          const body = req.body as { files?: IncomingFile[]; replace?: boolean };
          if (!Array.isArray(body.files)) throw new Error('Expected { files: [...] } or a zip body.');
          files = body.files;
          replace = !!body.replace;
        }
        const result = await installPluginFiles(files, replace);
        res.json({ ok: true, ...result, needsRebuild: true, prod: IS_PROD });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    },
  );

  app.delete('/api/plugins/:id', async (req, res) => {
    if (!guard(res)) return;
    const id = req.params.id;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || BUNDLED_PLUGINS.has(id)) {
      res.status(400).json({ error: 'Bundled plugins can’t be removed.' });
      return;
    }
    const dir = path.join(PLUGINS_DIR, id);
    try {
      await fs.access(dir);
    } catch {
      res.status(404).json({ error: 'No such plugin.' });
      return;
    }
    await fs.rm(dir, { recursive: true, force: true });
    res.json({ ok: true, id, needsRebuild: true, prod: IS_PROD });
  });

  /** POST /api/plugins/rebuild — rebuilds the frontend, then restarts (production) so the server loads new plugin backends. */
  app.post('/api/plugins/rebuild', async (_req, res) => {
    if (!guard(res)) return;
    try {
      await rebuild();
      res.json({ ok: true, restarting: IS_PROD });
      if (IS_PROD) scheduleRestart();
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
}
