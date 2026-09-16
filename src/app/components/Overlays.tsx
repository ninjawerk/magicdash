import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useStore } from '../lib/store';
import { THEME_PRESETS, applyTheme, normalizeTheme, stripPreset } from '../lib/themes';
import { inWindow } from '@sdk';
import { useT } from '@sdk/i18n';

/** Toast stack (top-right). */
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;
  const icon = { info: <Info size={18} />, success: <CheckCircle2 size={18} />, warn: <AlertTriangle size={18} />, error: <XCircle size={18} /> };
  const color = { info: 'var(--accent)', success: '#7bd88f', warn: 'var(--warm)', error: '#ff6b6b' };
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="surface-glass pointer-events-auto fade-in flex items-start gap-3 rounded-2xl border border-white/10 p-4 shadow-2xl"
          style={{ borderLeft: `4px solid ${color[t.level]}` }}
          onClick={() => dismissToast(t.id)}
          role="status"
        >
          <span className="mt-0.5 shrink-0" style={{ color: color[t.level] }}>
            {t.icon ? <span className="text-lg leading-none">{t.icon}</span> : icon[t.level]}
          </span>
          <div className="min-w-0 flex-1">
            {t.title && <div className="font-semibold leading-tight">{t.title}</div>}
            <div className="text-sm text-white/80">{t.message}</div>
          </div>
          <button className="btn btn-ghost -mr-2 -mt-1 p-1.5" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Display overlay: blacks out the kiosk when the display is "off" (tap to wake) and applies software dimming
 * when there's no hardware backlight. Also switches the theme preset during night mode.
 */
export function DisplayLayer() {
  const { display, wakeDisplay, layout } = useStore();
  const t = useT('host');
  const night = layout?.night;
  const nightActive = useMemo(() => !!night?.enabled && inWindow({ from: night.from, to: night.to }, new Date()), [night]);

  // Night theme preset
  useEffect(() => {
    if (!layout) return;
    const base = normalizeTheme(layout.theme);
    if (nightActive && night?.preset) {
      const p = THEME_PRESETS.find((x) => x.id === night.preset);
      if (p) {
        applyTheme({ ...stripPreset(p), showTitles: base.showTitles });
        return;
      }
    }
    applyTheme(base);
  }, [nightActive, night?.preset, layout]);

  const softwareDim = display && !display.hardware.backlight && display.brightness < 100 && display.on;
  return (
    <>
      {softwareDim && <div className="pointer-events-none fixed inset-0 z-[80] bg-black transition-opacity duration-1000" style={{ opacity: 1 - display!.brightness / 100 }} />}
      {display && !display.on && (
        <div className="fixed inset-0 z-[95] flex cursor-pointer items-end justify-center bg-black p-8" onClick={wakeDisplay} onTouchStart={wakeDisplay}>
          <span className="text-xs text-white/20">{t('display.off')}</span>
        </div>
      )}
    </>
  );
}
