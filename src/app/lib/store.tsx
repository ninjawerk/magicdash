import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DashboardLayout, WidgetInstance } from '@sdk';
import { defaultsFor } from '@sdk';
import { subscribeEvents, createPluginApi, type PluginApi } from '@sdk/client';
import { hostApi } from './api';
import { getClientPlugin, listClientPlugins } from './registry';

export type DialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'widget'; widgetId: string }
  | { kind: 'plugin'; pluginId: string }
  | { kind: 'theme' }
  | { kind: 'backup' };

interface Store {
  layout: DashboardLayout | undefined;
  error: string | undefined;
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  dialog: DialogState;
  setDialog: (d: DialogState) => void;
  /** Masked plugin-wide settings keyed by plugin id. */
  pluginSettings: Record<string, Record<string, unknown>>;
  reloadPluginSettings: (pluginId?: string) => Promise<void>;
  apiFor: (pluginId: string) => PluginApi;
  updateLayout: (fn: (l: DashboardLayout) => DashboardLayout) => void;
  updateWidget: (id: string, patch: Partial<WidgetInstance>) => void;
  addWidget: (pluginId: string) => void;
  removeWidget: (id: string) => void;
  draggingRef: React.MutableRefObject<boolean>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

function findFreeSpot(layout: DashboardLayout, w: number, h: number): { x: number; y: number } {
  const { cols, rows } = layout.grid;
  const occupied = (x: number, y: number) =>
    layout.widgets.some((wi) => x < wi.x + wi.w && x + w > wi.x && y < wi.y + wi.h && y + h > wi.y);
  for (let y = 0; y + h <= rows; y++) {
    for (let x = 0; x + w <= cols; x++) {
      if (!occupied(x, y)) return { x, y };
    }
  }
  // No free space: stack at the bottom (grid will clamp).
  return { x: 0, y: Math.max(0, rows - h) };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<DashboardLayout>();
  const [error, setError] = useState<string>();
  const [editMode, setEditMode] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [pluginSettings, setPluginSettings] = useState<Record<string, Record<string, unknown>>>({});
  const lastSaved = useRef<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const draggingRef = useRef(false);
  const apis = useRef(new Map<string, PluginApi>());

  const apiFor = useCallback((pluginId: string) => {
    let a = apis.current.get(pluginId);
    if (!a) apis.current.set(pluginId, (a = createPluginApi(pluginId)));
    return a;
  }, []);

  const reloadPluginSettings = useCallback(async (pluginId?: string) => {
    const ids = pluginId ? [pluginId] : listClientPlugins().map((p) => p.manifest.id);
    const entries = await Promise.all(
      ids.map(async (id) => [id, await hostApi.getSettings(id).catch(() => ({}))] as const),
    );
    setPluginSettings((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  // Initial load — keep retrying so a kiosk that boots before the network is up recovers on its own.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async () => {
      try {
        const l = await hostApi.getLayout();
        if (cancelled) return;
        lastSaved.current = JSON.stringify(l);
        setLayout(l);
        setError(undefined);
        reloadPluginSettings();
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        timer = setTimeout(attempt, 2000);
      }
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reloadPluginSettings]);

  // Live sync from other browsers / the server
  useEffect(() => {
    return subscribeEvents((ev) => {
      if (ev.plugin !== '$host') return;
      if (ev.event === 'layout') {
        const incoming = ev.payload as DashboardLayout;
        const json = JSON.stringify(incoming);
        if (json === lastSaved.current || draggingRef.current) return;
        lastSaved.current = json;
        setLayout(incoming);
      }
      if (ev.event === 'settings') {
        const { pluginId } = ev.payload as { pluginId: string };
        reloadPluginSettings(pluginId);
      }
    });
  }, [reloadPluginSettings]);

  // Debounced persistence
  const persist = useCallback((next: DashboardLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const json = JSON.stringify(next);
      if (json === lastSaved.current) return;
      lastSaved.current = json;
      hostApi.saveLayout(next).catch((e) => console.error('save failed', e));
    }, 400);
  }, []);

  const updateLayout = useCallback(
    (fn: (l: DashboardLayout) => DashboardLayout) => {
      setLayout((l) => {
        if (!l) return l;
        const next = fn(l);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateWidget = useCallback(
    (id: string, patch: Partial<WidgetInstance>) =>
      updateLayout((l) => ({ ...l, widgets: l.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
    [updateLayout],
  );

  const addWidget = useCallback(
    (pluginId: string) => {
      const plugin = getClientPlugin(pluginId);
      if (!plugin) return;
      const { w, h } = plugin.manifest.defaultSize;
      const id = `w-${pluginId}-${Math.random().toString(36).slice(2, 8)}`;
      updateLayout((l) => {
        const spot = findFreeSpot(l, w, h);
        return {
          ...l,
          widgets: [...l.widgets, { id, pluginId, ...spot, w, h, config: defaultsFor(plugin.manifest.widgetConfig) }],
        };
      });
      setDialog({ kind: 'widget', widgetId: id });
    },
    [updateLayout],
  );

  const removeWidget = useCallback(
    (id: string) => updateLayout((l) => ({ ...l, widgets: l.widgets.filter((w) => w.id !== id) })),
    [updateLayout],
  );

  const value = useMemo<Store>(
    () => ({
      layout,
      error,
      editMode,
      setEditMode,
      dialog,
      setDialog,
      pluginSettings,
      reloadPluginSettings,
      apiFor,
      updateLayout,
      updateWidget,
      addWidget,
      removeWidget,
      draggingRef,
    }),
    [layout, error, editMode, dialog, pluginSettings, reloadPluginSettings, apiFor, updateLayout, updateWidget, addWidget, removeWidget],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
