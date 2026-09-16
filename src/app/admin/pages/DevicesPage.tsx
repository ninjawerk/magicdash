import { useEffect, useState } from 'react';
import { Eye, Loader2, Monitor, RefreshCw, Trash2 } from 'lucide-react';
import { hostApi } from '../../lib/api';
import { useStore } from '../../lib/store';
import { formatDuration } from '@sdk/client';

type Device = Awaited<ReturnType<typeof hostApi.devices>>[number];

export function DevicesPage() {
  const { layout } = useStore();
  const [devices, setDevices] = useState<Device[]>();
  const [err, setErr] = useState<string>();
  const load = () => hostApi.devices().then(setDevices).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl border border-white/10 p-5 text-sm text-white/60">
        <p>
          Every browser that opens the dashboard registers itself here. A kiosk keeps a stable identity when its URL includes{' '}
          <code className="font-mono text-xs text-white/85">?device=kitchen</code> (the Pi install script uses the hostname); other browsers get a generated id.
          Give each display a name, choose which screens it cycles, and target it from automations with <code className="font-mono text-xs text-white/85">"deviceId"</code> on
          <code className="font-mono text-xs text-white/85"> /api/screens/show</code>, <code className="font-mono text-xs text-white/85">/api/notify</code> and{' '}
          <code className="font-mono text-xs text-white/85">/api/attention</code>.
        </p>
      </section>
      {err && <p className="text-xs text-red-300">{err}</p>}
      {!devices && (
        <p className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      )}
      {devices?.length === 0 && <p className="text-sm text-white/40">No displays yet — open the dashboard somewhere and it will appear within a few seconds.</p>}
      {devices?.map((d) => <DeviceCard key={d.id} device={d} screens={layout?.screens ?? []} reload={load} />)}
    </div>
  );
}

function DeviceCard({ device: d, screens, reload }: { device: Device; screens: Array<{ id: string; name: string }>; reload: () => void }) {
  const [name, setName] = useState(d.name);
  const [cfg, setCfg] = useState(d.config);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setName(d.name);
      setCfg(d.config);
    }
  }, [d, dirty]);
  const set = (patch: Partial<Device['config']>) => {
    setCfg({ ...cfg, ...patch });
    setDirty(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await hostApi.updateDevice(d.id, { name, config: cfg });
      setDirty(false);
      reload();
    } finally {
      setSaving(false);
    }
  };
  const ago = Date.now() - new Date(d.lastSeen).getTime();
  const ua = d.userAgent?.match(/(Chrome|Chromium|Safari|Firefox|Edg)\/[\d.]+/)?.[0] ?? '';
  const screenName = (id?: string) => screens.find((s) => s.id === id)?.name ?? id ?? '—';
  const sel = new Set(cfg.screens ?? []);
  return (
    <section className="surface rounded-2xl border border-white/10 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
          <Monitor size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              className="input max-w-xs py-1 font-semibold"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${d.online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
              {d.online ? 'online' : `last seen ${formatDuration(ago)} ago`}
            </span>
          </div>
          <div className="mt-1 text-xs text-white/45">
            <span className="font-mono">{d.id}</span>
            {d.ip ? ` · ${d.ip}` : ''}
            {d.viewport ? ` · ${d.viewport.width}×${d.viewport.height}` : ''}
            {ua ? ` · ${ua}` : ''}
            {d.appVersion ? ` · v${d.appVersion}` : ''} · showing <b className="text-white/70">{screenName(d.currentScreen)}</b>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <button className="btn btn-ghost" onClick={() => hostApi.deviceAction(d.id, 'identify')} title="Show a toast on this display">
            <Eye size={14} /> Identify
          </button>
          <select
            className="input w-auto py-1.5 text-xs"
            value=""
            onChange={(e) => {
              if (e.target.value) hostApi.deviceAction(d.id, 'show', e.target.value);
            }}
            title="Switch this display to a screen now"
          >
            <option value="">Show screen…</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={() => hostApi.deviceAction(d.id, 'reload')} title="Reload the page on this display">
            <RefreshCw size={14} />
          </button>
          <button
            className="btn btn-ghost hover:bg-red-500/20 hover:text-red-200"
            title="Forget this device"
            onClick={async () => {
              if (confirm(`Forget "${d.name}"? It will re-register if it connects again.`)) {
                await hostApi.forgetDevice(d.id);
                reload();
              }
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Screens this display cycles</label>
          <div className="flex flex-wrap gap-1.5">
            {screens.map((s) => (
              <button
                key={s.id}
                className={`btn py-1 text-xs ${sel.size === 0 || sel.has(s.id) ? 'btn-primary' : 'btn-default'}`}
                onClick={() => {
                  const next = new Set(sel.size === 0 ? screens.map((x) => x.id) : sel);
                  next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                  set({ screens: next.size === screens.length ? undefined : [...next] });
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-white/40">{sel.size === 0 ? 'All screens (dashboard default).' : `${sel.size} of ${screens.length} screens.`}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Rotation</label>
            <div className="flex items-center gap-2">
              <select
                className="input w-auto py-1.5 text-sm"
                value={cfg.rotation ? (cfg.rotation.enabled ? 'on' : 'off') : 'default'}
                onChange={(e) => set({ rotation: e.target.value === 'default' ? undefined : { enabled: e.target.value === 'on', intervalSec: cfg.rotation?.intervalSec ?? 30 } })}
              >
                <option value="default">Dashboard default</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
              {cfg.rotation?.enabled && (
                <>
                  <input className="input w-24 py-1.5 text-sm" type="number" min={3} value={cfg.rotation.intervalSec} onChange={(e) => set({ rotation: { enabled: true, intervalSec: Number(e.target.value) || 30 } })} />
                  <span className="text-xs text-white/40">seconds</span>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="label">Power & brightness</label>
            <div className="flex items-center gap-2">
              <select className="input w-auto py-1.5 text-sm" value={cfg.power ?? 'auto'} onChange={(e) => set({ power: e.target.value as Device['config']['power'] })}>
                <option value="auto">Follow display schedule</option>
                <option value="on">Always on</option>
                <option value="off">Off (black screen)</option>
              </select>
              <select
                className="input w-auto py-1.5 text-sm"
                value={cfg.brightness === undefined ? '' : String(cfg.brightness)}
                onChange={(e) => set({ brightness: e.target.value === '' ? undefined : Number(e.target.value) })}
              >
                <option value="">Dashboard brightness</option>
                {[100, 80, 60, 40, 25, 10].map((b) => (
                  <option key={b} value={b}>
                    {b}%
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      {dirty && (
        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setDirty(false);
              setName(d.name);
              setCfg(d.config);
            }}
          >
            Discard
          </button>
        </div>
      )}
    </section>
  );
}
