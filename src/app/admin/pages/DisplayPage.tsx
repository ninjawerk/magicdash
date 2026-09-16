import { useEffect, useState } from 'react';
import { Loader2, Moon, MonitorOff, MonitorUp, Sun } from 'lucide-react';
import type { ConfigField } from '@sdk';
import { hostApi } from '../../lib/api';
import { useStore } from '../../lib/store';
import { SchemaForm } from '../../components/SchemaForm';
import { THEME_PRESETS } from '../../lib/themes';
import { listClientPlugins } from '../../lib/registry';

const DAYS = [
  { label: 'Mon', value: '1' },
  { label: 'Tue', value: '2' },
  { label: 'Wed', value: '3' },
  { label: 'Thu', value: '4' },
  { label: 'Fri', value: '5' },
  { label: 'Sat', value: '6' },
  { label: 'Sun', value: '0' },
];

export function DisplayPage() {
  const { layout, updateLayout, apiFor } = useStore();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof hostApi.display>>>();
  const [sched, setSched] = useState<Record<string, unknown>>({});
  const [presence, setPresence] = useState<Record<string, unknown>>({});
  const [night, setNight] = useState<Record<string, unknown>>({ ...(layout?.night ?? {}) });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>();
  const hasHA = listClientPlugins().some((p) => p.manifest.id === 'home-assistant');

  const load = () =>
    hostApi
      .display()
      .then((d) => {
        setInfo(d);
        setSched({ enabled: d.settings.schedule.enabled, offAt: d.settings.schedule.offAt, onAt: d.settings.schedule.onAt, days: (d.settings.schedule.days ?? []).map(String), brightness: d.settings.brightness });
        setPresence({ presenceEntities: d.settings.presenceEntities, wakeSeconds: d.settings.wakeSeconds, stayOnWhilePresent: d.settings.stayOnWhilePresent });
      })
      .catch((e) => setMsg((e as Error).message));
  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(undefined);
    try {
      await hostApi.saveDisplaySettings({
        schedule: { enabled: !!sched.enabled, offAt: String(sched.offAt ?? '23:30'), onAt: String(sched.onAt ?? '06:30'), days: (sched.days as string[] | undefined)?.map(Number) },
        brightness: Number(sched.brightness ?? 100),
        presenceEntities: (presence.presenceEntities as string[]) ?? [],
        wakeSeconds: Number(presence.wakeSeconds ?? 120),
        stayOnWhilePresent: !!presence.stayOnWhilePresent,
      });
      updateLayout((l) => ({ ...l, night: { enabled: !!night.enabled, from: String(night.from ?? '23:00'), to: String(night.to ?? '06:30'), brightness: Number(night.brightness ?? 30), preset: (night.preset as string) || undefined } }));
      setMsg('Saved.');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const st = info?.state;
  const hostApiClient = apiFor('$host');

  const SCHEDULE: ConfigField[] = [
    { key: 'enabled', label: 'Turn the display off on a schedule', type: 'boolean' },
    { key: 'offAt', label: 'Off at', type: 'time', showWhen: { key: 'enabled', equals: true } },
    { key: 'onAt', label: 'Back on at', type: 'time', showWhen: { key: 'enabled', equals: true } },
    { key: 'days', label: 'Only on these days (empty = every day)', type: 'multiselect', options: DAYS, showWhen: { key: 'enabled', equals: true } },
    { key: 'brightness', label: 'Daytime brightness', type: 'number', min: 10, max: 100, unit: '%' },
  ];
  const PRESENCE: ConfigField[] = [
    {
      key: 'presenceEntities',
      label: 'Wake when one of these Home Assistant entities turns on / home / open',
      type: 'multiselect',
      optionsFrom: 'entities',
      help: hasHA ? 'Motion sensors, door sensors, person entities… Set up the Home Assistant plugin first.' : 'Install the Home Assistant plugin to use presence.',
    },
    { key: 'wakeSeconds', label: 'Stay awake after activity for', type: 'number', min: 10, max: 3600, unit: 'seconds' },
    { key: 'stayOnWhilePresent', label: 'Keep the display on while any of them is on / home', type: 'boolean' },
  ];
  const NIGHT: ConfigField[] = [
    { key: 'enabled', label: 'Night mode (dim the dashboard between two times)', type: 'boolean' },
    { key: 'from', label: 'From', type: 'time', showWhen: { key: 'enabled', equals: true } },
    { key: 'to', label: 'Until', type: 'time', showWhen: { key: 'enabled', equals: true } },
    { key: 'brightness', label: 'Night brightness', type: 'number', min: 10, max: 100, unit: '%', showWhen: { key: 'enabled', equals: true } },
    {
      key: 'preset',
      label: 'Switch to this theme at night',
      type: 'select',
      options: [{ label: 'Keep current theme', value: '' }, ...THEME_PRESETS.map((p) => ({ label: p.name, value: p.id }))],
      showWhen: { key: 'enabled', equals: true },
    },
  ];

  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${st?.on ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-white/5 text-white/40'}`}>
            {st ? st.on ? <MonitorUp /> : <MonitorOff /> : <Loader2 className="animate-spin" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{st ? (st.on ? `Display on · ${st.brightness}%` : 'Display off') : 'Checking…'}</h2>
            <p className="text-xs text-white/50">
              {st ? (
                <>
                  Backlight: {st.hardware.backlight ? 'hardware' : 'software dim'} · Power: {st.hardware.power ? 'hardware' : 'black screen'}
                  {st.reason ? ` · last change: ${st.reason}` : ''}
                  {info?.manual ? ` · manual override${info.manual.until ? ` until ${new Date(info.manual.until).toLocaleTimeString()}` : ''}` : ''}
                </>
              ) : (
                ''
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-default" onClick={() => hostApi.setDisplay({ on: true }).then(load)}>
              <Sun size={14} /> On
            </button>
            <button className="btn btn-default" onClick={() => hostApi.setDisplay({ on: false }).then(load)}>
              <Moon size={14} /> Off
            </button>
            {info?.manual && (
              <button className="btn btn-ghost" onClick={() => hostApi.setDisplay({ clear: true }).then(load)}>
                Back to schedule
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-white/50 w-24">Brightness</span>
          <input
            type="range"
            min={10}
            max={100}
            value={Number(sched.brightness ?? st?.brightness ?? 100)}
            className="flex-1 accent-[var(--accent)]"
            onChange={(e) => setSched({ ...sched, brightness: Number(e.target.value) })}
            onMouseUp={(e) => hostApi.setDisplay({ brightness: Number((e.target as HTMLInputElement).value) }).then(load)}
            onTouchEnd={(e) => hostApi.setDisplay({ brightness: Number((e.target as HTMLInputElement).value) }).then(load)}
          />
          <span className="w-10 text-right text-sm tabular">{Number(sched.brightness ?? st?.brightness ?? 100)}%</span>
        </div>
        <p className="mt-3 text-xs text-white/40">
          Without a writable hardware backlight the kiosk dims in software (a translucent black layer). Without an output power command it shows a black screen — the panel
          stays powered but dark. Automations: <span className="font-mono">POST /api/display {'{'} "on": false {'}'}</span> with an API token.
        </p>
      </section>

      <section className="surface rounded-2xl border border-white/10 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">Schedule</h2>
        <SchemaForm fields={SCHEDULE.filter((f) => f.key !== 'brightness')} value={sched} onChange={setSched} api={hostApiClient} />
      </section>
      <section className="surface rounded-2xl border border-white/10 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">Presence (Home Assistant)</h2>
        <SchemaForm fields={PRESENCE} value={presence} onChange={setPresence} api={apiFor('home-assistant')} />
      </section>
      <section className="surface rounded-2xl border border-white/10 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">Night mode</h2>
        <SchemaForm fields={NIGHT} value={night} onChange={setNight} api={hostApiClient} />
      </section>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />} Save display settings
        </button>
        {msg && <span className="text-xs text-white/60">{msg}</span>}
      </div>
    </div>
  );
}
