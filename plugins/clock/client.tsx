import { definePlugin, useNow, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config {
  hour12?: boolean;
  seconds?: boolean;
  date?: boolean;
  blink?: boolean;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  timeZone?: string;
  label?: string;
}

function ClockWidget({ config, size }: WidgetProps<Config>) {
  const now = useNow(config.seconds ? 250 : 1000);
  const tz = config.timeZone?.trim() || undefined;
  // Build the time as parts so the colons can be their own elements (for blinking).
  let parts: Array<{ type: string; value: string }> = [];
  let period = '';
  try {
    parts = new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
      second: config.seconds ? '2-digit' : undefined,
      hour12: config.hour12,
      timeZone: tz,
    }).formatToParts(now);
    period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  } catch {
    parts = [{ type: 'literal', value: 'Bad TZ' }];
  }
  const timeParts = parts.filter((p) => p.type === 'hour' || p.type === 'minute' || p.type === 'second' || (p.type === 'literal' && p.value.trim() === ':'));
  const date = new Intl.DateTimeFormat([], { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(now);
  // Scale the type to the tile.
  const fontSize = Math.min(size.height * (config.date ? 0.5 : 0.7), size.width / (config.seconds ? 5.2 : 3.6));

  const align = config.align ?? 'center';
  const valign = config.valign ?? 'middle';
  const alignCls = align === 'center' ? 'items-center text-center' : align === 'right' ? 'items-end text-right' : 'items-start text-left';
  const valignCls = valign === 'top' ? 'justify-start pt-2' : valign === 'bottom' ? 'justify-end pb-5' : 'justify-center';
  return (
    <div className={`flex h-full w-full flex-col px-6 ${alignCls} ${valignCls}`}>
      {config.label && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 mb-1">{config.label}</div>}
      <div className="flex items-baseline gap-2 leading-none font-bold tracking-tight tabular" style={{ fontSize }}>
        <span>
          {timeParts.map((p, i) =>
            p.type === 'literal' ? (
              <span key={i} className={config.blink ? 'colon-blink' : ''}>
                {p.value.trim()}
              </span>
            ) : (
              <span key={i}>{p.value}</span>
            ),
          )}
        </span>
        {period && <span className="text-white/50 font-semibold" style={{ fontSize: fontSize * 0.35 }}>{period}</span>}
      </div>
      {config.date && (
        <div className="mt-2 text-white/60 font-medium" style={{ fontSize: Math.max(12, fontSize * 0.22) }}>
          {date}
        </div>
      )}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: ClockWidget });
