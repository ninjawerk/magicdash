import { promises as fs } from 'node:fs';
import path from 'node:path';
import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';

const EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);

async function walk(dir: string, base: string, out: string[], depth = 0): Promise<void> {
  if (depth > 6) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, base, out, depth + 1);
    else if (EXT.has(path.extname(e.name).toLowerCase())) out.push(path.relative(base, full));
  }
}

export default defineServerPlugin<{ folder?: string }>((ctx) => {
  const folder = () => {
    const f = ctx.settings.get().folder?.trim();
    return f ? path.resolve(f) : undefined;
  };

  ctx.settings.onChange(() => ctx.cache.delete('list'));

  /** GET /list?filter=holidays → ["a.jpg", "sub/b.png", ...] */
  ctx.router.get(
    '/list',
    asyncHandler(async (req, res) => {
      const base = folder();
      if (!base) {
        res.status(400).json({ error: 'No image folder configured. Open the Random image plugin settings.' });
        return;
      }
      const all = await ctx.cache.wrap('list', 5 * 60 * 1000, async () => {
        const out: string[] = [];
        await walk(base, base, out);
        return out.sort();
      });
      const filter = String(req.query.filter ?? '').toLowerCase();
      res.json(filter ? all.filter((p) => p.toLowerCase().includes(filter)) : all);
    }),
  );

  /** GET /file?p=sub/b.png — serves an image from the configured folder only. */
  ctx.router.get('/file', (req, res) => {
    const base = folder();
    const rel = String(req.query.p ?? '');
    if (!base || !rel) {
      res.status(400).json({ error: 'Missing folder or path' });
      return;
    }
    const full = path.resolve(base, rel);
    if (!full.startsWith(base + path.sep) || !EXT.has(path.extname(full).toLowerCase())) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.sendFile(full, { maxAge: '1d' }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Not found' });
    });
  });
});
