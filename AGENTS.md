# MagicDash — guide for AI agents and contributors

MagicDash is a plugin-based kiosk dashboard (Raspberry Pi + Chromium). This file explains how the pieces
interface so you can add a plugin, change the host, or drive a running dashboard without reading everything.

## Map

```
server/          Node/Express API + plugin loader           → runs on the Pi, port 3210
  index.ts       routes: layout, settings, events (SSE), backup, install, screens/attention
  plugins.ts     discovers plugins/*/manifest.ts + server.ts, mounts routers at /api/plugins/<id>
  storage.ts     JSON stores: data/layout.json (screens, tiles, theme, grid, rotation), data/settings.json
  events.ts      SSE bus: broadcast({ plugin, event, payload }) → every open dashboard
  feeds.ts       shared RSS/Atom parser for plugins
src/sdk/         THE CONTRACT. types.ts (shared) · client.ts (widget API, hooks) · server.ts (plugin ctx)
src/app/         host UI (React 18 + Vite + Tailwind v4): store.tsx, Dashboard.tsx (react-grid-layout), WidgetShell.tsx,
                 SchemaForm.tsx (auto settings forms), Dialogs.tsx, Toolbar.tsx, lib/themes.ts
plugins/<id>/    manifest.ts (no React/Node imports) · client.tsx · server.ts (optional) · _template/ to copy
mcp/server.ts    MCP server exposing the HTTP API as tools (npm run mcp)
kiosk/, image/   Pi install script, systemd unit, Chromium kiosk launcher, flashable image builder
docs/PLUGINS.md  plugin authoring guide · docs/PLUGIN-TUTORIAL.md step-by-step
```

## How the pieces talk

1. **Layout** lives on the server (`GET/PUT /api/layout`). Shape: `{ version: 1, grid, theme, rotation, screens: [{ id, name, widgets: [{ id, pluginId, x, y, w, h, title?, config }] }] }`.
   The browser store debounces saves; the server broadcasts `$host/layout` over SSE so other browsers (and the kiosk) update live.
2. **Plugin discovery**: browser → `import.meta.glob('../../../plugins/*/client.tsx')` at build time (so new plugins need `npm run build`);
   server → readdir `plugins/` at startup, imports `manifest.ts` and `server.ts`.
3. **Plugin backend routes** are mounted at `/api/plugins/<id>/…`. Widgets call them through `props.api.get/post` (pre-bound).
4. **Settings**: per-tile `config` (in the layout, sent to the browser) vs plugin-wide `settings` (server-side, `GET/PUT /api/settings/<id>`;
   fields marked `secret: true` are masked as `__SECRET_SET__` for the browser and only readable via `ctx.settings.get()` on the server).
5. **Realtime**: server plugins push with `ctx.emit(event, payload)`; widgets receive with `usePluginEvent(pluginId, event, handler)`.
   Host events use plugin id `$host`: `layout`, `settings`, `build`, `restarting`, `showScreen`, `attention`.
6. **Screens & rotation** are client-side: the store rotates `activeScreenId`; all screens stay mounted (hidden via visibility).
7. **Attention lock** (client-side, host-enforced): one holder, 120 s cap, plugin may release early, 30 s cooldown after auto-release.
   Widget: `props.attention.request(reason) → boolean`, `.release()`, `.held`, `.busy`. Server plugin: `ctx.requestAttention()/releaseAttention()`
   (emits `<pluginId>/$attention`). HTTP: `POST /api/attention { action, screenId, holder?, reason? }`.
8. **Manifest → UI**: `widgetConfig` and `settings` arrays of `ConfigField` are rendered by `SchemaForm` — no per-plugin settings UI.
   `select/multiselect` can load options from a plugin route via `optionsFrom`. `type: "custom"` fields map to `customFields[key]` React editors.
   `showWhen: { key, equals | oneOf }` hides fields conditionally.

## Widget contract (browser)

```ts
export default definePlugin<Config>({ manifest, Widget, customFields?, SettingsPanel? });
function Widget({ instanceId, config, settings, size, editMode, api, openSettings, setAlert, setBackground, attention }: WidgetProps<Config>)
```
- `size` = `{ w, h }` grid units + `{ width, height }` px: scale typography and decide which sections fit.
- `setAlert(true)` turns the tile red/pulsing; `setBackground(css)` paints the whole tile incl. title bar.
- Hooks: `usePluginQuery(api, path, { query, refreshMs, enabled })`, `usePluginEvent`, `useNow`, `useRotation`; helpers `formatDuration`, `formatTime`.
- Styling: Tailwind classes; theme tokens `var(--accent) --fg --cool --warm --surface --tile-bg --tile-radius`. Use `text-white/NN` for
  hierarchy (white is remapped to the theme text colour). Never hard-code blues/yellows for hot/cold — use `--cool/--warm`.

## Server contract

```ts
export default defineServerPlugin<Settings>((ctx) => { ctx.router.get('/x', asyncHandler(async (req, res) => res.json(...))); });
ctx: { manifest, router, settings{get,set,onChange}, cache{wrap,get,set,delete}, log, dataDir, emit, publicUrl, onShutdown, requestAttention, releaseAttention }
```
Cache upstream calls (`ctx.cache.wrap(key, ttlMs, fn)`); thrown errors become `{ error }` 500s the widget shows.

## Admin panel & auth

`/admin` is the same SPA (`src/app/admin/AdminApp.tsx`, routed by pathname) with a sidebar and pages that embed the existing
dialogs via `InlineModalContext` (Modal renders as a plain panel). Auth (`server/auth.ts`): one scrypt-hashed admin password
in `data/auth.json`, HMAC-signed session cookie `md_session` (30 d), bearer API tokens (hashed, shown once). `requireAuth`
protects every `/api/*` route except the public allowlist in `auth.ts` (kiosk reads, plugin backends, SSE, `screens/show`,
`attention`). The store exposes `auth`, `login`, `logout`, `setup`; the kiosk's edit mode opens the login dialog when
unauthenticated, and a 401 on save drops back out of edit mode. Logs: `server/logs.ts` wraps `console.*` into a 1000-line
ring buffer streamed as `$host/log`. Updates: `server/update.ts` (`git fetch` compare + GitHub latest release; run =
`git pull --ff-only` → `npm ci` → `npm run build` → exit in prod, streamed as `$host/update`). MCP passes `MAGICDASH_TOKEN`
as a bearer token.

## Catalog

`server/catalog.ts` downloads one or more JSON indexes (`$host.catalogSources` in data/settings.json, default the
`magicdash-plugins` repo), merges them (first source wins per id), annotates with installed version / update /
compatibility, and installs by downloading the pinned zip, verifying SHA-256 and manifest id, then reusing
`installPluginFiles`. Manifests carry `sdkVersion` (SDK major, `SDK_VERSION` in types.ts) and `minHost`;
`compatibilityIssue()` is the single place that decides. Bundled ids (`BUNDLED_PLUGINS`) are reserved.

## Conventions

- Plugin ids are kebab-case and equal the folder name. Bundled ids are listed in `server/install.ts` (`BUNDLED_PLUGINS`) — add new bundled ones there.
- Keep `manifest.ts` free of React/Node imports (shared by both sides).
- Widgets must render a helpful empty state before configuration and call `openSettings` on click in edit mode.
- Don't add dependencies for things `fetch` + a small parser can do; server-side fetches set a `user-agent`.
- Commits: plain messages, no attribution trailers.

## Running & testing

```bash
npm run dev          # server :3210 + Vite :5173 (proxy /api). tsx watch reloads server changes.
npm run typecheck    # covers host, SDK, plugins, mcp
npm run build        # required after adding a plugin (client discovery is build-time)
curl localhost:3210/api/health ; curl localhost:3210/api/plugins/<id>/<route>   # test plugin routes directly
```
There is no unit-test suite yet; verify routes with curl and widgets in the browser. `window.__magicdash` exposes host state
(attention, activeScreenId, rotation, editMode) for debugging.

## Driving a live dashboard

Use the MCP server (`npm run mcp`, env `MAGICDASH_URL`) or the HTTP API directly. Everything the UI can do is available:
layout PUT, settings PUT, `/api/screens/show`, `/api/attention`, `/api/export`, `/api/import`, `/api/plugins/install`, `/api/plugins/rebuild`.
Mutating routes need an admin session or an API token (`/admin → Settings`); the MCP reads it from `MAGICDASH_TOKEN`.
