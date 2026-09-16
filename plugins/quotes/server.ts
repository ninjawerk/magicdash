import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';
import { BUNDLED_QUOTES, type Quote } from './quotes';

export default defineServerPlugin((ctx) => {
  ctx.router.get('/bundled', (_req, res) => res.json(BUNDLED_QUOTES));

  // ZenQuotes has a generous free tier but rate-limits; cache for an hour.
  ctx.router.get(
    '/zenquotes',
    asyncHandler(async (_req, res) => {
      const quotes = await ctx.cache.wrap('zen', 60 * 60 * 1000, async () => {
        const r = await fetch('https://zenquotes.io/api/quotes');
        if (!r.ok) throw new Error(`ZenQuotes ${r.status}`);
        const arr = (await r.json()) as Array<{ q: string; a: string }>;
        return arr.map<Quote>((q) => ({ text: q.q, author: q.a }));
      });
      res.json(quotes);
    }),
  );
});
