import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';
import { fetchFeed, type FeedItem } from '../../server/feeds';

function parseFeedLines(lines: string[]): Array<{ name?: string; url: string }> {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split('|').map((s) => s.trim());
      return parts.length > 1 ? { name: parts.slice(0, -1).join(' | '), url: parts[parts.length - 1] } : { url: parts[0] };
    })
    .filter((f) => /^https?:\/\//i.test(f.url));
}

export default defineServerPlugin((ctx) => {
  /** GET /items?feeds=<json array of lines>&maxAgeHours=48&limit=40 */
  ctx.router.get(
    '/items',
    asyncHandler(async (req, res) => {
      let lines: string[] = [];
      try {
        lines = JSON.parse(String(req.query.feeds ?? '[]'));
      } catch {
        /* ignore */
      }
      const feeds = parseFeedLines(lines);
      if (feeds.length === 0) {
        res.status(400).json({ error: 'Add at least one feed URL in this tile’s settings.' });
        return;
      }
      const maxAge = Number(req.query.maxAgeHours ?? 48) * 3600_000;
      const limit = Math.min(100, Number(req.query.limit ?? 40));
      const errors: string[] = [];
      const results = await Promise.all(
        feeds.map((f) =>
          ctx.cache
            .wrap(`feed:${f.url}`, 10 * 60_000, () => fetchFeed(f.url, f.name))
            .catch((e: Error) => {
              errors.push(`${f.name ?? f.url}: ${e.message}`);
              return { title: f.name ?? f.url, items: [] as FeedItem[] };
            }),
        ),
      );
      const now = Date.now();
      const items = results
        .flatMap((r) => r.items)
        .filter((it) => it.title && (!it.date || now - new Date(it.date).getTime() < maxAge))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        .slice(0, limit)
        .map(({ html: _html, ...rest }) => rest); // don't ship raw HTML to the browser
      if (items.length === 0 && errors.length) {
        res.status(502).json({ error: errors.join('; ') });
        return;
      }
      res.json({ items, errors });
    }),
  );
});
