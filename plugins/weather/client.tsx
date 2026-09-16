import { useEffect, useState } from 'react';
import { Droplets, Loader2, MapPin, Search, Sun, Sunrise, Sunset, Thermometer, Wind } from 'lucide-react';
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
  background?: 'auto' | 'subtle' | 'none' | 'custom';
  customBackground?: string;
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
// Colour helpers
// ---------------------------------------------------------------------------
/**
 * Temperature → colour, from the theme: cold → --cool, mild → text colour, hot → --warm.
 * Input in °C. Returns a CSS color-mix() expression so it follows theme changes live.
 */
function tempColor(c: number): string {
  const t = Math.max(0, Math.min(1, (c + 5) / 35)); // -5°C → 0, 30°C → 1
  if (t < 0.5) {
    const pct = Math.round((1 - t * 2) * 100); // 100% cool at the cold end
    return `color-mix(in oklab, var(--cool) ${pct}%, var(--fg))`;
  }
  const pct = Math.round((t - 0.5) * 2 * 100); // 100% warm at the hot end
  return `color-mix(in oklab, var(--warm) ${pct}%, var(--fg))`;
}
const toC = (t: number, units: string) => (units === 'imperial' ? ((t - 32) * 5) / 9 : t);

/** Background wash for the whole tile, by condition. Translucent so it sits on any theme. */
function conditionGradient(code: number, isDay: boolean): string {
  if (code === 0 || code === 1) {
    return isDay
      ? 'linear-gradient(135deg, rgba(255,184,77,0.40) 0%, rgba(255,140,90,0.18) 45%, rgba(56,140,255,0.28) 100%)'
      : 'linear-gradient(135deg, rgba(90,100,220,0.38) 0%, rgba(30,30,90,0.30) 60%, rgba(200,190,255,0.12) 100%)';
  }
  if (code === 2) return 'linear-gradient(135deg, rgba(110,165,255,0.34) 0%, rgba(255,200,120,0.18) 60%, rgba(140,150,180,0.20) 100%)';
  if (code === 3 || code === 45 || code === 48) return 'linear-gradient(135deg, rgba(150,160,185,0.32) 0%, rgba(90,100,125,0.24) 100%)';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'linear-gradient(135deg, rgba(70,130,230,0.38) 0%, rgba(40,60,120,0.30) 100%)';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'linear-gradient(135deg, rgba(190,225,255,0.36) 0%, rgba(120,150,210,0.22) 100%)';
  if (code >= 95) return 'linear-gradient(135deg, rgba(150,95,230,0.42) 0%, rgba(60,40,120,0.32) 100%)';
  return 'linear-gradient(135deg, rgba(120,150,200,0.3) 0%, rgba(60,80,120,0.2) 100%)';
}
function glowColor(code: number, isDay: boolean): string {
  if (code <= 1) return isDay ? 'rgba(255,209,102,0.55)' : 'rgba(205,214,244,0.35)';
  if (code === 2) return isDay ? 'rgba(255,209,102,0.35)' : 'rgba(205,214,244,0.25)';
  if (code >= 95) return 'rgba(195,166,255,0.5)';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rgba(124,196,255,0.45)';
  if (code >= 71 && code <= 86) return 'rgba(224,242,255,0.45)';
  return 'rgba(201,209,224,0.3)';
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------
function WeatherWidget({ config, api, size, openSettings, editMode, setBackground }: WidgetProps<Config>) {
  const loc = config.location;
  const units = config.units ?? 'metric';
  const fc = usePluginQuery<Forecast>(api, '/forecast', {
    enabled: !!loc,
    query: loc ? { lat: loc.lat, lon: loc.lon, units, name: loc.name } : undefined,
    refreshMs: 10 * 60_000,
  });

  const cur0 = fc.data?.current;
  const bgMode = config.background ?? 'auto';
  const customBg = config.customBackground?.trim();
  useEffect(() => {
    if (bgMode === 'none') {
      setBackground(undefined);
      return;
    }
    if (bgMode === 'custom') {
      setBackground(customBg || undefined);
      return () => setBackground(undefined);
    }
    if (!cur0) {
      setBackground(undefined);
      return;
    }
    const glowSize = Math.max(160, size.width * 0.5);
    const css = `radial-gradient(${glowSize}px ${glowSize}px at 12% 8%, ${glowColor(cur0.code, cur0.isDay)} 0%, transparent 70%), ${conditionGradient(cur0.code, cur0.isDay)}`;
    // "subtle" fades the wash by layering the tile colour on top.
    setBackground(bgMode === 'subtle' ? `linear-gradient(color-mix(in srgb, var(--surface) 55%, transparent), color-mix(in srgb, var(--surface) 55%, transparent)), ${css}` : css);
    return () => setBackground(undefined);
  }, [bgMode, customBg, cur0?.code, cur0?.isDay, size.width, setBackground]);

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
  const { width: W, height: H } = size;
  const compact = H < 150 || W < 240;
  const today = d.daily[0];
  const days = Math.min(config.days ?? 7, d.daily.length);
  const cur = d.current;
  const curColor = tempColor(toC(cur.temp, units));

  // Budget the vertical space. Priority: header → hourly strip → day rows (≥2) → detail chips.
  const headerH = compact ? 70 : 92;
  const ROW_H = 30;
  const HOURLY_H = 84;
  const CHIPS_H = 42;
  let remaining = H - 16 - headerH;
  const minRows = days > 0 ? ROW_H * 2 : 0;
  const showHourly = config.showHourly !== false && W >= 260 && remaining >= HOURLY_H + minRows;
  if (showHourly) remaining -= HOURLY_H;
  // Chips only when they don't cost us the hourly strip or drop the list below three days.
  const showChips = config.showDetails !== false && !compact && W >= 300 && remaining >= CHIPS_H + (days > 0 ? ROW_H * 3 : 0);
  if (showChips) remaining -= CHIPS_H;
  const rowCount = Math.min(days, Math.floor(remaining / ROW_H));
  const showDaily = days > 0 && rowCount >= 2;
  const hourCount = Math.max(4, Math.min(12, Math.floor(W / 56)));
  const weekMin = Math.min(...d.daily.slice(0, days).map((x) => x.tMin));
  const weekMax = Math.max(...d.daily.slice(0, days).map((x) => x.tMax));
  const span = Math.max(1, weekMax - weekMin);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="relative flex h-full flex-col gap-2 px-5 pb-4 pt-1">
        {/* Current */}
        <div className="flex items-center gap-4" style={{ minHeight: headerH - 12 }}>
          <div className="relative shrink-0">
            <WeatherIcon code={cur.code} isDay={cur.isDay} size={compact ? 44 : Math.min(72, H * 0.28)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start leading-none">
              <span className="font-bold tracking-tight tabular" style={{ fontSize: Math.min(compact ? 40 : 58, W / 5.5), color: curColor }}>
                {Math.round(cur.temp)}
              </span>
              <span className="mt-1 text-lg font-semibold text-white/50">{deg}</span>
              {today && (
                <span className="ml-3 mt-1.5 flex flex-col text-xs leading-tight tabular">
                  <span style={{ color: tempColor(toC(today.tMax, units)) }}>H {Math.round(today.tMax)}°</span>
                  <span style={{ color: tempColor(toC(today.tMin, units)) }}>L {Math.round(today.tMin)}°</span>
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm font-medium text-white/80">{describeCode(cur.code)}</div>
            <div className="flex items-center gap-1 truncate text-xs text-white/45">
              <MapPin size={11} /> {loc.name}
              {loc.country ? `, ${loc.country}` : ''}
            </div>
          </div>
        </div>

        {/* Detail chips */}
        {showChips && (
          <div className="mt-2 flex flex-nowrap gap-1.5 overflow-hidden">
            <Chip icon={<Thermometer size={12} />} color="var(--warm)" label="Feels" value={`${Math.round(cur.feelsLike)}°`} />
            <Chip icon={<Droplets size={12} />} color="var(--cool)" label="Humidity" value={`${cur.humidity}%`} />
            {W >= 400 && <Chip icon={<Wind size={12} />} color="color-mix(in oklab, var(--cool) 60%, var(--fg))" label="Wind" value={`${Math.round(cur.wind)} ${speed}`} />}
            {W >= 470 && <Chip icon={<Sun size={12} />} color="var(--warm)" label="UV" value={`${Math.round(cur.uv)}`} />}
            {W >= 560 && today && <Chip icon={<Sunrise size={12} />} color="var(--warm)" label="Sunrise" value={fmtTime(today.sunrise)} />}
            {W >= 640 && today && <Chip icon={<Sunset size={12} />} color="var(--accent)" label="Sunset" value={fmtTime(today.sunset)} />}
          </div>
        )}

        {/* Hourly */}
        {showHourly && (
          <div className="flex justify-between gap-1 rounded-2xl bg-black/15 px-3 py-1.5">
            {d.hourly.slice(0, hourCount).map((h, i) => (
              <div key={h.time} className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                <span className="text-[10px] text-white/50">{i === 0 ? 'Now' : fmtHour(h.time)}</span>
                <WeatherIcon code={h.code} isDay={h.isDay} size={20} />
                <span className="text-xs font-semibold tabular" style={{ color: tempColor(toC(h.temp, units)) }}>
                  {Math.round(h.temp)}°
                </span>
                <span className="h-3 text-[9px] text-[var(--cool)]">{h.precipProb > 15 ? `${h.precipProb}%` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Daily — rows with range bars */}
        {showDaily && (
          <div className="mt-1 flex flex-1 flex-col justify-evenly">
            {d.daily.slice(0, rowCount).map((day, i) => {
              const lo = ((day.tMin - weekMin) / span) * 100;
              const hi = ((day.tMax - weekMin) / span) * 100;
              return (
                <div key={day.date} className="flex items-center gap-2.5 py-[3px] text-sm" style={{ minHeight: ROW_H }}>
                  <span className="w-10 shrink-0 text-xs font-semibold uppercase tracking-wider text-white/55">{i === 0 ? 'Today' : fmtDay(day.date)}</span>
                  <WeatherIcon code={day.code} size={20} className="shrink-0" />
                  {W >= 300 && <span className="w-8 shrink-0 text-right text-[10px] text-[var(--cool)] tabular">{day.precipProb > 15 ? `${day.precipProb}%` : ''}</span>}
                  <span className="w-7 shrink-0 text-right text-xs tabular text-white/60">{Math.round(day.tMin)}°</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-white/10">
                    <span
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        left: `${lo}%`,
                        width: `${Math.max(6, hi - lo)}%`,
                        background: `linear-gradient(90deg, ${tempColor(toC(day.tMin, units))}, ${tempColor(toC(day.tMax, units))})`,
                      }}
                    />
                  </span>
                  <span className="w-7 shrink-0 text-xs font-semibold tabular">{Math.round(day.tMax)}°</span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

function Chip({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/20 px-2.5 py-1 text-xs">
      <span style={{ color }}>{icon}</span>
      <span className="text-white/50">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </span>
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
