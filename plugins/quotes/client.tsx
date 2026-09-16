import { useMemo } from 'react';
import { Quote as QuoteIcon, Sparkles } from 'lucide-react';
import { definePlugin, useNow, usePluginQuery, useRotation, useT, useTopic, type CalendarNextTopic, type WeatherCurrentTopic, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';
import { BUNDLED_QUOTES, parseQuoteLine, type Quote } from './quotes';

interface Config {
  source?: 'greeting' | 'bundled' | 'custom' | 'zenquotes';
  name?: string;
  weatherHints?: boolean;
  calendarHints?: boolean;
  extraGreetings?: string[];
  custom?: string[];
  intervalMin?: number;
  align?: 'left' | 'center';
}

/** Time of day + weather + calendar aware greeting, MagicMirror "compliments" style. */
function GreetingWidget({ config, size }: WidgetProps<Config>) {
  const t = useT(manifest.id);
  const now = useNow(30_000);
  const weather = useTopic<WeatherCurrentTopic>('weather:current');
  const next = useTopic<CalendarNextTopic>('calendar:next');
  const h = now.getHours();
  const period = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
  const name = config.name?.trim();
  const greeting = t(`greet.${period}`) + (name ? `, ${name}` : '');

  const lines = useMemo(() => {
    const out: string[] = [];
    if (config.weatherHints !== false && weather) {
      const c = weather.units === 'imperial' ? ((weather.temp - 32) * 5) / 9 : weather.temp;
      if (weather.rainSoon >= 50 || (weather.code >= 51 && weather.code <= 67) || (weather.code >= 80 && weather.code <= 82)) out.push(t('hint.rain'));
      else if (weather.code >= 71 && weather.code <= 86) out.push(t('hint.snow'));
      else if (weather.code >= 95) out.push(t('hint.storm'));
      else if (c >= 28 && weather.isDay) out.push(t('hint.hot'));
      else if (c <= 3) out.push(t('hint.cold'));
      else if (weather.code <= 1 && weather.isDay) out.push(t('hint.sunny'));
      else if (weather.code === 45 || weather.code === 48) out.push(t('hint.fog'));
    }
    if (config.calendarHints !== false && next && next.minutesUntil > 0 && next.minutesUntil <= 90) out.push(t('hint.next', { title: next.title, minutes: next.minutesUntil }));
    if (config.calendarHints !== false && next && next.minutesUntil <= 0) out.push(t('hint.now', { title: next.title }));
    out.push(...t(`fill.${period}`).split('|'));
    out.push(...(config.extraGreetings ?? []).filter(Boolean));
    return out.filter(Boolean);
  }, [weather, next, config.weatherHints, config.calendarHints, config.extraGreetings, t]);
  const [index] = useRotation(lines.length, 20_000, { random: true });
  const line = lines[index] ?? '';
  const center = config.align === 'center';
  const big = Math.max(20, Math.min(44, size.width / 11));
  return (
    <div className={`flex h-full flex-col justify-center px-6 pb-4 ${center ? 'items-center text-center' : ''}`}>
      <Sparkles className="mb-2 shrink-0 text-[var(--accent)] opacity-70" size={Math.max(16, big * 0.5)} />
      <p className="font-bold leading-tight tracking-tight" style={{ fontSize: big }}>
        {greeting}
      </p>
      {line && (
        <p key={index} className="fade-in mt-2 text-white/65" style={{ fontSize: Math.max(13, big * 0.5) }}>
          {line}
        </p>
      )}
    </div>
  );
}

function QuotesWidget(props: WidgetProps<Config>) {
  if ((props.config.source ?? 'bundled') === 'greeting') return <GreetingWidget {...props} />;
  return <QuoteList {...props} />;
}

function QuoteList({ config, api, size }: WidgetProps<Config>) {
  const source = config.source ?? 'bundled';
  const remote = usePluginQuery<Quote[]>(api, '/zenquotes', { enabled: source === 'zenquotes', refreshMs: 6 * 60 * 60 * 1000 });

  const quotes = useMemo<Quote[]>(() => {
    if (source === 'custom') {
      const parsed = (config.custom ?? []).map(parseQuoteLine).filter((q): q is Quote => !!q);
      return parsed.length ? parsed : [{ text: 'Add some quotes in this tile’s settings.' }];
    }
    if (source === 'zenquotes') return remote.data?.length ? remote.data : BUNDLED_QUOTES;
    return BUNDLED_QUOTES;
  }, [source, config.custom, remote.data]);

  const [index] = useRotation(quotes.length, (config.intervalMin ?? 15) * 60_000, { random: true });
  const q = quotes[index];
  const center = config.align === 'center';
  // Fit the quote: budget ~55% of the tile area for the text, assume ~0.5em avg glyph width and 1.3 line height.
  const area = size.width * Math.max(60, size.height - 70) * 0.55;
  const fontSize = Math.max(13, Math.min(30, Math.sqrt(area / (Math.max(30, q.text.length) * 0.5 * 1.3))));

  return (
    <div key={index} className={`fade-in flex h-full flex-col justify-center px-6 pb-5 ${center ? 'items-center text-center' : ''}`}>
      <QuoteIcon className="text-[var(--accent)] opacity-70 mb-2 shrink-0" size={Math.max(16, fontSize * 0.7)} />
      <p className="font-medium leading-snug text-white/90" style={{ fontSize }}>
        {q.text}
      </p>
      {q.author && (
        <p className="mt-3 text-white/45 font-medium" style={{ fontSize: Math.max(11, fontSize * 0.55) }}>
          — {q.author}
        </p>
      )}
    </div>
  );
}

export default definePlugin<Config>({
  manifest,
  Widget: QuotesWidget,
  translations: {
    en: {
      'greet.morning': 'Good morning',
      'greet.afternoon': 'Good afternoon',
      'greet.evening': 'Good evening',
      'greet.night': 'Good night',
      'hint.rain': 'Rain is on the way — take an umbrella.',
      'hint.snow': 'Snow today. Wrap up warm.',
      'hint.storm': 'Thunderstorms around — stay safe out there.',
      'hint.hot': 'It’s hot today. Water and sunscreen.',
      'hint.cold': 'Cold one. Coat, hat, gloves.',
      'hint.sunny': 'Clear skies. Make the most of it.',
      'hint.fog': 'Foggy out — take it slow.',
      'hint.next': '{title} in {minutes} min.',
      'hint.now': 'Right now: {title}.',
      'fill.morning': 'Make today count.|Coffee first, then greatness.|You’ve got this.',
      'fill.afternoon': 'Keep going — you’re doing well.|Time for a stretch?|Halfway there.',
      'fill.evening': 'Nice work today.|Time to wind down.|Whatever happened today, you showed up.',
      'fill.night': 'Rest well.|Tomorrow is a new page.|Screens off soon?',
    },
    de: {
      'greet.morning': 'Guten Morgen',
      'greet.afternoon': 'Guten Tag',
      'greet.evening': 'Guten Abend',
      'greet.night': 'Gute Nacht',
      'hint.rain': 'Regen im Anmarsch — Schirm nicht vergessen.',
      'hint.snow': 'Heute Schnee. Warm anziehen.',
      'hint.storm': 'Gewitter unterwegs — pass auf dich auf.',
      'hint.hot': 'Heute wird es heiß. Wasser und Sonnencreme.',
      'hint.cold': 'Kalt heute. Mantel, Mütze, Handschuhe.',
      'hint.sunny': 'Klarer Himmel. Nutze den Tag.',
      'hint.fog': 'Nebel draußen — langsam fahren.',
      'hint.next': '{title} in {minutes} Min.',
      'hint.now': 'Gerade: {title}.',
      'fill.morning': 'Mach was aus dem Tag.|Erst Kaffee, dann Großes.|Du schaffst das.',
      'fill.afternoon': 'Weiter so.|Zeit für eine Pause?|Halbzeit.',
      'fill.evening': 'Gute Arbeit heute.|Zeit zum Runterkommen.|Du warst da — das zählt.',
      'fill.night': 'Schlaf gut.|Morgen ist ein neuer Tag.|Bald Bildschirme aus?',
    },
    nl: {
      'greet.morning': 'Goedemorgen',
      'greet.afternoon': 'Goedemiddag',
      'greet.evening': 'Goedenavond',
      'greet.night': 'Goedenacht',
      'hint.rain': 'Er komt regen — neem een paraplu mee.',
      'hint.snow': 'Sneeuw vandaag. Kleed je warm aan.',
      'hint.storm': 'Onweer in de buurt — wees voorzichtig.',
      'hint.hot': 'Het wordt heet. Water en zonnebrand.',
      'hint.cold': 'Koud vandaag. Jas, muts, handschoenen.',
      'hint.sunny': 'Heldere lucht. Geniet ervan.',
      'hint.fog': 'Mistig buiten — rustig aan.',
      'hint.next': '{title} over {minutes} min.',
      'hint.now': 'Nu: {title}.',
      'fill.morning': 'Maak er iets van vandaag.|Eerst koffie.|Je kunt dit.',
      'fill.afternoon': 'Ga zo door.|Tijd om even te rekken?|Halverwege.',
      'fill.evening': 'Goed gedaan vandaag.|Tijd om te ontspannen.|Je was er — dat telt.',
      'fill.night': 'Slaap lekker.|Morgen is een nieuwe dag.|Schermen bijna uit?',
    },
  },
});
