import { useEffect, useMemo } from 'react';
import { MapPin, Sparkles, Sunrise, Sunset } from 'lucide-react';
import { definePlugin, formatDuration, useNow, useT, type CustomFieldProps, type GeoLocation, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';
import { vedicPeriods, type Period } from './sun';
import { LocationPicker } from '../../src/app/components/LocationPicker';

interface Config {
  location?: GeoLocation;
  showAbhijit?: boolean;
  showYamagandam?: boolean;
  showGulika?: boolean;
  showSun?: boolean;
  showTomorrow?: boolean;
  alert?: boolean;
  warnMinutes?: number;
  hour12?: boolean;
}

function LocationField({ value, onChange }: CustomFieldProps<GeoLocation | undefined>) {
  return <LocationPicker value={value} onChange={onChange} />;
}

function RahuKaalaWidget({ config, context, size, setAlert, editMode, openSettings }: WidgetProps<Config>) {
  const t = useT(manifest.id);
  const now = useNow(1000);
  const loc = config.location ?? context.location;
  const hour12 = config.hour12 ?? false;
  // Show times in the location's own zone (a Colombo location on a kiosk in Europe should still say 06:01, not 02:31).
  const fmt = (d: Date) => {
    try {
      return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', hour12, timeZone: loc?.timezone }).format(d);
    } catch {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12 });
    }
  };

  const today = useMemo(() => (loc ? vedicPeriods(now, loc.lat, loc.lon) : null), [loc, now.getDate(), now.getMonth()]);
  const tomorrow = useMemo(() => {
    if (!loc) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return vedicPeriods(d, loc.lat, loc.lon);
  }, [loc, now.getDate(), now.getMonth()]);

  const rahu = today?.periods.find((p) => p.key === 'rahu');
  const ms = now.getTime();
  const state: 'before' | 'during' | 'after' | undefined = rahu ? (ms < rahu.start.getTime() ? 'before' : ms < rahu.end.getTime() ? 'during' : 'after') : undefined;
  const warnMs = (config.warnMinutes ?? 15) * 60_000;
  const soon = state === 'before' && rahu && rahu.start.getTime() - ms <= warnMs;
  useEffect(() => setAlert(config.alert !== false && state === 'during'), [state, config.alert, setAlert]);

  if (!loc) {
    return (
      <Center onClick={editMode ? openSettings : undefined}>
        <MapPin className="text-white/40" />
        <p className="text-sm text-white/60">{t('noLocation')}</p>
      </Center>
    );
  }
  if (!today || !rahu) return <Center><p className="text-sm text-white/50">{t('polar')}</p></Center>;

  const compact = size.height < 150;
  const big = Math.min(compact ? 26 : 40, size.width / 7);
  const showNext = state === 'after' && config.showTomorrow !== false && tomorrow;
  const nextRahu = showNext ? tomorrow!.periods.find((p) => p.key === 'rahu') : undefined;
  // Once today's Rahu Kaala has passed, the whole tile describes tomorrow.
  const shown = showNext ? tomorrow! : today;
  const extras: Period[] = [
    ...(config.showYamagandam ? shown.periods.filter((p) => p.key === 'yamagandam') : []),
    ...(config.showGulika ? shown.periods.filter((p) => p.key === 'gulika') : []),
  ];
  const abhijit = config.showAbhijit !== false ? shown.periods.find((p) => p.key === 'abhijit') : undefined;
  const abhijitNow = !showNext && !!abhijit && ms >= abhijit.start.getTime() && ms < abhijit.end.getTime();
  const isWednesday = (showNext ? (now.getDay() + 1) % 7 : now.getDay()) === 3;

  return (
    <div className="flex h-full flex-col justify-center px-5 pb-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
        <span className={state === 'during' ? 'text-red-300' : soon ? 'text-[var(--warm)]' : 'text-[var(--accent)]'}>
          {state === 'during' ? t('now') : state === 'after' ? (nextRahu ? t('tomorrow') : t('over')) : soon ? t('soon') : t('today')}
        </span>
        <span className="truncate font-medium normal-case tracking-normal text-white/40">
          <MapPin size={10} className="mr-0.5 inline" />
          {loc.name}
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold leading-none tracking-tight tabular" style={{ fontSize: big }}>
            {nextRahu ? `${fmt(nextRahu.start)} – ${fmt(nextRahu.end)}` : `${fmt(rahu.start)} – ${fmt(rahu.end)}`}
          </div>
          <div className="mt-1 text-sm text-white/55">{t('rahu')}</div>
        </div>
        {(state === 'before' || state === 'during') && !compact && (
          <div className="shrink-0 text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/40">{state === 'during' ? t('endsIn') : t('startsIn')}</div>
            <div className={`font-mono font-bold leading-none tabular ${state === 'during' ? 'text-red-200' : ''}`} style={{ fontSize: big * 0.8 }}>
              {formatDuration(state === 'during' ? rahu.end.getTime() - ms : rahu.start.getTime() - ms, { seconds: true })}
            </div>
          </div>
        )}
      </div>
      {abhijit && !compact && (
        <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${abhijitNow ? 'bg-[color-mix(in_srgb,var(--cool)_18%,transparent)]' : 'bg-white/[0.04]'}`}>
          <Sparkles size={14} className="shrink-0 text-[var(--cool)]" />
          <span className="text-white/50">{t('abhijit')}</span>
          <span className="font-semibold tabular">
            {fmt(abhijit.start)} – {fmt(abhijit.end)}
          </span>
          {abhijitNow && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[var(--cool)]">{t('now2')}</span>}
          {isWednesday && !abhijitNow && <span className="ml-auto text-[10px] text-white/35" title={t('wedNote')}>{t('wed')}</span>}
        </div>
      )}
      {!compact && (extras.length > 0 || config.showSun !== false) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-2 text-xs text-white/55">
          {extras.length > 0 && <span className="text-white/40">{t('alsoAvoid')}:</span>}
          {extras.map((p) => (
            <span key={p.key} className={ms >= p.start.getTime() && ms < p.end.getTime() ? 'text-[var(--warm)]' : ''}>
              <span className="text-white/40">{t(p.key)}</span> {fmt(p.start)}–{fmt(p.end)}
            </span>
          ))}
          {config.showSun !== false && (
            <span className="ml-auto flex items-center gap-2">
              <Sunrise size={12} className="text-[var(--warm)]" /> {fmt(shown.sunrise)}
              <Sunset size={12} className="text-[var(--accent)]" /> {fmt(shown.sunset)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Center({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-2 p-4 text-center ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

export default definePlugin<Config>({
  manifest,
  Widget: RahuKaalaWidget,
  customFields: { location: LocationField as React.ComponentType<CustomFieldProps> },
  translations: {
    en: {
      rahu: 'Rahu period — avoid starting new things',
      yamagandam: 'Yama',
      gulika: 'Gulika',
      alsoAvoid: 'Also avoid',
      today: 'Today',
      tomorrow: 'Tomorrow',
      now: 'Avoid now — Rahu period',
      soon: 'Rahu period starting soon',
      over: 'Done for today',
      startsIn: 'starts in',
      endsIn: 'ends in',
      noLocation: 'Set the dashboard location (Appearance → Dashboard) or pick one in this tile’s settings.',
      polar: 'No sunrise/sunset here today.',
      abhijit: 'Best time of day',
      now2: 'now',
      wed: 'traditionally skipped on Wednesdays',
      wedNote: 'Tradition skips the midday best time on Wednesdays.',
    },
    ta: { alsoAvoid: 'தவிர்க்க', abhijit: 'நல்ல நேரம் · அபிஜித்', now2: 'இப்போது', wed: 'புதன் தவிர', rahu: 'ராகு காலம்', yamagandam: 'எமகண்டம்', gulika: 'குளிகை', today: 'இன்று', tomorrow: 'நாளை', now: 'இப்போது ராகு காலம்', soon: 'விரைவில்', over: 'இன்று முடிந்தது', startsIn: 'தொடங்க', endsIn: 'முடிய' },
    si: { alsoAvoid: 'වළකින්න', abhijit: 'සුබ වේලාව · අභිජිත්', now2: 'දැන්', wed: 'බදාදා හැර', rahu: 'රාහු කාලය', yamagandam: 'යමගණ්ඩ', gulika: 'ගුලික', today: 'අද', tomorrow: 'හෙට', now: 'දැන් රාහු කාලය', soon: 'ළඟදීම', over: 'අද අවසන්', startsIn: 'ආරම්භයට', endsIn: 'අවසානයට' },
    hi: { alsoAvoid: 'इनसे भी बचें', abhijit: 'शुभ समय · अभिजित', now2: 'अभी', wed: 'बुधवार को नहीं', rahu: 'राहु काल', yamagandam: 'यमगण्ड', gulika: 'गुलिक', today: 'आज', tomorrow: 'कल', now: 'अभी राहु काल', soon: 'जल्द शुरू', over: 'आज समाप्त', startsIn: 'शुरू होने में', endsIn: 'समाप्त होने में' },
  },
});
