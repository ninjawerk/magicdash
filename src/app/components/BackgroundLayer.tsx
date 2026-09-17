import { useMemo } from 'react';
import { normalizeTheme, wallpaperUrl } from '../lib/themes';
import { useStore } from '../lib/store';

/**
 * Draws the wallpaper, its readability scrim and the decorative effect under the tiles.
 * The base colour/gradient itself is on <body> (see applyTheme) so it also shows behind dialogs.
 */
export function BackgroundLayer() {
  const { layout } = useStore();
  const t = normalizeTheme(layout?.theme);
  const url = wallpaperUrl(t);
  const effect = t.backgroundEffect ?? 'none';
  const overlay = Math.max(0, Math.min(95, t.backgroundOverlay ?? 0));
  const blur = Math.max(0, t.backgroundBlur ?? 0);
  const fit = t.backgroundFit ?? 'cover';
  const wallpaperStyle = useMemo(
    () =>
      url
        ? {
            backgroundImage: `url("${url.replace(/"/g, '%22')}")`,
            backgroundSize: fit === 'tile' ? 'auto' : fit,
            backgroundRepeat: fit === 'tile' ? 'repeat' : 'no-repeat',
            filter: blur ? `blur(${blur}px)` : undefined,
            // Blurred edges bleed transparent; overscan so they stay off-screen.
            inset: blur ? `-${blur * 2}px` : 0,
          }
        : undefined,
    [url, fit, blur],
  );
  const spans = effect === 'aurora' ? 3 : effect === 'bokeh' ? 5 : 0;
  return (
    <div className="bg-layer" aria-hidden>
      {wallpaperStyle && <div className="bg-wallpaper" style={wallpaperStyle} />}
      {url && overlay > 0 && <div className="bg-scrim" style={{ background: t.dark ? `rgba(0,0,0,${overlay / 100})` : `rgba(255,255,255,${overlay / 100})` }} />}
      {effect !== 'none' && (
        <div className={`bg-effect bg-effect-${effect}`}>
          {Array.from({ length: spans }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
