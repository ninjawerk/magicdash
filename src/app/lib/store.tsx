import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AttentionLock, DashboardLayout, Screen, WidgetInstance } from '@sdk';
import { ATTENTION_COOLDOWN_MS, ATTENTION_MAX_MS, allWidgets, defaultsFor, normalizeLayout } from '@sdk';
import { subscribeEvents, createPluginApi, type PluginApi } from '@sdk/client';
import { hostApi } from './api';
import { getClientPlugin, listClientPlugins } from './registry';

export type DialogState =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'widget'; widgetId: string }
  | { kind: 'plugin'; pluginId: string }
  | { kind: 'theme' }
  | { kind: 'backup' }
  | { kind: 'install' }
  | { kind: 'screens' }
  | { kind: 'login' };

export interface AuthState {
  configured: boolean;
  authenticated: boolean;
  loaded: boolean;
}

interface Store {
  auth: AuthState;
  refreshAuth: () => Promise<AuthState>;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  setup: (password: string) => Promise<void>;
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
  getWidget: (id: string) => { widget: WidgetInstance; screen: Screen } | undefined;
  updateWidget: (id: string, patch: Partial<WidgetInstance>) => void;
  addWidget: (pluginId: string) => void;
  removeWidget: (id: string) => void;
  draggingRef: React.MutableRefObject<boolean>;

  // Screens & rotation
  activeScreenId: string;
  /** Show a screen now; resets the rotation timer. */
  showScreen: (id: string, opts?: { user?: boolean }) => void;
  addScreen: (name?: string) => string;
  removeScreen: (id: string) => void;
  renameScreen: (id: string, name: string) => void;
  moveScreen: (id: string, dir: -1 | 1) => void;

  // Attention lock
  attention: AttentionLock | null;
  requestAttention: (holder: string, pluginId: string, screenId: string, reason?: string) => boolean;
  releaseAttention: (holder: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

function findFreeSpot(layout: DashboardLayout, screen: Screen, w: number, h: number): { x: number; y: number } {
  const { cols, rows } = layout.grid;
  const occupied = (x: number, y: number) => screen.widgets.some((wi) => x < wi.x + wi.w && x + w > wi.x && y < wi.y + wi.h && y + h > wi.y);
  for (let y = 0; y + h <= rows; y++) {
    for (let x = 0; x + w <= cols; x++) {
      if (!occupied(x, y)) return { x, y };
    }
  }
  return { x: 0, y: Math.max(0, rows - h) };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<DashboardLayout>();
  const [error, setError] = useState<string>();
  const [editMode, setEditMode] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [pluginSettings, setPluginSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [activeScreenId, setActiveScreenId] = useState('main');
  const [attention, setAttention] = useState<AttentionLock | null>(null);
  const [auth, setAuth] = useState<AuthState>({ configured: false, authenticated: false, loaded: false });

  const refreshAuth = useCallback(async () => {
    const st = await hostApi.authStatus().catch(() => ({ configured: false, authenticated: false }));
    const next = { ...st, loaded: true };
    setAuth(next);
    return next;
  }, []);
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);
  const login = useCallback(
    async (password: string) => {
      await hostApi.login(password);
      await refreshAuth();
    },
    [refreshAuth],
  );
  const logout = useCallback(async () => {
    await hostApi.logout();
    setEditMode(false);
    await refreshAuth();
  }, [refreshAuth]);
  const setup = useCallback(
    async (password: string) => {
      await hostApi.setupPassword(password);
      await refreshAuth();
    },
    [refreshAuth],
  );
  const lastSaved = useRef<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const draggingRef = useRef(false);
  const apis = useRef(new Map<string, PluginApi>());
  const rotationTick = useRef(0);
  const [rotationReset, setRotationReset] = useState(0);
  const attentionTimer = useRef<ReturnType<typeof setTimeout>>();
  /** holder → time an automatic release happened (cooldown). */
  const cooldowns = useRef(new Map<string, number>());
  const layoutRef = useRef<DashboardLayout>();
  layoutRef.current = layout;
  const attentionRef = useRef<AttentionLock | null>(null);
  attentionRef.current = attention;

  const apiFor = useCallback((pluginId: string) => {
    let a = apis.current.get(pluginId);
    if (!a) apis.current.set(pluginId, (a = createPluginApi(pluginId)));
    return a;
  }, []);

  const reloadPluginSettings = useCallback(async (pluginId?: string) => {
    const ids = pluginId ? [pluginId] : listClientPlugins().map((p) => p.manifest.id);
    const entries = await Promise.all(ids.map(async (id) => [id, await hostApi.getSettings(id).catch(() => ({}))] as const));
    setPluginSettings((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  const applyIncoming = useCallback((raw: DashboardLayout) => {
    const l = normalizeLayout(raw);
    setLayout(l);
    setActiveScreenId((cur) => (l.screens.some((s) => s.id === cur) ? cur : l.screens[0].id));
  }, []);

  // Initial load — keep retrying so a kiosk that boots before the network is up recovers on its own.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async () => {
      try {
        const l = await hostApi.getLayout();
        if (cancelled) return;
        lastSaved.current = JSON.stringify(normalizeLayout(l));
        applyIncoming(l);
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
  }, [reloadPluginSettings, applyIncoming]);

  // Debounced persistence
  const persist = useCallback((next: DashboardLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const json = JSON.stringify(next);
      if (json === lastSaved.current) return;
      lastSaved.current = json;
      hostApi.saveLayout(next).catch((e) => {
        console.error('save failed', e);
        if (/sign in|password/i.test((e as Error).message)) {
          setEditMode(false);
          setDialog({ kind: 'login' });
        }
      });
    }, 400);
  }, []);

  const updateLayout = useCallback(
    (fn: (l: DashboardLayout) => DashboardLayout) => {
      setLayout((l) => {
        if (!l) return l;
        const next = fn(l);
        if (next !== l) persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateScreen = useCallback(
    (screenId: string, fn: (s: Screen) => Screen) => updateLayout((l) => ({ ...l, screens: l.screens.map((s) => (s.id === screenId ? fn(s) : s)) })),
    [updateLayout],
  );

  const getWidget = useCallback(
    (id: string) => {
      for (const screen of layout?.screens ?? []) {
        const widget = screen.widgets.find((w) => w.id === id);
        if (widget) return { widget, screen };
      }
      return undefined;
    },
    [layout],
  );

  const updateWidget = useCallback(
    (id: string, patch: Partial<WidgetInstance>) =>
      updateLayout((l) => ({
        ...l,
        screens: l.screens.map((s) => (s.widgets.some((w) => w.id === id) ? { ...s, widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) } : s)),
      })),
    [updateLayout],
  );

  const addWidget = useCallback(
    (pluginId: string) => {
      const plugin = getClientPlugin(pluginId);
      if (!plugin) return;
      const { w, h } = plugin.manifest.defaultSize;
      const id = `w-${pluginId}-${Math.random().toString(36).slice(2, 8)}`;
      updateLayout((l) => {
        const screen = l.screens.find((s) => s.id === activeScreenId) ?? l.screens[0];
        const spot = findFreeSpot(l, screen, w, h);
        const widget: WidgetInstance = { id, pluginId, ...spot, w, h, config: defaultsFor(plugin.manifest.widgetConfig) };
        return { ...l, screens: l.screens.map((s) => (s.id === screen.id ? { ...s, widgets: [...s.widgets, widget] } : s)) };
      });
      setDialog({ kind: 'widget', widgetId: id });
    },
    [updateLayout, activeScreenId],
  );

  const removeWidget = useCallback(
    (id: string) => updateLayout((l) => ({ ...l, screens: l.screens.map((s) => ({ ...s, widgets: s.widgets.filter((w) => w.id !== id) })) })),
    [updateLayout],
  );

  // --- Screens -----------------------------------------------------------------------
  const showScreen = useCallback((id: string) => {
    setActiveScreenId(id);
    setRotationReset((n) => n + 1);
  }, []);

  const addScreen = useCallback(
    (name?: string) => {
      const id = `s-${Math.random().toString(36).slice(2, 8)}`;
      updateLayout((l) => ({ ...l, screens: [...l.screens, { id, name: name ?? `Screen ${l.screens.length + 1}`, widgets: [] }] }));
      setActiveScreenId(id);
      return id;
    },
    [updateLayout],
  );

  const removeScreen = useCallback(
    (id: string) =>
      updateLayout((l) => {
        if (l.screens.length <= 1) return l;
        const screens = l.screens.filter((s) => s.id !== id);
        setActiveScreenId((cur) => (cur === id ? screens[0].id : cur));
        return { ...l, screens };
      }),
    [updateLayout],
  );

  const renameScreen = useCallback((id: string, name: string) => updateScreen(id, (s) => ({ ...s, name })), [updateScreen]);

  const moveScreen = useCallback(
    (id: string, dir: -1 | 1) =>
      updateLayout((l) => {
        const i = l.screens.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= l.screens.length) return l;
        const screens = [...l.screens];
        [screens[i], screens[j]] = [screens[j], screens[i]];
        return { ...l, screens };
      }),
    [updateLayout],
  );

  // --- Attention lock ------------------------------------------------------------------
  const releaseAttention = useCallback((holder: string, auto = false) => {
    const cur = attentionRef.current;
    if (!cur || cur.holder !== holder) return;
    if (attentionTimer.current) clearTimeout(attentionTimer.current);
    attentionTimer.current = undefined;
    if (auto) cooldowns.current.set(holder, Date.now());
    setAttention(null);
    setRotationReset((n) => n + 1); // rotation resumes from now
  }, []);

  const requestAttention = useCallback(
    (holder: string, pluginId: string, screenId: string, reason?: string): boolean => {
      const cur = attentionRef.current;
      const now = Date.now();
      if (cur && cur.holder !== holder) return false; // someone else has it
      if (cur && cur.holder === holder) return true; // already ours — no extension
      const cooledAt = cooldowns.current.get(holder);
      if (cooledAt && now - cooledAt < ATTENTION_COOLDOWN_MS) return false;
      const lock: AttentionLock = { holder, pluginId, screenId, since: now, expiresAt: now + ATTENTION_MAX_MS, reason };
      setAttention(lock);
      attentionRef.current = lock;
      setActiveScreenId(screenId);
      if (attentionTimer.current) clearTimeout(attentionTimer.current);
      attentionTimer.current = setTimeout(() => releaseAttention(holder, true), ATTENTION_MAX_MS);
      return true;
    },
    [releaseAttention],
  );

  const releaseAttentionPublic = useCallback((holder: string) => releaseAttention(holder, false), [releaseAttention]);

  // --- Rotation timer ------------------------------------------------------------------
  const rotationOn = !!layout?.rotation.enabled && (layout?.screens.length ?? 0) > 1 && !editMode && dialog.kind === 'none' && !attention;
  const intervalSec = layout?.rotation.intervalSec ?? 30;
  useEffect(() => {
    if (!rotationOn) return;
    const id = setInterval(() => {
      const l = layoutRef.current;
      if (!l) return;
      rotationTick.current++;
      setActiveScreenId((cur) => {
        const i = l.screens.findIndex((s) => s.id === cur);
        return l.screens[(i + 1) % l.screens.length].id;
      });
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [rotationOn, intervalSec, rotationReset]);

  // --- Live sync from other browsers / the server -------------------------------------------
  useEffect(() => {
    return subscribeEvents((ev) => {
      if (ev.event === '$attention') {
        // Server-side plugin asked for attention: pick the first screen that shows one of its tiles.
        const { action, reason } = ev.payload as { action: 'request' | 'release'; reason?: string };
        const holder = `plugin:${ev.plugin}`;
        if (action === 'release') releaseAttention(holder);
        else {
          const l = layoutRef.current;
          const screen = l?.screens.find((s) => s.widgets.some((w) => w.pluginId === ev.plugin));
          if (screen) requestAttention(holder, ev.plugin, screen.id, reason);
        }
        return;
      }
      if (ev.plugin !== '$host') return;
      if (ev.event === 'showScreen') {
        const { screenId } = ev.payload as { screenId: string };
        if (!attentionRef.current) showScreen(screenId);
        return;
      }
      if (ev.event === 'attention') {
        const { action, screenId, holder, reason } = ev.payload as { action: string; screenId?: string; holder: string; reason?: string };
        if (action === 'release') releaseAttention(holder);
        else if (screenId) requestAttention(holder, 'api', screenId, reason);
        return;
      }
      if (ev.event === 'layout') {
        const incoming = normalizeLayout(ev.payload as DashboardLayout);
        const json = JSON.stringify(incoming);
        if (json === lastSaved.current || draggingRef.current) return;
        lastSaved.current = json;
        applyIncoming(incoming);
      }
      if (ev.event === 'settings') {
        const { pluginId } = ev.payload as { pluginId: string };
        reloadPluginSettings(pluginId);
      }
    });
  }, [reloadPluginSettings, applyIncoming, requestAttention, releaseAttention, showScreen]);

  const value = useMemo<Store>(
    () => ({
      auth,
      refreshAuth,
      login,
      logout,
      setup,
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
      getWidget,
      updateWidget,
      addWidget,
      removeWidget,
      draggingRef,
      activeScreenId,
      showScreen,
      addScreen,
      removeScreen,
      renameScreen,
      moveScreen,
      attention,
      requestAttention,
      releaseAttention: releaseAttentionPublic,
    }),
    [
      auth,
      refreshAuth,
      login,
      logout,
      setup,
      layout,
      error,
      editMode,
      dialog,
      pluginSettings,
      reloadPluginSettings,
      apiFor,
      updateLayout,
      getWidget,
      updateWidget,
      addWidget,
      removeWidget,
      activeScreenId,
      showScreen,
      addScreen,
      removeScreen,
      renameScreen,
      moveScreen,
      attention,
      requestAttention,
      releaseAttentionPublic,
    ],
  );

  // Debug aid: inspect host state from the browser console.
  useEffect(() => {
    (window as unknown as { __magicdash?: unknown }).__magicdash = { attention, activeScreenId, screens: layout?.screens.map((s) => s.id), rotation: layout?.rotation, rotationOn, editMode, dialog: dialog.kind };
  }, [attention, activeScreenId, layout, rotationOn, editMode, dialog.kind]);

  void allWidgets;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
