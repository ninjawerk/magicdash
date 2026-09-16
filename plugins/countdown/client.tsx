import { useEffect } from 'react';
import { definePlugin, formatDuration, useNow, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config { title?: string; target?: string; showSeconds?: boolean; grabAttention?: boolean; style?: 'big' | 'units' }

function CountdownWidget({ config, size, editMode, openSettings, setAlert, attention }: WidgetProps<Config>) {
  const now = useNow(1000);                                   // re-render every second
  const target = config.target ? new Date(config.target).getTime() : NaN;
  const remaining = target - now.getTime();

  const lastHour = remaining > 0 && remaining <= 3_600_000;
  const lastMinute = remaining > 0 && remaining <= 60_000;
  useEffect(() => setAlert(lastHour), [lastHour, setAlert]);  // red pulsing tile

  useEffect(() => {                                           // attention lock: one holder, 120 s max
    if (config.grabAttention !== false && lastMinute) attention.request(`${config.title ?? 'Countdown'} is about to end`);
    else if (attention.held) attention.release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMinute, attention.held]);

  if (!config.target || Number.isNaN(target)) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/50 cursor-pointer" onClick={editMode ? openSettings : undefined}>
        Set a date in this tile's settings.
      </div>
    );
  }

  const fontSize = Math.min(size.height * 0.45, size.width / 6);
  if (remaining <= 0) {
    return <div className="flex h-full items-center justify-center font-bold" style={{ fontSize }}>🎉 {config.title ?? 'It’s time!'}</div>;
  }

  const days = Math.floor(remaining / 86_400_000);
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      {config.title && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{config.title}</div>}
      {config.style === 'units' ? (
        <div className="mt-1 flex gap-4 tabular">
          {[['d', days], ['h', Math.floor((remaining / 3_600_000) % 24)], ['m', Math.floor((remaining / 60_000) % 60)]].map(([u, v]) => (
            <div key={u as string}>
              <div className="font-bold leading-none" style={{ fontSize: fontSize * 0.8, color: lastHour ? 'var(--warm)' : undefined }}>{v}</div>
              <div className="text-xs text-white/40">{u}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1 font-bold leading-none tabular" style={{ fontSize, color: lastHour ? 'var(--warm)' : undefined }}>
          {days > 0 ? `${days}d ${formatDuration(remaining % 86_400_000)}` : formatDuration(remaining, { seconds: config.showSeconds })}
        </div>
      )}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: CountdownWidget });
