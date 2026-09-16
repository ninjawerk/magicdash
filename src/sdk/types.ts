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
  /** Show this field only when another field has a given value. */
  showWhen?: { key: string; equals: unknown };
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

export interface PluginManifest {
  /** Unique, url-safe id. Folder name under /plugins should match. */
  id: string;
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
}

export interface GridSettings {
  cols: number;
  rows: number;
  /** Gap between tiles in px. */
  gap: number;
  /** Outer padding in px. */
  padding: number;
}

export interface DashboardLayout {
  version: 1;
  grid: GridSettings;
  widgets: WidgetInstance[];
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

/** Event pushed from a plugin backend to the browser over SSE. */
export interface PluginEvent<T = unknown> {
  plugin: string;
  event: string;
  payload: T;
}

/** Sentinel value that replaces stored secrets when settings are read by a browser. */
export const SECRET_MASK = '__SECRET_SET__';

/** Utility: build a config object from field defaults. */
export function defaultsFor(fields: ConfigField[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields ?? []) {
    if ('default' in f && f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}
