import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Blinds,
  Bot,
  Camera,
  Cloud,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  Gauge,
  Lightbulb,
  Loader2,
  Lock,
  LockOpen,
  Music,
  Play,
  Power,
  Sparkles,
  Thermometer,
  ToggleLeft,
  ToggleRight,
  Unplug,
  User,
  UserCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { definePlugin, formatDuration, useNow, usePluginEvent, usePluginQuery, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';
import { ACTIVATE_DOMAINS, TOGGLE_DOMAINS, domainOf, type HaState, type HaStatus } from './shared';

interface Config {
  entities?: string[];
  layout?: 'tiles' | 'list' | 'big';
  controls?: boolean;
  showLastChanged?: boolean;
  attentionOn?: boolean;
}

// ---------------------------------------------------------------------------
// Icon & colour selection
// ---------------------------------------------------------------------------
function iconFor(s: HaState): { Icon: LucideIcon; color: string; active: boolean } {
  const domain = domainOf(s.entity_id);
  const dc = s.attributes.device_class;
  const on = s.state === 'on';
  const dim = 'color-mix(in srgb, var(--fg) 45%, transparent)';
  switch (domain) {
    case 'light':
      return { Icon: Lightbulb, color: on ? '#ffd166' : dim, active: on };
    case 'switch':
    case 'input_boolean':
    case 'automation':
      return { Icon: on ? ToggleRight : ToggleLeft, color: on ? '#7cc4ff' : dim, active: on };
    case 'fan':
      return { Icon: Fan, color: on ? '#9be7ff' : dim, active: on };
    case 'climate':
      return { Icon: Thermometer, color: s.state === 'off' ? dim : '#ff9f68', active: s.state !== 'off' };
    case 'cover':
      return { Icon: Blinds, color: s.state === 'open' ? '#7cc4ff' : dim, active: s.state === 'open' };
    case 'lock':
      return s.state === 'locked' ? { Icon: Lock, color: '#8ef0b4', active: true } : { Icon: LockOpen, color: '#ff8080', active: false };
    case 'media_player':
      return { Icon: Music, color: s.state === 'playing' ? '#c3a6ff' : dim, active: s.state === 'playing' };
    case 'person':
    case 'device_tracker':
      return s.state === 'home' ? { Icon: UserCheck, color: '#8ef0b4', active: true } : { Icon: User, color: dim, active: false };
    case 'scene':
      return { Icon: Sparkles, color: '#c3a6ff', active: false };
    case 'script':
    case 'button':
    case 'input_button':
      return { Icon: Play, color: '#7cc4ff', active: false };
    case 'weather':
      return { Icon: Cloud, color: '#c9d1e0', active: false };
    case 'camera':
      return { Icon: Camera, color: dim, active: false };
    case 'vacuum':
      return { Icon: Bot, color: s.state === 'cleaning' ? '#7cc4ff' : dim, active: s.state === 'cleaning' };
    case 'binary_sensor':
      if (dc === 'door' || dc === 'window' || dc === 'garage_door' || dc === 'opening')
        return on ? { Icon: DoorOpen, color: '#ffb366', active: true } : { Icon: DoorClosed, color: dim, active: false };
      if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') return { Icon: Activity, color: on ? '#ffd166' : dim, active: on };
      return { Icon: on ? ToggleRight : ToggleLeft, color: on ? '#7cc4ff' : dim, active: on };
    case 'sensor':
      if (dc === 'temperature') return { Icon: Thermometer, color: '#ff9f68', active: true };
      if (dc === 'humidity' || dc === 'moisture') return { Icon: Droplets, color: '#7cc4ff', active: true };
      if (dc === 'power' || dc === 'energy' || dc === 'voltage' || dc === 'current') return { Icon: Zap, color: '#ffd166', active: true };
      return { Icon: Gauge, color: '#c9d1e0', active: true };
    default:
      return { Icon: Power, color: on ? '#7cc4ff' : dim, active: on };
  }
}

function displayState(s: HaState): string {
  const unit = s.attributes.unit_of_measurement;
  const st = s.state;
  if (st === 'unavailable') return 'Unavailable';
  if (st === 'unknown') return '—';
  const domain = domainOf(s.entity_id);
  if (domain === 'climate') {
    const cur = s.attributes.current_temperature as number | undefined;
    const target = s.attributes.temperature as number | undefined;
    return `${cur ?? '—'}°${target !== undefined ? ` → ${target}°` : ''}`;
  }
  if (domain === 'light' && st === 'on' && typeof s.attributes.brightness === 'number') {
    return `On · ${Math.round(((s.attributes.brightness as number) / 255) * 100)}%`;
  }
  if (domain === 'media_player' && st === 'playing') {
    return (s.attributes.media_title as string) ?? 'Playing';
  }
  if (unit) {
    const n = Number(st);
    return `${Number.isFinite(n) ? (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10) : st}${unit.startsWith('°') || unit === '%' ? '' : ' '}${unit}`;
  }
  return st.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function actionFor(s: HaState): { domain: string; service: string } | undefined {
  const domain = domainOf(s.entity_id);
  if (TOGGLE_DOMAINS.has(domain)) return { domain, service: 'toggle' };
  if (domain === 'scene') return { domain, service: 'turn_on' };
  if (domain === 'script') return { domain, service: 'turn_on' };
  if (domain === 'button' || domain === 'input_button') return { domain, service: 'press' };
  if (domain === 'cover') return { domain, service: s.state === 'open' ? 'close_cover' : 'open_cover' };
  if (domain === 'lock') return { domain, service: s.state === 'locked' ? 'unlock' : 'lock' };
  if (domain === 'media_player') return { domain, service: 'media_play_pause' };
  if (domain === 'vacuum') return { domain, service: s.state === 'cleaning' ? 'return_to_base' : 'start' };
  return undefined;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------
function HomeAssistantWidget({ config, api, size, editMode, openSettings, attention }: WidgetProps<Config>) {
  const status = usePluginQuery<HaStatus>(api, '/status', { refreshMs: 60_000 });
  const initial = usePluginQuery<HaState[]>(api, '/states', { refreshMs: 5 * 60_000 });
  const [states, setStates] = useState<Map<string, HaState>>(new Map());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const now = useNow(30_000);

  useEffect(() => {
    if (initial.data) setStates(new Map(initial.data.map((s) => [s.entity_id, s])));
  }, [initial.data]);
  const ACTIVE = new Set(['on', 'open', 'unlocked', 'playing', 'cleaning', 'home']);
  usePluginEvent<{ entity_id: string; state: HaState | null }>(manifest.id, 'state', ({ entity_id, state }) => {
    if (config.attentionOn && state && (config.entities ?? []).includes(entity_id)) {
      const prev = states.get(entity_id);
      if (ACTIVE.has(state.state) && prev && !ACTIVE.has(prev.state) && attention.request(`${state.attributes.friendly_name ?? entity_id} is ${state.state}`)) {
        setTimeout(() => attention.release(), 20_000);
      }
    }
    setStates((m) => {
      const n = new Map(m);
      state ? n.set(entity_id, state) : n.delete(entity_id);
      return n;
    });
  });
  usePluginEvent<HaState[]>(manifest.id, 'states', (all) => setStates(new Map(all.map((s) => [s.entity_id, s]))));
  usePluginEvent(manifest.id, 'status', () => {
    status.refresh();
    initial.refresh();
  });

  const wanted = config.entities ?? [];
  const items = useMemo(() => wanted.map((id) => states.get(id) ?? placeholder(id)), [wanted, states]);

  const act = async (s: HaState) => {
    if (config.controls === false || editMode) return;
    const a = actionFor(s);
    if (!a) return;
    setPending((p) => new Set(p).add(s.entity_id));
    try {
      await api.post('/service', { ...a, entity_id: s.entity_id });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setPending((p) => {
        const n = new Set(p);
        n.delete(s.entity_id);
        return n;
      }), 800);
    }
  };

  if (!status.data?.configured) {
    return (
      <Center onClick={editMode ? openSettings : undefined}>
        <Unplug className="text-white/40" />
        <p className="text-sm text-white/60">Home Assistant isn’t set up.</p>
        <p className="text-xs text-white/40">Edit → this tile → Plugin settings → URL & token.</p>
      </Center>
    );
  }
  if (wanted.length === 0) {
    return (
      <Center onClick={editMode ? openSettings : undefined}>
        <p className="text-sm text-white/60">Pick some entities in this tile’s settings.</p>
      </Center>
    );
  }
  if (!status.data.connected && states.size === 0) {
    return (
      <Center>
        {status.data.error ? <p className="text-sm text-red-200">{status.data.error}</p> : <><Loader2 className="animate-spin" /><p className="text-xs text-white/40">Connecting…</p></>}
      </Center>
    );
  }

  const layout = config.layout ?? 'tiles';
  const offline = !status.data.connected;

  if (layout === 'big') {
    const s = items[0];
    const { Icon, color } = iconFor(s);
    const tappable = config.controls !== false && !!actionFor(s);
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-2 px-4 ${tappable ? 'cursor-pointer active:scale-[0.98] transition' : ''}`} onClick={() => act(s)}>
        <Icon size={Math.min(64, size.height * 0.3)} color={color} strokeWidth={1.75} />
        <div className="font-bold tracking-tight tabular text-center leading-none" style={{ fontSize: Math.min(56, size.width / 6, size.height * 0.32) }}>
          {displayState(s)}
        </div>
        <div className="text-sm text-white/50 text-center truncate max-w-full">{s.attributes.friendly_name ?? s.entity_id}</div>
        {offline && <Offline />}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="flex h-full flex-col px-4 pb-3 overflow-y-auto">
        {offline && <Offline />}
        {items.map((s) => {
          const { Icon, color } = iconFor(s);
          const tappable = config.controls !== false && !!actionFor(s);
          return (
            <button
              key={s.entity_id}
              className={`flex items-center gap-3 py-2 border-b border-white/5 last:border-0 text-left ${tappable ? 'hover:bg-white/5 -mx-2 px-2 rounded-lg' : 'cursor-default'}`}
              onClick={() => act(s)}
              disabled={!tappable}
            >
              <Icon size={20} color={color} strokeWidth={1.75} className={pending.has(s.entity_id) ? 'animate-pulse' : ''} />
              <span className="flex-1 truncate text-sm">{s.attributes.friendly_name ?? s.entity_id}</span>
              <span className="font-semibold text-sm tabular text-white/85 truncate max-w-[45%]">{displayState(s)}</span>
              {config.showLastChanged && <span className="text-[10px] text-white/35 w-14 text-right">{ago(s.last_changed, now)}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // tiles
  const minTile = size.width < 300 ? 110 : 130;
  return (
    <div className="h-full px-4 pb-4 overflow-y-auto">
      {offline && <Offline />}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minTile}px, 1fr))` }}>
        {items.map((s) => {
          const { Icon, color, active } = iconFor(s);
          const tappable = config.controls !== false && !!actionFor(s);
          return (
            <button
              key={s.entity_id}
              onClick={() => act(s)}
              disabled={!tappable}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition ${
                active ? 'border-white/15 bg-white/[0.09]' : 'border-white/5 bg-white/[0.03]'
              } ${tappable ? 'hover:bg-white/[0.12] active:scale-[0.97]' : 'cursor-default'} ${pending.has(s.entity_id) ? 'animate-pulse' : ''}`}
            >
              <Icon size={24} color={color} strokeWidth={1.75} />
              <div className="min-w-0 w-full">
                <div className="text-base font-semibold tabular truncate">{displayState(s)}</div>
                <div className="text-xs text-white/50 truncate">{s.attributes.friendly_name ?? s.entity_id}</div>
                {config.showLastChanged && <div className="text-[10px] text-white/30 mt-0.5">{ago(s.last_changed, now)}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function placeholder(id: string): HaState {
  return { entity_id: id, state: 'unknown', attributes: { friendly_name: id }, last_changed: '', last_updated: '' };
}
function ago(iso: string, now: Date) {
  if (!iso) return '';
  const ms = now.getTime() - new Date(iso).getTime();
  return ms < 60_000 ? 'just now' : `${formatDuration(ms)} ago`;
}
function Offline() {
  return <div className="mb-2 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">Reconnecting to Home Assistant…</div>;
}
function Center({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-2 p-4 text-center ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: HomeAssistantWidget });
