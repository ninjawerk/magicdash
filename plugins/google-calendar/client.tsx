import { useEffect, useMemo } from 'react';
import { CalendarX2, CheckCircle2, Link2, Loader2, MapPin, Unplug } from 'lucide-react';
import {
  definePlugin,
  formatDuration,
  formatTime,
  publish,
  useNow,
  usePluginEvent,
  usePluginQuery,
  type CalendarNextTopic,
  type WidgetProps,
} from '../../src/sdk/client';
import manifest from './manifest';
import type { CalEvent, Status } from './shared';

interface Config {
  calendars?: string[];
  mode?: 'schedule' | 'agenda';
  days?: number;
  alertSeconds?: number;
  showAllDay?: boolean;
  grabAttention?: boolean;
  showLocation?: boolean;
  hour12?: boolean;
}

// ---------------------------------------------------------------------------
// Plugin settings panel: connection status + connect / disconnect
// ---------------------------------------------------------------------------
function SettingsPanel({ api, reload }: { api: WidgetProps['api']; reload: () => void }) {
  const status = usePluginQuery<Status>(api, '/status');
  const s = status.data;
  const connect = async () => {
    try {
      const r = await api.post<{ redirect: string }>('/auth/start');
      window.location.href = r.redirect;
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect Google account?')) return;
    await api.post('/auth/disconnect');
    status.refresh();
    reload();
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        {s?.connected ? <CheckCircle2 className="text-emerald-400" size={18} /> : <Unplug className="text-white/40" size={18} />}
        <span className="font-medium">{s?.connected ? `Connected as ${s.email ?? 'Google account'}` : 'Not connected'}</span>
        <span className="ml-auto flex gap-2">
          {s?.connected ? (
            <button className="btn btn-danger py-1.5" onClick={disconnect}>
              Disconnect
            </button>
          ) : (
            <button className="btn btn-primary py-1.5" onClick={connect} disabled={!s?.configured} title={s?.configured ? '' : 'Save Client ID & Secret first'}>
              <Link2 size={14} /> Connect Google
            </button>
          )}
        </span>
      </div>
      {s?.error && <p className="text-red-300 text-xs">{s.error}</p>}
      <div className="rounded-lg bg-black/30 p-3 text-xs text-white/60 space-y-1">
        <p>
          Add this <b>Authorized redirect URI</b> to your OAuth client in Google Cloud Console:
        </p>
        <code className="block select-all font-mono text-[11px] text-white/90 break-all">{s?.redirectUri ?? '…'}</code>
        <p className="pt-1">
          Google only accepts plain <span className="font-mono">http://</span> for <span className="font-mono">localhost</span>. If your Pi isn't reachable as
          localhost, run the connect step once from the Pi itself (or via an SSH tunnel: <span className="font-mono">ssh -L 3210:localhost:3210 pi@…</span>) and
          add <span className="font-mono">http://localhost:3210/api/plugins/google-calendar/auth/callback</span> as a redirect URI.
        </p>
        <p className="pt-1 text-white/40">Save the Client ID and Secret below before connecting.</p>
      </div>
      {(s?.icsCount ?? 0) > 0 && (
        <p className="text-xs text-white/50">
          {s!.icsCount} ICS feed{s!.icsCount === 1 ? '' : 's'} configured — these work without a Google connection.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule widget
// ---------------------------------------------------------------------------
type Ev = CalEvent & { s: number; e: number };

function ScheduleWidget({ config, api, size, setAlert, editMode, openSettings, attention }: WidgetProps<Config>) {
  const now = useNow(1000);
  const nowMs = now.getTime();
  const hour12 = config.hour12 ?? false;
  const cals = (config.calendars ?? []).join(',');

  const status = usePluginQuery<Status>(api, '/status', { refreshMs: 5 * 60_000 });
  const connected = status.data?.connected === true || (status.data?.icsCount ?? 0) > 0;
  const events = usePluginQuery<CalEvent[]>(api, '/events', {
    enabled: connected,
    query: { calendars: cals, days: config.days ?? 2 },
    refreshMs: 60_000,
  });
  usePluginEvent(manifest.id, undefined, () => {
    status.refresh();
    events.refresh();
  });

  const { current, others, next, later, allDay, tomorrow } = useMemo(() => {
    const all: Ev[] = (events.data ?? []).map((e) => ({ ...e, s: new Date(e.start).getTime(), e: new Date(e.end).getTime() }));
    const dayEnd = new Date(now);
    dayEnd.setHours(24, 0, 0, 0);
    const timed = all.filter((e) => !e.allDay);
    const running = timed.filter((e) => e.s <= nowMs && e.e > nowMs).sort((a, b) => a.e - b.e);
    const upcoming = timed.filter((e) => e.s > nowMs).sort((a, b) => a.s - b.s);
    const allDayToday = all.filter((e) => e.allDay && e.s <= nowMs && e.e > nowMs);
    return {
      current: running[0],
      others: running.slice(1),
      next: upcoming[0],
      later: upcoming.slice(1),
      allDay: allDayToday,
      tomorrow: upcoming.find((e) => e.s >= dayEnd.getTime()),
    };
    // Recompute once a second is fine — the list is tiny.
  }, [events.data, nowMs, now]);

  useEffect(() => {
    const n = current ?? next;
    if (!n) return;
    const topic: CalendarNextTopic = { title: n.title, start: n.start, end: n.end, location: n.location, minutesUntil: Math.round((n.s - nowMs) / 60_000) };
    publish('calendar:next', topic);
    // Only republish when the event or its minute changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, next?.id, Math.floor(nowMs / 60_000)]);
  const alertMs = (config.alertSeconds ?? 60) * 1000;
  const remaining = current ? current.e - nowMs : undefined;
  const inAlert = remaining !== undefined && remaining <= alertMs;
  useEffect(() => setAlert(inAlert), [inAlert, setAlert]);

  // Attention: last minute of the current event, or the 2 minutes before the next one starts.
  const startingSoon = !!next && next.s - nowMs <= 2 * 60_000 && next.s > nowMs;
  const wantAttention = config.grabAttention !== false && (inAlert || startingSoon);
  useEffect(() => {
    if (wantAttention) attention.request(inAlert ? `${current?.title} is ending` : `${next?.title} starts soon`);
    else if (attention.held) attention.release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAttention, inAlert, attention.held]);

  // --- Empty / error states ----------------------------------------------------
  if (status.loading && !status.data) return <Center><Loader2 className="animate-spin" /></Center>;
  if (!connected) {
    return (
      <Center onClick={editMode ? openSettings : undefined}>
        <Unplug className="text-white/40" />
        <p className="text-sm text-white/60">No calendar connected yet.</p>
        <p className="text-xs text-white/40">Edit → this tile → Plugin settings → Connect Google, or add an ICS feed.</p>
      </Center>
    );
  }
  if (events.error && !events.data) return <Center><CalendarX2 className="text-red-300" /><p className="text-sm text-red-200">{events.error}</p></Center>;
  if (!events.data) return <Center><Loader2 className="animate-spin" /></Center>;

  const compact = size.height < 200;
  const rowH = 34;
  const t = (ms: number) => formatTime(ms, { hour12 });

  if (config.mode === 'agenda') {
    const list = [...(current ? [current, ...others] : []), ...(next ? [next, ...later] : [])];
    return (
      <div className="flex h-full flex-col px-5 pb-4 gap-1 overflow-hidden">
        {config.showAllDay !== false && allDay.length > 0 && <AllDayChips events={allDay} />}
        {list.length === 0 && <Center><p className="text-white/40 text-sm">Nothing scheduled.</p></Center>}
        {list.slice(0, Math.max(1, Math.floor((size.height - 20) / rowH))).map((e) => (
          <Row key={e.id} e={e} nowMs={nowMs} t={t} showLocation={config.showLocation !== false} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-5 pb-4 gap-3 overflow-hidden">
      {config.showAllDay !== false && allDay.length > 0 && <AllDayChips events={allDay} />}

      {current ? (
        <>
          {/* NOW */}
          <div className="min-h-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
              <span className={inAlert ? 'text-red-300' : 'text-[var(--accent)]'}>Now</span>
              <span className="text-white/35 font-medium tracking-normal normal-case">
                {t(current.s)} – {t(current.e)}
              </span>
              {others.length > 0 && <span className="text-white/35 font-medium tracking-normal normal-case">· +{others.length} more</span>}
              <CalDot color={current.color} className="ml-auto" />
            </div>
            <div className="mt-1 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="font-bold leading-tight tracking-tight line-clamp-2" style={{ fontSize: compact ? 22 : Math.min(38, size.width / 14) }}>
                  {current.title}
                </div>
                {config.showLocation !== false && current.location && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-white/50 truncate">
                    <MapPin size={13} /> {current.location}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] uppercase tracking-wider text-white/40">{inAlert ? 'ending' : 'ends in'}</div>
                <div className={`font-mono font-bold leading-none tabular ${inAlert ? 'text-red-200' : ''}`} style={{ fontSize: compact ? 28 : Math.min(48, size.width / 10) }}>
                  {formatDuration(remaining!, { seconds: remaining! < 10 * 60_000 })}
                </div>
              </div>
            </div>
            <Progress start={current.s} end={current.e} now={nowMs} alert={inAlert} />
          </div>

          {/* NEXT (small) */}
          {next && !compact && (
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Next</span>
              <CalDot color={next.color} />
              <span className="font-semibold truncate">{next.title}</span>
              <span className="text-white/40 text-sm truncate hidden sm:inline">{t(next.s)}</span>
              <span className="ml-auto font-mono text-sm text-white/70 tabular whitespace-nowrap">in {formatDuration(next.s - nowMs)}</span>
            </div>
          )}
        </>
      ) : next ? (
        <>
          {/* FREE → countdown to next */}
          <div className="min-h-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
              <span className="text-[var(--accent)]">Up next</span>
              <span className="text-white/35 font-medium tracking-normal normal-case">
                {isToday(next.s, now) ? '' : dayLabel(next.s, now) + ' · '}
                {t(next.s)} – {t(next.e)}
              </span>
              <CalDot color={next.color} className="ml-auto" />
            </div>
            <div className="mt-1 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="font-bold leading-tight tracking-tight line-clamp-2" style={{ fontSize: compact ? 22 : Math.min(38, size.width / 14) }}>
                  {next.title}
                </div>
                {config.showLocation !== false && next.location && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-white/50 truncate">
                    <MapPin size={13} /> {next.location}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] uppercase tracking-wider text-white/40">starts in</div>
                <div className="font-mono font-bold leading-none tabular" style={{ fontSize: compact ? 28 : Math.min(48, size.width / 10) }}>
                  {formatDuration(next.s - nowMs, { seconds: next.s - nowMs < 10 * 60_000 })}
                </div>
              </div>
            </div>
            {!compact && <div className="mt-2 text-xs text-white/40">You’re free until {t(next.s)}.</div>}
          </div>
        </>
      ) : (
        <Center>
          <CheckCircle2 className="text-emerald-400" />
          <p className="text-sm text-white/60">Nothing scheduled{config.days && config.days > 1 ? ` for the next ${config.days} days` : ' today'}.</p>
        </Center>
      )}

      {/* LATER list */}
      {!compact && (current ? later.length > 0 : later.length > 0) && (
        <div className="mt-auto min-h-0 border-t border-white/10 pt-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35 mb-1">Later</div>
          <div className="flex flex-col">
            {(current ? later : later).slice(0, Math.max(0, Math.floor((size.height - (current ? 230 : 170)) / rowH))).map((e) => (
              <Row key={e.id} e={e} nowMs={nowMs} t={t} showLocation={false} now={now} />
            ))}
          </div>
        </div>
      )}
      {!current && !next && tomorrow && null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------
function Row({ e, nowMs, t, showLocation, now }: { e: Ev; nowMs: number; t: (ms: number) => string; showLocation: boolean; now?: Date }) {
  const running = e.s <= nowMs && e.e > nowMs;
  const rel = running ? `ends ${formatDuration(e.e - nowMs)}` : `in ${formatDuration(e.s - nowMs)}`;
  return (
    <div className="flex items-center gap-3 py-1.5 min-h-[34px]">
      <span className="font-mono text-xs text-white/50 tabular w-[4.5rem] shrink-0">
        {now && !isToday(e.s, now) ? <span className="text-white/35">{dayLabel(e.s, now)} </span> : null}
        {t(e.s)}
      </span>
      <CalDot color={e.color} />
      <span className={`truncate ${running ? 'font-semibold' : 'text-white/85'}`}>{e.title}</span>
      {showLocation && e.location && <span className="hidden md:inline truncate text-xs text-white/40">· {e.location}</span>}
      <span className="ml-auto font-mono text-xs text-white/45 tabular whitespace-nowrap">{rel}</span>
    </div>
  );
}

function AllDayChips({ events }: { events: Ev[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {events.map((e) => (
        <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/80">
          <CalDot color={e.color} /> {e.title}
        </span>
      ))}
    </div>
  );
}

function Progress({ start, end, now, alert }: { start: number; end: number; now: number; alert: boolean }) {
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full transition-[width] duration-1000 ${alert ? 'bg-red-400' : 'bg-[var(--accent)]'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CalDot({ color, className = '' }: { color?: string; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: color ?? 'var(--accent)' }} />;
}

function Center({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-2 p-4 text-center ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

function isToday(ms: number, now: Date) {
  const d = new Date(ms);
  return d.toDateString() === now.toDateString();
}
function dayLabel(ms: number, now: Date) {
  const d = new Date(ms);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
}

export default definePlugin<Config>({
  manifest,
  Widget: ScheduleWidget,
  SettingsPanel: ({ api, reload }) => <SettingsPanel api={api} reload={reload} />,
});
