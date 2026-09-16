# Writing MagicDash plugins

A plugin is a folder under `plugins/` with up to three files:

```
plugins/my-widget/
  manifest.ts   # what the plugin is and what it can be configured with  (shared by browser + server)
  client.tsx    # the React widget                                      (browser)
  server.ts     # optional backend routes, secrets, polling, push       (Node)
```

The host discovers plugins automatically — no registration step. Scaffold one with:

```bash
npm run new-plugin my-widget "My Widget"
npm run dev          # restart if it was already running
```

Then *Edit → Add* on the dashboard.

## 1. `manifest.ts`

```ts
import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'my-widget',                 // must equal the folder name
  name: 'My Widget',
  description: 'One line shown in the Add dialog.',
  version: '1.0.0',
  author: 'you',
  icon: '🧩',
  defaultSize: { w: 3, h: 2 },     // grid units (default grid is 12 × 8)
  minSize: { w: 2, h: 1 },
  frameless: false,                // true = no title bar, you draw everything

  settings: [ /* plugin-wide, stored on the server */ ],
  widgetConfig: [ /* per tile */ ],
};
export default manifest;
```

Keep this file free of React and Node imports — it is loaded on both sides.

### Two kinds of configuration

| | `settings` | `widgetConfig` |
| --- | --- | --- |
| Scope | Whole plugin (all tiles) | One tile |
| Stored | `data/settings.json` on the server | In the layout, sent to the browser |
| Typical use | API keys, tokens, OAuth, folder paths | Which entities/calendars, units, layout mode |
| Reached in code | `ctx.settings.get()` (server) / `props.settings` masked (browser) | `props.config` |

Mark a `string` field `secret: true` and the browser only ever sees a mask; the real value stays on the server.

### Field types

The host renders a form from these. No settings UI code needed.

```ts
{ key, label, help?, showWhen?: { key, equals } }   // common to all
{ type: 'string', placeholder?, default?, secret? }
{ type: 'textarea', rows?, default? }
{ type: 'number', min?, max?, step?, unit?, default? }
{ type: 'boolean', default? }
{ type: 'color', default? }
{ type: 'date' | 'datetime' | 'time', default?, min?, max? }   // native pickers; stored as YYYY-MM-DD / YYYY-MM-DDTHH:MM / HH:MM
{ type: 'select',      options?: [{label, value}], optionsFrom?: 'path' }
{ type: 'multiselect', options?: [{label, value, description?, group?}], optionsFrom?: 'path' }
{ type: 'list', itemLabel?, placeholder?, default?: string[] }
{ type: 'custom' }                                    // you supply the editor (see below)
{ type: 'action', action: 'path', buttonLabel, variant? }  // POST to your router
```

`optionsFrom: 'entities'` makes the host `GET /api/plugins/<id>/entities` and expects
`[{ label, value, description?, group? }]`. This is how the Home Assistant entity picker and the
calendar picker work — the server knows the options, the manifest just points at the route.

`showWhen` hides a field unless another field has a value, e.g. show the URL list only when `source === 'urls'`.

## 2. `client.tsx`

```tsx
import { definePlugin, usePluginQuery, useNow, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config { city?: string; refreshSec?: number }

function Widget({ config, settings, size, api, editMode, openSettings, setAlert }: WidgetProps<Config>) {
  const { data, error, loading } = usePluginQuery<{ temp: number }>(api, '/current', {
    query: { city: config.city },
    refreshMs: (config.refreshSec ?? 60) * 1000,
    enabled: !!config.city,
  });
  if (!config.city) return <p onClick={editMode ? openSettings : undefined}>Pick a city in settings.</p>;
  if (error) return <p className="text-red-300">{error}</p>;
  if (loading) return <p>Loading…</p>;
  return <div style={{ fontSize: size.width / 6 }}>{data!.temp}°</div>;
}

export default definePlugin<Config>({ manifest, Widget });
```

### `WidgetProps`

| Prop | |
| --- | --- |
| `config` | This tile's config, with manifest defaults already applied |
| `settings` | Plugin-wide settings, secrets masked as `SECRET_MASK` |
| `context` | Dashboard-wide facts: `{ location?, name?, units? }` (Appearance → Dashboard). Use as defaults; let the tile override. |
| `size` | `{ w, h }` in grid units and `{ width, height }` in px — scale your type to it |
| `editMode` | True while the user is arranging tiles; disable click actions then |
| `api` | `api.get(path, query)`, `api.post(path, body)`, `api.url(path)` — bound to your router |
| `openSettings()` | Open this tile's settings dialog |
| `setAlert(bool)` | Turn the tile red & pulsing (the schedule uses it for the final minute) |
| `setBackground(css)` | Paint the whole tile, title bar included, with a CSS background (the weather tile tints itself by conditions). Keep it translucent. |
| `attention.request(reason?)` / `.release()` / `.held` / `.busy` | The attention lock (see below). |
| `notify({ message, title?, level?, durationSec?, icon? })` | Toast on this display. Server side: `ctx.notify()` reaches every display. |

### Talking to other plugins

`publish(topic, payload)` / `useTopic(topic)` / `useSubscribe(topic, handler)` from `src/sdk/client` form a small in-browser
bus. The latest payload per topic is kept, so late subscribers get it at once. Bundled topics: `weather:current`
(`WeatherCurrentTopic`) and `calendar:next` (`CalendarNextTopic`). Name yours `<plugin-id>:<thing>`. The greeting mode of the
quotes plugin is the reference consumer.

### Language and translations

The selected language (Admin → Settings → Language, or Appearance → Language) reaches plugins three ways:

- `props.locale` — a BCP-47 tag such as `en-GB` or `de`; pass it to `Intl.DateTimeFormat` / `Intl.NumberFormat`.
- `useLocale()` — the same value as a hook that re-renders when the user changes it; `getLocale()` outside React.
- `formatTime()` / `formatDate()` from the SDK already use it.

Ship strings with `translations` and read them with `useT`:

```ts
export default definePlugin({ manifest, Widget, translations: { en: { hello: 'Hello, {name}' }, de: { hello: 'Hallo, {name}' } } });
const t = useT(manifest.id);  t('hello', { name })
```
Lookup order: exact locale (`de-AT`) → language (`de`) → English → the key itself, so partial translations are fine.
Keep the English strings plain — many users read transliterated terms with difficulty; the Rahu Kaala tile says
"Rahu period — avoid starting new things" rather than assuming the reader knows the Sanskrit names.

### Screens and the attention lock

A dashboard can have several **screens** that rotate. Widgets on inactive screens stay mounted, so they keep
polling and can still ask for attention. When something needs the user *now* (an event is ending, a door opened),
call `attention.request('door opened')`: the dashboard switches to your tile's screen and pauses rotation.

Rules the host enforces:

- **One holder.** If another plugin holds the lock, `request()` returns `false`. Check `attention.busy` if you want to know in advance.
- **120 seconds max.** The lock is released automatically after two minutes no matter what.
- **Release early.** Call `attention.release()` as soon as the moment has passed; users hate a stuck screen.
- **Cooldown.** After an automatic release the same holder can't re-acquire for 30 s, so a misbehaving plugin can't hog the display.

Server-side plugins can do the same with `ctx.requestAttention(reason)` / `ctx.releaseAttention()`; the host picks the
first screen that shows one of the plugin's tiles.
| `instanceId` | Stable id of the tile |

### Hooks (from `src/sdk/client`)

- `usePluginQuery(api, path, { query, refreshMs, enabled, deps })` → `{ data, error, loading, refresh, updatedAt }`
- `usePluginEvent(pluginId, event, handler)` — receive `ctx.emit()` pushes from your server in real time
- `useNow(intervalMs)` — re-render on a timer, returns `Date`
- `publish` / `useTopic` / `useSubscribe` — inter-plugin bus; `useT(pluginId)` — translations
- `useRotation(length, intervalMs, { random })` — cycle an index (slideshows, quotes)
- `formatDuration(ms, { seconds })`, `formatTime(date, { hour12 })`, `classNames(...)`

### Location fields

For a per-tile location, declare `{ type: 'custom', key: 'location' }` and reuse the host picker:
`import { LocationPicker } from '../../src/app/components/LocationPicker'` (backed by `GET /api/geocode`). Fall back to
`props.context.location` when the tile has none — see `plugins/rahu-kaala`.

### Custom field editors

For anything the built-in fields can't express (a map picker, a search box), declare
`{ type: 'custom', key: 'location' }` in the manifest and provide the editor:

```tsx
function LocationField({ value, onChange, config, api }: CustomFieldProps<Location | undefined>) { … }

export default definePlugin({ manifest, Widget, customFields: { location: LocationField } });
```

### Plugin settings panel

`SettingsPanel` renders at the top of the plugin-wide settings dialog — the calendar plugin uses it for
connection status and the *Connect Google* button:

```tsx
export default definePlugin({ manifest, Widget, SettingsPanel: ({ settings, api, reload }) => <…/> });
```

### Styling

Tailwind v4 utility classes are available. The host sets CSS variables you can lean on:
`var(--accent)`, `var(--fg)` (text), `var(--cool)` and `var(--warm)` (a cold and a hot tone per theme — use them for
temperatures, on/off, water/sun instead of hard-coded blues and yellows), `var(--surface)`, `var(--tile-bg)`, `var(--tile-radius)`. Tiles are dark; use white text with opacity for hierarchy.
Add `tabular` to numbers that tick so they don't jitter. Fonts: Inter (body), JetBrains Mono (`font-mono`).

Your widget fills the tile's content area (below the optional title bar). Use `size.width/height` for
responsive decisions — a tile may be 2×1 or 12×8.

## 3. `server.ts` (optional)

```ts
import { defineServerPlugin, asyncHandler } from '../../src/sdk/server';

interface Settings { apiKey?: string }

export default defineServerPlugin<Settings>((ctx) => {
  ctx.router.get('/current', asyncHandler(async (req, res) => {
    const city = String(req.query.city ?? '');
    const data = await ctx.cache.wrap(`cur:${city}`, 60_000, async () => {
      const r = await fetch(`https://example.com/api?city=${city}&key=${ctx.settings.get().apiKey}`);
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      return r.json();
    });
    res.json(data);
  }));
});
```

### `PluginServerContext`

| Member | |
| --- | --- |
| `router` | Express router mounted at `/api/plugins/<id>`. JSON bodies are parsed. |
| `settings.get()` / `.set(patch)` / `.onChange(cb)` | Plugin-wide settings **with secrets** |
| `cache.wrap(key, ttlMs, fn)` / `get` / `set` / `delete` | In-memory TTL cache with request de-duplication |
| `emit(event, payload)` | Push to every open dashboard → `usePluginEvent(id, event, …)` |
| `dataDir` | `data/plugins/<id>/` — write files here (tokens, downloads) |
| `publicUrl()` | Base URL of the dashboard (OAuth redirects) |
| `onShutdown(cb)` | Close sockets / timers on exit and reload |
| `log` | `info / warn / error / debug` prefixed with your id |
| `manifest` | Your manifest |

Errors thrown inside `asyncHandler` become `{ error: message }` with status 500; the widget gets it
in `error` from `usePluginQuery`.

### Patterns worth copying

- **Live data:** hold a websocket on the server, keep a state map, `emit('state', …)` on change; the widget
  seeds from `GET /states` then applies events. → `plugins/home-assistant`
- **OAuth:** `POST /auth/start` returns `{ redirect }`, `GET /auth/callback` exchanges the code and stores
  tokens in `ctx.dataDir` (never in settings, which the browser can read masked). → `plugins/google-calendar`
- **Serving local files safely:** resolve against a configured root and refuse anything outside it.
  → `plugins/random-image`
- **Async options for pickers:** a route returning `SelectOption[]` plus `optionsFrom` in the manifest.
- **No server at all:** the clock plugin is client-only. Delete `server.ts` and the host still mounts a router that 404s.

## 4. Compatibility fields

Every manifest should declare what it was written against:

```ts
sdkVersion: 1,       // SDK major (src/sdk/types.ts SDK_VERSION). The host refuses a higher major.
minHost: '0.1.0',    // minimum MagicDash version
```

The host skips plugins it can't run and says why in the log and the Plugins dialog; the catalog hides them.

## 5. Sharing and installing plugins

**Pack** a plugin into a zip:

```bash
npm run pack-plugin my-widget      # → my-widget-1.0.0.zip
```

**Install** on any dashboard: *Edit → Add → Install a plugin…* and upload the `.zip` (or the folder itself).
The server writes it to `plugins/<id>/`, runs `npm run build`, and restarts, so the new tile appears in the
Add dialog about a minute later on a Pi 4. Custom plugins can be removed from the same dialog.

Or by hand / over SSH:

```bash
scp -r my-widget pi@raspberrypi.local:~/magicdash/plugins/
ssh pi@raspberrypi.local 'cd ~/magicdash && npm run build && sudo systemctl restart magicdash'
```

Installing a plugin runs its code on the Pi with the dashboard's permissions, so only install plugins you trust.
Set `MAGICDASH_PLUGIN_UPLOAD=off` in the systemd unit to disable upload from the browser.

Plugin ids must be kebab-case, and the six bundled ids can't be replaced by upload.

### Publishing to the catalog

The catalog is a JSON index at https://github.com/ninjawerk/magicdash-plugins that dashboards download and search
locally (Edit → Add → Browse & install plugins…). To list your plugin:

1. Put it in its own GitHub repo, tag a release, and attach the zip from `npm run pack-plugin <id>` as a release asset.
2. Open a PR to `magicdash-plugins` adding an entry to `index.json` with the asset URL and its `sha256sum`.
   CI checks the schema, downloads the zip, verifies the checksum and that the manifest id, version and sdkVersion match.
3. Ids are first come, first served; bundled ids are reserved. Entries start **unreviewed**; a maintainer marks a version
   **reviewed** after reading it. Say so honestly in your README — users see the badge.

Users can also add other indexes (a gist, a company server) under *Browse → Sources*.

## 6. Checklist before sharing

- [ ] `id` equals the folder name; `version` bumped; `sdkVersion` and `minHost` set
- [ ] Works at the `minSize` you declared and at 12×8
- [ ] Shows a helpful empty state before it is configured (and `openSettings` on click in edit mode)
- [ ] Network calls go through the server with `ctx.cache` so ten tiles don't make ten requests
- [ ] Secrets marked `secret: true` and only read via `ctx.settings.get()`
- [ ] `npm run typecheck` passes
