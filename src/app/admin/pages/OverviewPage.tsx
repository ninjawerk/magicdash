import { useEffect, useState } from 'react';
import { ArrowUpCircle, Cpu, Layers, Monitor, Puzzle, Thermometer, Timer } from 'lucide-react';
import { hostApi } from '../../lib/api';
import { useStore } from '../../lib/store';
import { listClientPlugins } from '../../lib/registry';
import type { Route } from '../AdminApp';
import { formatDuration } from '@sdk/client';

export function OverviewPage({ go }: { go: (r: Route) => void }) {
  const { layout } = useStore();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof hostApi.systemInfo>>>();
  const [health, setHealth] = useState<Awaited<ReturnType<typeof hostApi.health>>>();
  const [upd, setUpd] = useState<Awaited<ReturnType<typeof hostApi.updateStatus>>>();
  useEffect(() => {
    const load = () => {
      hostApi.systemInfo().then(setInfo).catch(() => undefined);
      hostApi.health().then(setHealth).catch(() => undefined);
    };
    load();
    hostApi.updateStatus().then(setUpd).catch(() => undefined);
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);
  const tiles = layout?.screens.reduce((n, s) => n + s.widgets.length, 0) ?? 0;
  const mb = (n: number) => `${Math.round(n / 1048576)} MB`;

  return (
    <div className="space-y-6">
      {upd?.updateAvailable && (
        <button onClick={() => go('updates')} className="flex w-full items-center gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4 text-left text-sm">
          <ArrowUpCircle className="text-[var(--accent)]" />
          <span>
            <b>Update available</b> — {upd.git.behind} new commit{upd.git.behind === 1 ? '' : 's'} on {upd.git.branch}. Open Updates →
          </span>
        </button>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Layers size={16} />} label="Screens" value={String(layout?.screens.length ?? 0)} onClick={() => go('screens')} />
        <Stat icon={<Monitor size={16} />} label="Tiles" value={String(tiles)} onClick={() => go('layout')} />
        <Stat icon={<Puzzle size={16} />} label="Plugins" value={String(listClientPlugins().length)} onClick={() => go('plugins')} />
        <Stat icon={<Monitor size={16} />} label="Connected displays" value={String(Math.max(0, (health?.clients ?? 1) - 1))} hint="other than this browser" />
      </div>
      <section className="surface rounded-2xl border border-white/10 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white/70">This device</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row k="Version" v={`MagicDash ${info?.version ?? '…'} · Node ${info?.node ?? ''}`} />
          <Row k="Host" v={`${info?.hostname ?? '…'} · ${info?.platform ?? ''}`} />
          <Row k="Mode" v={info ? (info.prod ? 'production (systemd)' : 'development') : '…'} />
          <Row k="Server uptime" v={info ? formatDuration(info.uptimeSec * 1000) : '…'} icon={<Timer size={13} />} />
          <Row k="System uptime" v={info ? formatDuration(info.systemUptimeSec * 1000) : '…'} />
          <Row k="Memory" v={info ? `${mb(info.memory.rss)} used by server · ${mb(info.memory.free)} free of ${mb(info.memory.total)}` : '…'} icon={<Cpu size={13} />} />
          {info?.cpuTemp !== undefined && <Row k="CPU temperature" v={`${info.cpuTemp.toFixed(1)} °C`} icon={<Thermometer size={13} />} />}
          <Row k="Load" v={info ? info.load.map((l) => l.toFixed(2)).join(' · ') : '…'} />
          <Row k="Install path" v={info?.cwd ?? '…'} mono />
        </dl>
      </section>
      <section className="surface rounded-2xl border border-white/10 p-5">
        <h2 className="mb-2 text-sm font-semibold text-white/70">Open on another device</h2>
        <ul className="space-y-1 font-mono text-xs text-white/80">{health?.addresses?.map((a) => <li key={a}>{a}</li>)}</ul>
        <p className="mt-2 text-xs text-white/40">Add <span className="font-mono">/admin</span> for this panel. The dashboard view needs no password.</p>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, hint, onClick }: { icon: React.ReactNode; label: string; value: string; hint?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`surface rounded-2xl border border-white/10 p-4 text-left ${onClick ? 'hover:border-white/25' : 'cursor-default'}`}>
      <div className="flex items-center gap-2 text-xs text-white/50">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular">{value}</div>
      {hint && <div className="text-[11px] text-white/35">{hint}</div>}
    </button>
  );
}
function Row({ k, v, icon, mono }: { k: string; v: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-36 shrink-0 text-white/45">{k}</dt>
      <dd className={`flex items-center gap-1.5 text-white/85 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {icon && <span className="text-white/40">{icon}</span>}
        {v}
      </dd>
    </div>
  );
}
