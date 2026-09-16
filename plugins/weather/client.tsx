import { useEffect, useState } from 'react';
import { Droplets, Loader2, MapPin, Search, Sunrise, Sunset, Wind } from 'lucide-react';
import { definePlugin, usePluginQuery, type CustomFieldProps, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';
import { describeCode, type Forecast, type Location } from './shared';
import { WeatherIcon } from './WeatherIcon';

interface Config {
  location?: Location;
  units?: 'metric' | 'imperial';
  showHourly?: boolean;
  days?: number;
  showDetails?: boolean;
}

// ---------------------------------------------------------------------------
// Location picker (custom config field)
// ---------------------------------------------------------------------------
function LocationField({ value, onChange, api }: CustomFieldProps<Location | undefined>) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setBusy(true);
      api
        .get<Location[]>('/search', { q })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, api]);

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm">
          <MapPin size={14} className="text-[var(--accent)]" />
          <span className="flex-1">
            {value.name}
            {value.admin ? `, ${value.admin}` : ''}
            {value.country ? `, ${value.country}` : ''}
          </span>
          <span className="font-mono text-xs text-white/40">
            {value.lat.toFixed(2)}, {value.lon.toFixed(2)}
          </span>
        </div>
      )}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input className="input pl-9" placeholder="Search city… or “51.5, -0.12”" value={q} onChange={(e) => setQ(e.target.value)} />
        {busy && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/40" />}
      </div>
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-white/10"
              onClick={() => {
                onChange(r);
                setQ('');
                setResults([]);
              }}
            >
              <MapPin size={14} className="text-white/40 shrink-0" />
              <span className="flex-1 truncate">
                {r.name}
                {r.admin ? `, ${r.admin}` : ''}
                {r.country ? `, ${r.country}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------
function WeatherWidget({ config, api, size, openSettings, editMode }: WidgetProps<Config>) {
  const loc = config.location;
  const units = config.units ?? 'metric';
  const fc = usePluginQuery<Forecast>(api, '/forecast', {
    enabled: !!loc,
    query: loc ? { lat: loc.lat, lon: loc.lon, units, name: loc.name } : undefined,
    refreshMs: 10 * 60_000,
  });

  if (!loc) {
    return (
      <Empty onClick={editMode ? openSettings : undefined}>
        <MapPin /> <span>Choose a location in this tile’s settings.</span>
      </Empty>
    );
  }
  if (fc.error && !fc.data) return <Empty>⚠️ {fc.error}</Empty>;
  if (!fc.data) {
    return (
      <Empty>
        <Loader2 className="animate-spin" />
      </Empty>
    );
  }

  const d = fc.data;
  const deg = units === 'imperial' ? '°F' : '°C';
  const speed = units === 'imperial' ? 'mph' : 'km/h';
  const compact = size.height < 230 || size.width < 280;
  const wide = size.width > 520;
  const days = Math.min(config.days ?? 7, d.daily.length);
  // Rough budgets: current ≈ 90px (70 compact), hourly ≈ 90px, daily ≈ 100px.
  const showDaily = days > 0 && size.height > 190;
  const showHourly = config.showHourly !== false && size.height > (showDaily ? 370 : 240);
  const today = d.daily[0];
  const hourCount = Math.max(4, Math.min(12, Math.floor(size.width / 58)));
  const dayCount = Math.min(days, Math.max(3, Math.floor(size.width / 64)));

  return (
    <div className="flex h-full flex-col px-5 pb-4 gap-3 overflow-hidden">
      {/* Current */}
      <div className="flex items-center gap-4 min-h-0">
        <WeatherIcon code={d.current.code} isDay={d.current.isDay} size={compact ? 44 : 64} />
        <div className="min-w-0">
          <div className="flex items-start leading-none">
            <span className="font-bold tracking-tight tabular" style={{ fontSize: Math.min(compact ? 40 : 56, size.width / 5) }}>
              {Math.round(d.current.temp)}
            </span>
            <span className="mt-1 text-lg text-white/50 font-semibold">{deg}</span>
          </div>
          <div className="text-sm text-white/70 truncate">
            {describeCode(d.current.code)}
            {today && (
              <span className="text-white/40">
                {' '}
                · H {Math.round(today.tMax)}° L {Math.round(today.tMin)}°
              </span>
            )}
          </div>
          <div className="text-xs text-white/40 truncate flex items-center gap-1">
            <MapPin size={11} /> {loc.name}
            {loc.country ? `, ${loc.country}` : ''}
          </div>
        </div>
        {config.showDetails !== false && (wide || (!showHourly && size.width > 380)) && !compact && (
          <div className="ml-auto grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs text-white/60 shrink-0">
            <Detail icon={<Droplets size={13} />} label="Humidity" value={`${d.current.humidity}%`} />
            <Detail icon={<Wind size={13} />} label="Wind" value={`${Math.round(d.current.wind)} ${speed}`} />
            {today && <Detail icon={<Sunrise size={13} />} label="Sunrise" value={fmtTime(today.sunrise)} />}
            {today && <Detail icon={<Sunset size={13} />} label="Sunset" value={fmtTime(today.sunset)} />}
          </div>
        )}
      </div>

      {/* Hourly */}
      {showHourly && (
        <div className="flex justify-between gap-1 border-t border-white/10 pt-3">
          {d.hourly.slice(0, hourCount).map((h, i) => (
            <div key={h.time} className="flex flex-col items-center gap-1 text-center min-w-0">
              <span className="text-[11px] text-white/45">{i === 0 ? 'Now' : fmtHour(h.time)}</span>
              <WeatherIcon code={h.code} isDay={h.isDay} size={22} />
              <span className="text-sm font-semibold tabular">{Math.round(h.temp)}°</span>
              {h.precipProb > 15 && <span className="text-[10px] text-sky-300">{h.precipProb}%</span>}
            </div>
          ))}
        </div>
      )}

      {/* Daily */}
      {showDaily && (
        <div className="mt-auto flex justify-between gap-1 border-t border-white/10 pt-3">
          {d.daily.slice(0, dayCount).map((day, i) => (
            <div key={day.date} className="flex flex-col items-center gap-1 text-center min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{i === 0 ? 'Today' : fmtDay(day.date)}</span>
              <WeatherIcon code={day.code} size={26} />
              <span className="text-sm tabular">
                <span className="font-semibold">{Math.round(day.tMax)}°</span> <span className="text-white/40">{Math.round(day.tMin)}°</span>
              </span>
              {day.precipProb > 15 && <span className="text-[10px] text-sky-300">{day.precipProb}%</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-white/40">{icon}</span>
      <span className="text-white/40">{label}</span>
      <span className="font-semibold text-white/80 tabular ml-auto">{value}</span>
    </div>
  );
}

function Empty({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`flex h-full items-center justify-center gap-2 p-4 text-center text-sm text-white/40 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '');
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });
}

export default definePlugin<Config>({
  manifest,
  Widget: WeatherWidget,
  customFields: { location: LocationField as React.ComponentType<CustomFieldProps> },
});
