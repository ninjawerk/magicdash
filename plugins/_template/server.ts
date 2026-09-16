import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';

/**
 * Optional. Delete this file if your widget is purely client-side.
 * Everything you add to `ctx.router` is served at /api/plugins/<id>/...
 */
export default defineServerPlugin<{ apiKey?: string }>((ctx) => {
  // Used by the `optionsFrom: 'flavours'` select field in the manifest.
  ctx.router.get('/flavours', (_req, res) => {
    res.json([
      { label: 'Vanilla', value: 'vanilla' },
      { label: 'Chocolate', value: 'chocolate' },
    ]);
  });

  ctx.router.get(
    '/data',
    asyncHandler(async (_req, res) => {
      // Cache expensive calls; secrets are read from ctx.settings on the server only.
      const data = await ctx.cache.wrap('data', 30_000, async () => ({
        time: new Date().toISOString(),
        hasKey: !!ctx.settings.get().apiKey,
      }));
      res.json(data);
    }),
  );

  // Push to widgets in real time: ctx.emit('tick', { n }) → usePluginEvent(manifest.id, 'tick', ...)
  const timer = setInterval(() => ctx.emit('tick', { at: Date.now() }), 60_000);
  ctx.onShutdown(() => clearInterval(timer));
});
