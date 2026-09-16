#!/usr/bin/env -S npx tsx
/**
 * MagicDash MCP server — lets an AI agent (Claude Code, Claude Desktop, Cursor…) inspect and edit a running
 * dashboard over its HTTP API: screens, tiles, themes, plugin settings, attention, backups, plugin scaffolding.
 *
 *   MAGICDASH_URL=http://magicdash.local:3210 MAGICDASH_TOKEN=md_… npm run mcp        (stdio transport)
 *
 * Claude Code:   claude mcp add magicdash -e MAGICDASH_URL=http://localhost:3210 -e MAGICDASH_TOKEN=md_… -- npx tsx /path/to/magicdash/mcp/server.ts
 * Create the token under /admin → Settings → API tokens.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.MAGICDASH_URL ?? 'http://localhost:3210').replace(/\/$/, '');
/** Admin API token (create one under /admin → Settings → API tokens). Needed for anything that changes state. */
const TOKEN = process.env.MAGICDASH_TOKEN;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function api<T = unknown>(method: string, p: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = body === undefined ? {} : { 'content-type': 'application/json' };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const r = await fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* plain text */
  }
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? `${method} ${p} → ${r.status}`);
  return data as T;
}
const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });

interface Widget { id: string; pluginId: string; x: number; y: number; w: number; h: number; title?: string; config: Record<string, unknown> }
interface Screen { id: string; name: string; widgets: Widget[] }
interface Layout { version: 1; grid: { cols: number; rows: number; gap: number; padding: number }; screens: Screen[]; rotation: { enabled: boolean; intervalSec: number }; theme: Record<string, unknown> }
interface PluginInfo { manifest: { id: string; name: string; description: string; version: string; defaultSize: { w: number; h: number }; minSize?: { w: number; h: number }; widgetConfig?: unknown[]; settings?: unknown[] }; hasServer: boolean }

const getLayout = () => api<Layout>('GET', '/api/layout');
const putLayout = (l: Layout) => api('PUT', '/api/layout', l);
const findScreen = (l: Layout, ref: string | undefined) =>
  ref ? l.screens.find((s) => s.id === ref || s.name.toLowerCase() === ref.toLowerCase()) : l.screens[0];
function freeSpot(l: Layout, s: Screen, w: number, h: number) {
  const hit = (x: number, y: number) => s.widgets.some((t) => x < t.x + t.w && x + w > t.x && y < t.y + t.h && y + h > t.y);
  for (let y = 0; y + h <= l.grid.rows; y++) for (let x = 0; x + w <= l.grid.cols; x++) if (!hit(x, y)) return { x, y };
  return undefined;
}

const server = new McpServer({ name: 'magicdash', version: '0.1.0' });

// --- Read ---------------------------------------------------------------------------------------
server.registerTool('get_dashboard', { description: 'Full dashboard state: grid, theme, rotation, screens and every tile with its config.', inputSchema: {} }, async () => text(await getLayout()));

server.registerTool('list_plugins', { description: 'Installed plugins with their manifests (ids, sizes, per-tile config fields, plugin-wide settings fields).', inputSchema: {} }, async () =>
  text((await api<PluginInfo[]>('GET', '/api/plugins')).map((p) => p.manifest)),
);

server.registerTool('get_health', { description: 'Server health: connected dashboards, plugin ids, data directory, LAN addresses.', inputSchema: {} }, async () => text(await api('GET', '/api/health')));

server.registerTool(
  'get_plugin_settings',
  { description: 'Plugin-wide settings (secrets are masked as __SECRET_SET__).', inputSchema: { pluginId: z.string() } },
  async ({ pluginId }) => text(await api('GET', `/api/settings/${pluginId}`)),
);

server.registerTool(
  'call_plugin_route',
  {
    description: 'GET a route on a plugin backend, e.g. weather "/search?q=berlin", home-assistant "/entities", google-calendar "/status". Use list_plugins to see what exists; routes are documented in each plugin\'s server.ts.',
    inputSchema: { pluginId: z.string(), path: z.string().describe('Path with leading slash, may include a query string') },
  },
  async ({ pluginId, path: p }) => text(await api('GET', `/api/plugins/${pluginId}${p.startsWith('/') ? p : `/${p}`}`)),
);

// --- Tiles ---------------------------------------------------------------------------------------
server.registerTool(
  'add_tile',
  {
    description: 'Add a tile for a plugin to a screen. Position is optional (first free spot is used). Returns the new tile.',
    inputSchema: {
      pluginId: z.string(),
      screen: z.string().optional().describe('Screen id or name; defaults to the first screen'),
      x: z.number().int().min(0).optional(),
      y: z.number().int().min(0).optional(),
      w: z.number().int().min(1).optional(),
      h: z.number().int().min(1).optional(),
      title: z.string().optional(),
      config: z.record(z.string(), z.unknown()).optional().describe('Per-tile config; keys from the plugin manifest widgetConfig'),
    },
  },
  async (a) => {
    const [l, plugins] = await Promise.all([getLayout(), api<PluginInfo[]>('GET', '/api/plugins')]);
    const plugin = plugins.find((p) => p.manifest.id === a.pluginId);
    if (!plugin) throw new Error(`Unknown plugin "${a.pluginId}". Installed: ${plugins.map((p) => p.manifest.id).join(', ')}`);
    const screen = findScreen(l, a.screen);
    if (!screen) throw new Error('No such screen');
    const w = a.w ?? plugin.manifest.defaultSize.w;
    const h = a.h ?? plugin.manifest.defaultSize.h;
    const spot = a.x !== undefined && a.y !== undefined ? { x: a.x, y: a.y } : freeSpot(l, screen, w, h);
    if (!spot) throw new Error(`No free ${w}×${h} spot on "${screen.name}" (grid ${l.grid.cols}×${l.grid.rows}). Remove or shrink tiles, or add a screen.`);
    const tile: Widget = { id: `w-${a.pluginId}-${Math.random().toString(36).slice(2, 8)}`, pluginId: a.pluginId, ...spot, w, h, title: a.title, config: a.config ?? {} };
    screen.widgets.push(tile);
    await putLayout(l);
    return text(tile);
  },
);

server.registerTool(
  'update_tile',
  {
    description: 'Change a tile: position/size, title, or merge config keys. Pass config: { key: null } to delete a key.',
    inputSchema: {
      tileId: z.string(),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
      w: z.number().int().optional(),
      h: z.number().int().optional(),
      title: z.string().nullable().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    },
  },
  async (a) => {
    const l = await getLayout();
    for (const s of l.screens) {
      const t = s.widgets.find((w) => w.id === a.tileId);
      if (!t) continue;
      if (a.x !== undefined) t.x = a.x;
      if (a.y !== undefined) t.y = a.y;
      if (a.w !== undefined) t.w = a.w;
      if (a.h !== undefined) t.h = a.h;
      if (a.title !== undefined) t.title = a.title ?? undefined;
      if (a.config) for (const [k, v] of Object.entries(a.config)) v === null ? delete t.config[k] : (t.config[k] = v);
      await putLayout(l);
      return text(t);
    }
    throw new Error(`No tile "${a.tileId}"`);
  },
);

server.registerTool('remove_tile', { description: 'Remove a tile by id.', inputSchema: { tileId: z.string() } }, async ({ tileId }) => {
  const l = await getLayout();
  const before = l.screens.reduce((n, s) => n + s.widgets.length, 0);
  for (const s of l.screens) s.widgets = s.widgets.filter((w) => w.id !== tileId);
  if (l.screens.reduce((n, s) => n + s.widgets.length, 0) === before) throw new Error(`No tile "${tileId}"`);
  await putLayout(l);
  return text({ ok: true });
});

server.registerTool(
  'move_tile_to_screen',
  { description: 'Move a tile to another screen (first free spot).', inputSchema: { tileId: z.string(), screen: z.string() } },
  async ({ tileId, screen: ref }) => {
    const l = await getLayout();
    const target = findScreen(l, ref);
    if (!target) throw new Error('No such screen');
    for (const s of l.screens) {
      const i = s.widgets.findIndex((w) => w.id === tileId);
      if (i < 0) continue;
      const [t] = s.widgets.splice(i, 1);
      const spot = freeSpot(l, target, t.w, t.h);
      if (!spot) throw new Error('No room on the target screen');
      target.widgets.push({ ...t, ...spot });
      await putLayout(l);
      return text({ ok: true, tile: { ...t, ...spot } });
    }
    throw new Error(`No tile "${tileId}"`);
  },
);

// --- Screens & rotation -------------------------------------------------------------------------------
server.registerTool('add_screen', { description: 'Add an empty screen.', inputSchema: { name: z.string() } }, async ({ name }) => {
  const l = await getLayout();
  const s: Screen = { id: `s-${Math.random().toString(36).slice(2, 8)}`, name, widgets: [] };
  l.screens.push(s);
  await putLayout(l);
  return text(s);
});
server.registerTool('rename_screen', { description: 'Rename a screen.', inputSchema: { screen: z.string(), name: z.string() } }, async ({ screen: ref, name }) => {
  const l = await getLayout();
  const s = findScreen(l, ref);
  if (!s) throw new Error('No such screen');
  s.name = name;
  await putLayout(l);
  return text(s);
});
server.registerTool('remove_screen', { description: 'Delete a screen and its tiles (cannot delete the last one).', inputSchema: { screen: z.string() } }, async ({ screen: ref }) => {
  const l = await getLayout();
  const s = findScreen(l, ref);
  if (!s) throw new Error('No such screen');
  if (l.screens.length <= 1) throw new Error('Cannot delete the only screen');
  l.screens = l.screens.filter((x) => x.id !== s.id);
  await putLayout(l);
  return text({ ok: true });
});
server.registerTool(
  'set_rotation',
  { description: 'Turn screen rotation on/off and set the interval.', inputSchema: { enabled: z.boolean(), intervalSec: z.number().int().min(3).optional() } },
  async ({ enabled, intervalSec }) => {
    const l = await getLayout();
    l.rotation = { enabled, intervalSec: intervalSec ?? l.rotation.intervalSec };
    await putLayout(l);
    return text(l.rotation);
  },
);
server.registerTool('show_screen', { description: 'Switch connected dashboards to a screen now (no lock). Optional deviceId/name targets one display.', inputSchema: { screen: z.string(), deviceId: z.string().optional() } }, async ({ screen, deviceId }) =>
  text(await api('POST', '/api/screens/show', { screenId: screen, deviceId })),
);
server.registerTool('list_devices', { description: 'Output devices (kiosks/browsers showing the dashboard): online, ip, viewport, current screen, per-device config.', inputSchema: {} }, async () => text(await api('GET', '/api/devices')));
server.registerTool(
  'set_device',
  { description: 'Rename a device or set its config: screens (ids it cycles; empty = all), rotation {enabled, intervalSec}, brightness (10-100), power (auto|on|off).', inputSchema: { id: z.string(), name: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() } },
  async ({ id, name, config }) => text(await api('PUT', `/api/devices/${id}`, { name, config })),
);
server.registerTool('device_action', { description: 'identify (toast on that display), reload, or show a screen on one device.', inputSchema: { id: z.string(), action: z.enum(['identify', 'reload', 'show']), screenId: z.string().optional() } }, async ({ id, action, screenId }) =>
  text(await api('POST', `/api/devices/${id}/action`, { action, screenId })),
);
server.registerTool(
  'request_attention',
  {
    description: 'Pull a screen forward and hold it (attention lock: one holder, 120 s max). Call release_attention when done. Optional deviceId targets one display.',
    inputSchema: { screen: z.string(), reason: z.string().optional(), holder: z.string().optional(), deviceId: z.string().optional() },
  },
  async ({ screen, reason, holder, deviceId }) => text(await api('POST', '/api/attention', { action: 'request', screenId: screen, reason, holder, deviceId })),
);
server.registerTool('release_attention', { description: 'Release an attention lock taken via request_attention.', inputSchema: { holder: z.string().optional() } }, async ({ holder }) =>
  text(await api('POST', '/api/attention', { action: 'release', holder })),
);

// --- Theme & grid ---------------------------------------------------------------------------------------
server.registerTool(
  'set_theme',
  {
    description: 'Set theme tokens (any subset): background (CSS), accent, fg, surface, cool, warm, tileBackground, tileRadius, dark, showTitles, preset (id of a built-in preset).',
    inputSchema: { theme: z.record(z.string(), z.unknown()) },
  },
  async ({ theme }) => {
    const l = await getLayout();
    l.theme = { ...l.theme, ...theme };
    await putLayout(l);
    return text(l.theme);
  },
);
server.registerTool(
  'set_context',
  { description: 'Dashboard-wide facts shared with all tiles: location {name, lat, lon, country?, timezone?}, name (for greetings), units (metric|imperial). Pass null for a key to clear it.', inputSchema: { context: z.record(z.string(), z.unknown()) } },
  async ({ context }) => {
    const l = await getLayout();
    const next = { ...((l as unknown as { context?: Record<string, unknown> }).context ?? {}) };
    for (const [k, v] of Object.entries(context)) v === null ? delete next[k] : (next[k] = v);
    (l as unknown as { context?: Record<string, unknown> }).context = next;
    await putLayout(l);
    return text(next);
  },
);
server.registerTool(
  'set_grid',
  { description: 'Grid settings.', inputSchema: { cols: z.number().int().min(4).max(48).optional(), rows: z.number().int().min(2).max(32).optional(), gap: z.number().optional(), padding: z.number().optional() } },
  async (g) => {
    const l = await getLayout();
    l.grid = { ...l.grid, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined)) } as Layout['grid'];
    await putLayout(l);
    return text(l.grid);
  },
);

// --- Plugin settings, backup, install ----------------------------------------------------------------------
server.registerTool(
  'set_plugin_settings',
  { description: 'Merge plugin-wide settings (tokens, keys, folder paths). Keys from the manifest settings list.', inputSchema: { pluginId: z.string(), settings: z.record(z.string(), z.unknown()) } },
  async ({ pluginId, settings }) => {
    const cur = await api<Record<string, unknown>>('GET', `/api/settings/${pluginId}`);
    await api('PUT', `/api/settings/${pluginId}`, { ...cur, ...settings });
    return text(await api('GET', `/api/settings/${pluginId}`));
  },
);
server.registerTool('export_backup', { description: 'Export the whole dashboard (layout + plugin settings) as JSON. includeSecrets=false strips tokens.', inputSchema: { includeSecrets: z.boolean().optional() } }, async ({ includeSecrets }) =>
  text(await api('GET', `/api/export?secrets=${includeSecrets ? 1 : 0}`)),
);
server.registerTool(
  'import_backup',
  { description: 'Restore a backup object produced by export_backup.', inputSchema: { backup: z.record(z.string(), z.unknown()), layout: z.boolean().optional(), settings: z.boolean().optional() } },
  async ({ backup, layout, settings }) => text(await api('POST', '/api/import', { backup, layout: layout ?? true, settings: settings ?? true })),
);
server.registerTool('list_installed_plugins', { description: 'Bundled vs custom plugins and whether each is loaded.', inputSchema: {} }, async () => text(await api('GET', '/api/plugins/installed')));
server.registerTool(
  'install_plugin_files',
  {
    description: 'Install a plugin from source files (manifest.ts, client.tsx, optional server.ts). Then call rebuild_and_restart. Read docs/PLUGINS.md and AGENTS.md for the plugin contract.',
    inputSchema: { files: z.array(z.object({ path: z.string(), content: z.string() })), replace: z.boolean().optional() },
  },
  async ({ files, replace }) => text(await api('POST', '/api/plugins/install', { files, replace: !!replace })),
);
server.registerTool(
  'search_catalog',
  { description: 'Search the plugin catalog(s). Returns entries with version, author, tags, reviewed flag, whether installed / update available / incompatible.', inputSchema: { query: z.string().optional(), refresh: z.boolean().optional() } },
  async ({ query, refresh }) => {
    const c = await api<{ items: Array<Record<string, unknown> & { name: string; description: string; author: string; tags?: string[] }>; sources: unknown[] }>('GET', `/api/catalog${refresh ? '?refresh=1' : ''}`);
    const q = query?.toLowerCase();
    const items = q ? c.items.filter((i) => [i.name, i.description, i.author, ...(i.tags ?? [])].some((v) => String(v).toLowerCase().includes(q))) : c.items;
    return text({ sources: c.sources, items });
  },
);
server.registerTool(
  'install_from_catalog',
  {
    description: 'Install (or update) a catalog plugin by id: downloads the pinned release zip, verifies its SHA-256 and compatibility, installs it. Then call rebuild_and_restart. Tell the user if the entry is unreviewed — it runs code on their device.',
    inputSchema: { id: z.string() },
  },
  async ({ id }) => text(await api('POST', '/api/catalog/install', { id, replace: true })),
);
server.registerTool('set_catalog_sources', { description: 'Replace the list of catalog index URLs (raw GitHub file, gist, your own server).', inputSchema: { sources: z.array(z.string().url()) } }, async ({ sources }) =>
  text(await api('PUT', '/api/catalog/sources', { sources })),
);
server.registerTool(
  'notify',
  { description: 'Show a toast notification on every connected dashboard (e.g. "Washing machine done"), or on one device via deviceId/name. Optional screen to switch to.', inputSchema: { message: z.string(), title: z.string().optional(), level: z.enum(['info', 'success', 'warn', 'error']).optional(), durationSec: z.number().optional(), icon: z.string().optional(), screen: z.string().optional(), switchScreen: z.boolean().optional(), deviceId: z.string().optional() } },
  async (t) => text(await api('POST', '/api/notify', t)),
);
server.registerTool('get_display', { description: 'Display power/brightness state, schedule, presence and manual override.', inputSchema: {} }, async () => text(await api('GET', '/api/display')));
server.registerTool(
  'set_display',
  { description: 'Turn the display on/off (optionally for N seconds), set brightness (10-100), or clear the manual override to return to the schedule.', inputSchema: { on: z.boolean().optional(), brightness: z.number().min(10).max(100).optional(), forSeconds: z.number().optional(), clear: z.boolean().optional() } },
  async (b) => text(await api('POST', '/api/display', b)),
);
server.registerTool(
  'set_display_settings',
  { description: 'Display schedule (off/on times, days), daytime brightness, Home Assistant presence entities that wake it, wake seconds, stay-on-while-present.', inputSchema: { settings: z.record(z.string(), z.unknown()) } },
  async ({ settings }) => text(await api('PUT', '/api/display/settings', settings)),
);
server.registerTool('rebuild_and_restart', { description: 'Rebuild the frontend and (in production) restart the server so new plugins load. Takes ~1 min on a Pi.', inputSchema: {} }, async () => text(await api('POST', '/api/plugins/rebuild')));

// --- Local repo helpers (when the MCP runs from a checkout) ---------------------------------------------------
server.registerTool('read_plugin_docs', { description: 'Return the plugin authoring guide (docs/PLUGINS.md) and AGENTS.md from the local checkout.', inputSchema: {} }, async () => {
  const [a, b] = await Promise.all([fs.readFile(path.join(ROOT, 'AGENTS.md'), 'utf8').catch(() => ''), fs.readFile(path.join(ROOT, 'docs/PLUGINS.md'), 'utf8').catch(() => '')]);
  return text(`${a}\n\n---\n\n${b}`);
});
server.registerTool('read_plugin_source', { description: 'Read a bundled plugin\'s files from the local checkout as reference (e.g. "weather").', inputSchema: { pluginId: z.string() } }, async ({ pluginId }) => {
  const dir = path.join(ROOT, 'plugins', pluginId);
  const files = await fs.readdir(dir);
  const out: Record<string, string> = {};
  for (const f of files) if (/\.(ts|tsx|json|md)$/.test(f)) out[f] = await fs.readFile(path.join(dir, f), 'utf8');
  return text(out);
});

const transport = new StdioServerTransport();
await server.connect(transport);
