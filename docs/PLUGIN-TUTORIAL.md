# Tutorial: build a Countdown plugin in 15 minutes

We'll build a tile that counts down to a date ("Holiday in 23 days"), turns red in the final hour, and pulls its
screen forward when the moment arrives. Along the way you'll use every part of the SDK you're likely to need.

## 0. Scaffold

```bash
npm run new-plugin countdown "Countdown"
npm run dev
```

You now have `plugins/countdown/{manifest.ts, client.tsx, server.ts}` copied from `_template`. Open the dashboard,
press **E**, **Add → Countdown**. It renders the template's greeting. Everything below edits those three files.

## 1. Describe the tile — `manifest.ts`

The manifest is the whole settings UI. No form code anywhere.

```ts
import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'countdown',
  name: 'Countdown',
  description: 'Days, hours and minutes until a date. Red in the final hour.',
  version: '1.0.0',
  author: 'you',
  icon: '⏳',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    { key: 'title', label: 'What are we counting down to?', type: 'string', placeholder: 'Holiday' },
    { key: 'target', label: 'Date & time', type: 'datetime', help: 'Local time on the kiosk.' },
    { key: 'showSeconds', label: 'Show seconds', type: 'boolean', default: false },
    { key: 'grabAttention', label: 'Bring this screen forward in the last minute', type: 'boolean', default: true },
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'big',
      options: [
        { label: 'Big number', value: 'big' },
        { label: 'Units row', value: 'units' },
      ],
    },
  ],
};
export default manifest;
```

Field types available: `string` (`secret: true` for keys), `textarea`, `number`, `boolean`, `color`, `select`, `multiselect`,
`list`, `date`, `datetime`, `time`, `custom`, `action`. `showWhen: { key, equals | oneOf }` hides a field until another has a value.

## 2. Render it — `client.tsx`

```tsx
import { useEffect } from 'react';
import { definePlugin, formatDuration, useNow, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config { title?: string; target?: string; showSeconds?: boolean; grabAttention?: boolean; style?: 'big' | 'units' }

function CountdownWidget({ config, size, editMode, openSettings, setAlert, attention }: WidgetProps<Config>) {
  const now = useNow(1000);                                   // re-render every second
  const target = config.target ? new Date(config.target).getTime() : NaN;
  const remaining = target - now.getTime();

  const lastHour = remaining > 0 && remaining <= 3_600_000;
  const lastMinute = remaining > 0 && remaining <= 60_000;
  useEffect(() => setAlert(lastHour), [lastHour, setAlert]);  // red pulsing tile

  useEffect(() => {                                           // attention lock: one holder, 120 s max
    if (config.grabAttention !== false && lastMinute) attention.request(`${config.title ?? 'Countdown'} is about to end`);
    else if (attention.held) attention.release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMinute, attention.held]);

  if (!config.target || Number.isNaN(target)) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/50 cursor-pointer" onClick={editMode ? openSettings : undefined}>
        Set a date in this tile's settings.
      </div>
    );
  }

  const fontSize = Math.min(size.height * 0.45, size.width / 6);
  if (remaining <= 0) {
    return <div className="flex h-full items-center justify-center font-bold" style={{ fontSize }}>🎉 {config.title ?? 'It’s time!'}</div>;
  }

  const days = Math.floor(remaining / 86_400_000);
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      {config.title && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{config.title}</div>}
      {config.style === 'units' ? (
        <div className="mt-1 flex gap-4 tabular">
          {[['d', days], ['h', Math.floor((remaining / 3_600_000) % 24)], ['m', Math.floor((remaining / 60_000) % 60)]].map(([u, v]) => (
            <div key={u as string}>
              <div className="font-bold leading-none" style={{ fontSize: fontSize * 0.8, color: lastHour ? 'var(--warm)' : undefined }}>{v}</div>
              <div className="text-xs text-white/40">{u}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1 font-bold leading-none tabular" style={{ fontSize, color: lastHour ? 'var(--warm)' : undefined }}>
          {days > 0 ? `${days}d ${formatDuration(remaining % 86_400_000)}` : formatDuration(remaining, { seconds: config.showSeconds })}
        </div>
      )}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: CountdownWidget });
```

What you used:

- `useNow` for ticking, `formatDuration` for "1h 12m".
- `size` to scale the number to the tile.
- `setAlert` for the red pulse, `attention.request/release` to pull the screen forward.
- `editMode` + `openSettings` for a helpful empty state.
- Theme tokens (`var(--warm)`, `text-white/50`) so it looks right on every theme.

Save, and the tile hot-reloads.

## 3. Add a backend (optional) — `server.ts`

Countdown doesn't need one, so **delete `server.ts`**. When you do need one (an API with a key, a websocket,
anything cached), it looks like this:

```ts
import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';

export default defineServerPlugin<{ apiKey?: string }>((ctx) => {
  ctx.router.get('/data', asyncHandler(async (_req, res) => {
    const data = await ctx.cache.wrap('data', 60_000, async () => {
      const r = await fetch('https://api.example.com/x', { headers: { authorization: `Bearer ${ctx.settings.get().apiKey}` } });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      return r.json();
    });
    res.json(data);
  }));
  // Push to widgets: ctx.emit('changed', payload)  →  usePluginEvent(manifest.id, 'changed', handler)
});
```

and in the widget: `const { data, error, loading } = usePluginQuery(api, '/data', { refreshMs: 60_000 })`.
Declare the key in the manifest as `settings: [{ key: 'apiKey', label: 'API key', type: 'string', secret: true }]` and the
host renders it under *Plugins → Countdown*; the browser never sees the value.

Restart `npm run dev` after adding or removing `server.ts` (the server discovers plugins at startup).

## 4. Check it at every size

Drag the corner. At 2×1 the big number must still fit; at 6×4 it shouldn't look lost. Use `size.width/height`
to pick what to show, as the weather plugin does (`plugins/weather/client.tsx` budgets sections by pixel height).

## 5. Ship it

```bash
npm run typecheck
npm run pack-plugin countdown        # → countdown-1.0.0.zip
```

Anyone can install the zip via *Edit → Add → Install a plugin…*. To propose it as a bundled plugin, open a PR and add
the id to `BUNDLED_PLUGINS` in `server/install.ts` plus a row in the README table.

## Cheat sheet

| I want to… | Use |
| --- | --- |
| poll my backend | `usePluginQuery(api, path, { refreshMs })` |
| push instantly from the server | `ctx.emit()` + `usePluginEvent()` |
| tick every second | `useNow(1000)` |
| rotate items | `useRotation(n, ms)` |
| a picker whose options come from the server | `type: 'multiselect', optionsFrom: 'route'` returning `[{label, value, group?}]` |
| a bespoke editor (map, search box) | `type: 'custom'` + `customFields: { key: Component }` |
| a button in settings that calls the server | `type: 'action', action: 'route', buttonLabel` |
| red pulsing tile | `setAlert(true)` |
| paint the whole tile | `setBackground(css)` |
| pull my screen forward | `attention.request(reason)` … `attention.release()` |
| store a token | manifest `settings` with `secret: true`; read via `ctx.settings.get()` |
| write files | `ctx.dataDir` |
