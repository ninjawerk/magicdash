/**
 * MagicDash Plugin SDK — shared types.
 *
 * These types are imported by BOTH the browser (widgets) and the Node server
 * (plugin backends), so this file must stay free of React / Node imports.
 */

/** A single option for select / multiselect fields. */
export interface SelectOption {
  label: string;
  value: string;
  /** Optional secondary text shown under the label in pickers. */
  description?: string;
  /** Optional group heading used to cluster options in pickers. */
  group?: string;
}

interface BaseField {
  /** Key in the config object. */
  key: string;
  /** Human readable label. */
  label: string;
  /** Help text rendered under the input. */
  help?: string;
  /** Show this field only when another field equals a value (or one of several). */
  showWhen?: { key: string; equals?: unknown; oneOf?: unknown[] };
}

/**
 * Declarative form schema. The host renders a settings form from this so a
 * plugin does not need to write any settings UI. Plugins that need something
 * bespoke can add a `type: "custom"` field and supply a React editor via
 * `customFields` in `definePlugin`.
 */
export type ConfigField =
  | (BaseField & { type: 'string'; placeholder?: string; default?: string; secret?: boolean })
  | (BaseField & { type: 'textarea'; placeholder?: string; default?: string; rows?: number })
  | (BaseField & { type: 'number'; min?: number; max?: number; step?: number; default?: number; unit?: string })
  | (BaseField & { type: 'boolean'; default?: boolean })
  | (BaseField & { type: 'color'; default?: string })
  /** Calendar date, stored as "YYYY-MM-DD". */
  | (BaseField & { type: 'date'; default?: string; min?: string; max?: string })
  /** Local date and time, stored as "YYYY-MM-DDTHH:MM" (no zone — the kiosk's local time). */
  | (BaseField & { type: 'datetime'; default?: string; min?: string; max?: string })
  /** Time of day, stored as "HH:MM". */
  | (BaseField & { type: 'time'; default?: string })
  | (BaseField & {
      type: 'select';
      default?: string;
      /** Static options... */
      options?: SelectOption[];
      /** ...or a path on this plugin's server router (e.g. "calendars") that returns SelectOption[]. */
      optionsFrom?: string;
    })
  | (BaseField & {
      type: 'multiselect';
      default?: string[];
      options?: SelectOption[];
      optionsFrom?: string;
    })
  | (BaseField & { type: 'list'; itemLabel?: string; placeholder?: string; default?: string[] })
  | (BaseField & { type: 'custom'; default?: unknown })
  | (BaseField & { type: 'action'; /** Button that calls POST <router>/<action> */ action: string; buttonLabel: string; variant?: 'primary' | 'danger' | 'default' });

/**
 * SDK major version. Bump when WidgetProps / PluginServerContext change incompatibly.
 * Plugins declare the version they were written against; the host refuses a higher major.
 */
export const SDK_VERSION = 1;

export interface PluginManifest {
  /** Unique, url-safe id. Folder name under /plugins should match. */
  id: string;
  /** SDK major this plugin was written against (see SDK_VERSION). Required for catalog plugins. */
  sdkVersion?: number;
  /** Minimum MagicDash host version (semver), e.g. "0.1.0". */
  minHost?: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  /** Emoji or short text used in the widget palette. */
  icon?: string;
  /** Default tile size in grid units. */
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
  /**
   * Per-widget configuration (each tile gets its own values).
   * e.g. which entities to show, which calendars, location.
   */
  widgetConfig?: ConfigField[];
  /**
   * Plugin-wide settings shared by all tiles of this plugin
   * (API keys, tokens, OAuth connection...). Stored server-side.
   */
  settings?: ConfigField[];
  /** When true the widget draws its own chrome and the host hides the title bar. */
  frameless?: boolean;
}

/**
 * When something is visible. `from`/`to` are "HH:MM" local times (a window may wrap midnight);
 * `days` are 0-6 (Sunday = 0). Omitted parts mean "always".
 */
export interface TimeWindow {
  from?: string;
  to?: string;
  days?: number[];
}

/** True when `now` is inside the window (or the window is empty). */
export function inWindow(w: TimeWindow | undefined, now: Date): boolean {
  if (!w) return true;
  if (w.days && w.days.length > 0 && !w.days.includes(now.getDay())) return false;
  if (!w.from || !w.to) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = w.from.split(':').map(Number);
  const [th, tm] = w.to.split(':').map(Number);
  const f = fh * 60 + (fm || 0);
  const t = th * 60 + (tm || 0);
  if (f === t) return true;
  return f < t ? mins >= f && mins < t : mins >= f || mins < t; // wraps midnight
}

/** One tile on the dashboard. */
export interface WidgetInstance {
  id: string;
  pluginId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional custom title for the tile chrome. */
  title?: string;
  config: Record<string, unknown>;
  /** Only show this tile inside the window (e.g. news 06:00–09:00 on weekdays). */
  schedule?: TimeWindow;
}

export interface GridSettings {
  cols: number;
  rows: number;
  /** Gap between tiles in px. */
  gap: number;
  /** Outer padding in px. */
  padding: number;
}

/** A screen is one page of tiles. Dashboards can have several and rotate through them. */
export interface Screen {
  id: string;
  name: string;
  widgets: WidgetInstance[];
  /** Only include this screen in rotation inside the window. */
  schedule?: TimeWindow;
}

/** Dashboard-wide night mode: dim and optionally switch theme preset during a window. */
export interface NightMode {
  enabled: boolean;
  from: string;
  to: string;
  /** 10–100 (%). Applied as a software dim on the kiosk and as backlight level where supported. */
  brightness: number;
  /** Theme preset id to use during night mode (optional). */
  preset?: string;
}

export interface RotationSettings {
  enabled: boolean;
  /** Seconds each screen stays visible. */
  intervalSec: number;
}

/**
 * Attention lock rules (enforced by the host):
 *  - one holder at a time; a request while someone else holds it is refused
 *  - held for at most ATTENTION_MAX_MS, then released automatically
 *  - after an automatic release the same holder must wait ATTENTION_COOLDOWN_MS before asking again
 */
export const ATTENTION_MAX_MS = 120_000;
export const ATTENTION_COOLDOWN_MS = 30_000;

export interface AttentionLock {
  /** Who holds it: the requesting widget's instance id (or plugin id for server-side requests). */
  holder: string;
  pluginId: string;
  screenId: string;
  since: number;
  /** When the host will release it regardless. */
  expiresAt: number;
  reason?: string;
}

export interface DashboardLayout {
  version: 1;
  grid: GridSettings;
  /** Screens in rotation order. */
  screens: Screen[];
  rotation: RotationSettings;
  /** BCP-47 locale for host + plugin strings and date formatting, e.g. "en-GB", "de". Empty = browser default. */
  locale?: string;
  night?: NightMode;
  /** @deprecated pre-screens layouts stored tiles here; the server migrates them into screens[0]. */
  widgets?: WidgetInstance[];
  /** Global look. */
  theme: {
    /** Background — any CSS background value. */
    background: string;
    accent: string;
    /** Tile background & radius. */
    tileBackground: string;
    tileRadius: number;
    /** Show the tile title bar on all tiles. */
    showTitles: boolean;
    /** Main text colour. */
    fg: string;
    /** Dialog / toolbar background. */
    surface: string;
    /** Whether the theme is dark (affects native controls). */
    dark: boolean;
    /** A cool tone (cold temperatures, water, "off"). Exposed as --cool. */
    cool: string;
    /** A warm tone (heat, sun, "on"). Exposed as --warm. */
    warm: string;
    /** Id of the preset this theme was based on, if any. */
    preset?: string;
  };
}

/** A toast shown over the dashboard (host event `$host/notify`). */
export interface Toast {
  id: string;
  title?: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  /** Seconds before it auto-dismisses; 0 = sticky until tapped. */
  durationSec: number;
  /** Emoji or short text. */
  icon?: string;
  /** Show only on this screen (id or name); switches to it when `switchScreen` is set. */
  screen?: string;
  switchScreen?: boolean;
  at: string;
}

/** Display power / brightness state (host event `$host/display`). */
export interface DisplayState {
  on: boolean;
  /** 0–100 */
  brightness: number;
  /** Whether the server could drive a hardware backlight / output; otherwise the kiosk dims in software. */
  hardware: { backlight: boolean; power: boolean };
  reason?: string;
}

/** Event pushed from a plugin backend to the browser over SSE. */
export interface PluginEvent<T = unknown> {
  plugin: string;
  event: string;
  payload: T;
}

/** Sentinel value that replaces stored secrets when settings are read by a browser. */
export const SECRET_MASK = '__SECRET_SET__';

/** Migrate a stored layout to the current shape (screens + rotation). Safe to call repeatedly. */
export function normalizeLayout(raw: DashboardLayout): DashboardLayout {
  const l: DashboardLayout = { ...raw };
  if (!Array.isArray(l.screens) || l.screens.length === 0) {
    l.screens = [{ id: 'main', name: 'Main', widgets: Array.isArray(l.widgets) ? l.widgets : [] }];
  }
  delete l.widgets;
  const r: Partial<RotationSettings> = l.rotation ?? {};
  l.rotation = { enabled: !!r.enabled, intervalSec: Math.max(3, Number(r.intervalSec) || 30) };
  l.night = { enabled: false, from: '23:00', to: '06:30', brightness: 30, ...(l.night ?? {}) };
  return l;
}

/** Every tile across all screens. */
export function allWidgets(l: DashboardLayout): WidgetInstance[] {
  return l.screens.flatMap((s) => s.widgets);
}

/** Compare two semver strings (major.minor.patch, extra ignored). Returns -1, 0, 1. */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

/** Why a plugin can't run on this host, or undefined when it's fine. */
export function compatibilityIssue(m: { sdkVersion?: number; minHost?: string }, hostVersion: string): string | undefined {
  if (m.sdkVersion !== undefined && m.sdkVersion > SDK_VERSION) return `needs SDK v${m.sdkVersion}, this host provides v${SDK_VERSION}`;
  if (m.minHost && compareSemver(hostVersion, m.minHost) < 0) return `needs MagicDash ${m.minHost} or newer (you have ${hostVersion})`;
  return undefined;
}

/** Utility: build a config object from field defaults. */
export function defaultsFor(fields: ConfigField[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields ?? []) {
    if ('default' in f && f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}
