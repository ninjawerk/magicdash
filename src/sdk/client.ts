/**
 * MagicDash Plugin SDK — browser side.
 *
 * A plugin's `client.tsx` exports `default definePlugin({...})`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { PluginEvent, PluginManifest, SelectOption } from './types';

export * from './types';

/** Props every widget receives from the host. */
export interface WidgetProps<C = Record<string, unknown>> {
  /** Unique id for this tile. */
  instanceId: string;
  /** This tile's configuration (see manifest.widgetConfig). */
  config: C;
  /** Plugin-wide settings with secrets masked (see manifest.settings). */
  settings: Record<string, unknown>;
  /** Current tile size in grid units and pixels. */
  size: { w: number; h: number; width: number; height: number };
  /** True while the user is arranging the dashboard. */
  editMode: boolean;
  /** Pre-bound helpers for talking to this plugin's server routes. */
  api: PluginApi;
  /** Ask the host to open this tile's settings dialog. */
  openSettings: () => void;
  /**
   * Flag the tile as urgent: the host turns the tile red and pulses it.
   * Call with `false` to clear. Idempotent — safe to call every render.
   */
  setAlert: (on: boolean) => void;
  /**
   * Paint the whole tile — title bar included — with a CSS background (gradient, colour, image).
   * Pass `undefined` to clear. Keep it translucent so it works on every theme.
   */
  setBackground: (css: string | undefined) => void;
}

export interface PluginApi {
  /** Absolute URL for a path on this plugin's router. */
  url: (path: string, query?: Record<string, string | number | boolean | undefined>) => string;
  get: <T = unknown>(path: string, query?: Record<string, string | number | boolean | undefined>) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}

/** Custom editor for a `type: "custom"` config field. */
export interface CustomFieldProps<V = unknown> {
  value: V;
  onChange: (v: V) => void;
  /** The whole (draft) config so editors can read sibling fields. */
  config: Record<string, unknown>;
  api: PluginApi;
}

export interface ClientPlugin<C = Record<string, unknown>> {
  manifest: PluginManifest;
  Widget: ComponentType<WidgetProps<C>>;
  /** Editors for fields declared with `type: "custom"`, keyed by field key. */
  customFields?: Record<string, ComponentType<CustomFieldProps>>;
  /** Optional rich UI rendered at the top of this plugin's global settings dialog. */
  SettingsPanel?: ComponentType<{ settings: Record<string, unknown>; api: PluginApi; reload: () => void }>;
}

export function definePlugin<C = Record<string, unknown>>(plugin: ClientPlugin<C>): ClientPlugin<C> {
  return plugin;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export function createPluginApi(pluginId: string): PluginApi {
  const base = `/api/plugins/${pluginId}`;
  const url: PluginApi['url'] = (path, query) => {
    const clean = path.startsWith('/') ? path : `/${path}`;
    const u = `${base}${clean}`;
    if (!query) return u;
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return qs ? `${u}?${qs}` : u;
  };
  async function handle<T>(res: Response): Promise<T> {
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* not json */
    }
    if (!res.ok) {
      const msg = (data as { error?: string })?.error ?? res.statusText;
      throw new ApiError(res.status, msg, data);
    }
    return data as T;
  }
  return {
    url,
    get: <T,>(path: string, query?: Record<string, string | number | boolean | undefined>) => fetch(url(path, query)).then((r) => handle<T>(r)),
    post: <T,>(path: string, body?: unknown) =>
      fetch(url(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then((r) => handle<T>(r)),
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface QueryState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  refresh: () => void;
  /** Timestamp of the last successful fetch. */
  updatedAt: number | undefined;
}

/**
 * Poll a plugin route. Re-fetches when `deps` change or every `refreshMs`.
 * Pass `enabled: false` to pause (e.g. until the plugin is configured).
 */
export function usePluginQuery<T>(
  api: PluginApi,
  path: string,
  opts: {
    query?: Record<string, string | number | boolean | undefined>;
    refreshMs?: number;
    enabled?: boolean;
    deps?: unknown[];
  } = {},
): QueryState<T> {
  const { refreshMs, enabled = true } = opts;
  const queryKey = JSON.stringify(opts.query ?? {});
  const depsKey = JSON.stringify(opts.deps ?? []);
  const [state, setState] = useState<Omit<QueryState<T>, 'refresh'>>({
    data: undefined,
    error: undefined,
    loading: enabled,
    updatedAt: undefined,
  });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const data = await api.get<T>(path, opts.query);
        if (!cancelled) setState({ data, error: undefined, loading: false, updatedAt: Date.now() });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, error: (e as Error).message, loading: false }));
      }
      if (!cancelled && refreshMs) timer = setTimeout(run, refreshMs);
    };
    setState((s) => ({ ...s, loading: s.data === undefined }));
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, path, queryKey, depsKey, refreshMs, enabled, tick]);

  return { ...state, refresh };
}

/** Options loader for select fields (used by the host and available to plugins). */
export async function loadOptions(api: PluginApi, path: string): Promise<SelectOption[]> {
  const res = await api.get<SelectOption[]>(path);
  return Array.isArray(res) ? res : [];
}

// --- Server-Sent Events bus ------------------------------------------------

type Listener = (ev: PluginEvent) => void;
const listeners = new Set<Listener>();
let source: EventSource | undefined;

function ensureSource() {
  if (source || typeof window === 'undefined') return;
  source = new EventSource('/api/events');
  source.onmessage = (m) => {
    try {
      const ev = JSON.parse(m.data) as PluginEvent;
      listeners.forEach((l) => l(ev));
    } catch {
      /* ignore */
    }
  };
  source.onerror = () => {
    // EventSource auto-reconnects. Nothing to do.
  };
}

/** Subscribe to a raw event stream (all plugins). */
export function subscribeEvents(listener: Listener): () => void {
  ensureSource();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Subscribe to events emitted by one plugin's backend via `ctx.emit(event, payload)`. */
export function usePluginEvent<T = unknown>(
  pluginId: string,
  event: string | undefined,
  handler: (payload: T, ev: PluginEvent<T>) => void,
) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    return subscribeEvents((ev) => {
      if (ev.plugin !== pluginId) return;
      if (event && ev.event !== event) return;
      ref.current(ev.payload as T, ev as PluginEvent<T>);
    });
  }, [pluginId, event]);
}

/** Re-render on an interval; returns the current Date. Great for clocks & countdowns. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Cycle an index every `intervalMs` — handy for slideshows and quote rotation. */
export function useRotation(length: number, intervalMs: number, opts: { random?: boolean } = {}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (opts.random) {
          let n = Math.floor(Math.random() * length);
          if (n === i) n = (n + 1) % length;
          return n;
        }
        return (i + 1) % length;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs, opts.random]);
  return [Math.min(index, Math.max(0, length - 1)), setIndex] as const;
}

// ---------------------------------------------------------------------------
// Formatting helpers commonly needed by widgets
// ---------------------------------------------------------------------------

/** "1h 12m", "45m", "0:59" style durations. */
export function formatDuration(ms: number, opts: { seconds?: boolean } = {}): string {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  let out: string;
  if (opts.seconds || totalSec < 60) {
    out = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  } else if (h >= 24) {
    const d = Math.floor(h / 24);
    out = `${d}d ${h % 24}h`;
  } else if (h > 0) {
    out = m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    out = `${m}m`;
  }
  return neg ? `-${out}` : out;
}

export function formatTime(d: Date | string | number, opts: { hour12?: boolean } = {}): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: opts.hour12 });
}

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
