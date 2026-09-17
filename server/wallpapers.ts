/**
 * Wallpaper uploads for the dashboard background.
 * Files live in data/wallpapers/ and are served publicly at /api/wallpapers/<file> (the kiosk view is public).
 */
import express, { type Express } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './storage';

export const WALLPAPER_DIR = path.join(DATA_DIR, 'wallpapers');
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif', 'image/svg+xml': '.svg' };
const MAX_BYTES = 15 * 1024 * 1024;

function safeName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'wallpaper';
}

export async function listWallpapers(): Promise<{ file: string; url: string; bytes: number; mtime: number }[]> {
  await fs.mkdir(WALLPAPER_DIR, { recursive: true });
  const names = await fs.readdir(WALLPAPER_DIR);
  const out = [];
  for (const file of names) {
    if (file.startsWith('.')) continue;
    const st = await fs.stat(path.join(WALLPAPER_DIR, file)).catch(() => null);
    if (st?.isFile()) out.push({ file, url: `/api/wallpapers/${encodeURIComponent(file)}`, bytes: st.size, mtime: st.mtimeMs });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export function registerWallpaperRoutes(app: Express) {
  app.get('/api/wallpapers', async (_req, res) => res.json(await listWallpapers()));

  app.get('/api/wallpapers/:file', async (req, res) => {
    const file = path.basename(String(req.params.file));
    const full = path.join(WALLPAPER_DIR, file);
    if (!full.startsWith(WALLPAPER_DIR)) return res.status(400).end();
    res.sendFile(full, { maxAge: '7d' }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'No such wallpaper' });
    });
  });

  /** POST /api/wallpapers?name=<original file name>, body = raw image bytes. */
  app.post('/api/wallpapers', express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_BYTES }), async (req, res) => {
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim();
    const ext = IMAGE_TYPES[type];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: `Send an image (${Object.values(IMAGE_TYPES).join(', ')}) as the raw request body with its Content-Type.` });
    }
    await fs.mkdir(WALLPAPER_DIR, { recursive: true });
    const base = safeName(String(req.query.name ?? 'wallpaper'));
    let file = `${base}${ext}`;
    let n = 1;
    while (await fs.stat(path.join(WALLPAPER_DIR, file)).then(() => true, () => false)) file = `${base}-${++n}${ext}`;
    await fs.writeFile(path.join(WALLPAPER_DIR, file), req.body);
    res.json({ file, url: `/api/wallpapers/${encodeURIComponent(file)}`, bytes: req.body.length });
  });

  app.delete('/api/wallpapers/:file', async (req, res) => {
    const file = path.basename(String(req.params.file));
    await fs.rm(path.join(WALLPAPER_DIR, file), { force: true });
    res.json({ ok: true });
  });
}
