import { useMemo } from 'react';
import QRCode from 'qrcode';
import { QrCode, Wifi } from 'lucide-react';
import { definePlugin, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config {
  mode?: 'wifi' | 'url' | 'text';
  ssid?: string;
  password?: string;
  security?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
  url?: string;
  text?: string;
  label?: string;
  showDetails?: boolean;
}

/** Escape per the Wi-Fi QR spec: \ ; , " : */
const esc = (s: string) => s.replace(/([\;,":])/g, '\\$1');

function payload(c: Config): string {
  switch (c.mode ?? 'wifi') {
    case 'wifi': {
      if (!c.ssid) return '';
      const sec = c.security ?? 'WPA';
      return `WIFI:T:${sec};S:${esc(c.ssid)};${sec !== 'nopass' && c.password ? `P:${esc(c.password)};` : ''}${c.hidden ? 'H:true;' : ''};`;
    }
    case 'url':
      return c.url?.trim() ?? '';
    default:
      return c.text?.trim() ?? '';
  }
}

/** Render a QR as a single SVG path so it scales crisply. */
function QrSvg({ text, size }: { text: string; size: number }) {
  const { path, n } = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const data = qr.modules.data as Uint8Array;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
    return { path: d, n };
  }, [text]);
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR code">
      <rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#ffffff" />
      <path d={path} fill="#111318" />
    </svg>
  );
}

function QrWidget({ config, size, editMode, openSettings }: WidgetProps<Config>) {
  const text = payload(config);
  const mode = config.mode ?? 'wifi';
  const showDetails = config.showDetails !== false;
  if (!text) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-2 p-4 text-center ${editMode ? 'cursor-pointer' : ''}`} onClick={editMode ? openSettings : undefined}>
        <QrCode className="text-white/40" />
        <p className="text-sm text-white/60">{mode === 'wifi' ? 'Enter your Wi-Fi name and password in this tile’s settings.' : 'Enter something to encode in this tile’s settings.'}</p>
      </div>
    );
  }
  const wide = size.width > size.height * 1.4;
  const detailsH = showDetails ? (wide ? 0 : 44) : 0;
  const labelH = config.label ? 22 : 0;
  const qrSize = Math.max(64, Math.min(wide ? size.height - 24 - labelH : size.width - 40, size.height - 24 - detailsH - labelH));
  const details =
    mode === 'wifi' ? (
      <>
        <span className="flex items-center gap-1.5 font-semibold">
          <Wifi size={14} className="text-[var(--accent)]" /> {config.ssid}
        </span>
        {config.security !== 'nopass' && config.password && <span className="font-mono text-white/60">{config.password}</span>}
      </>
    ) : (
      <span className="truncate text-white/60">{text}</span>
    );
  return (
    <div className={`flex h-full items-center justify-center gap-4 px-4 pb-3 ${wide ? 'flex-row' : 'flex-col'}`}>
      <div className="rounded-xl bg-white p-2 shadow-lg" style={{ lineHeight: 0 }}>
        <QrSvg text={text} size={qrSize - 16} />
      </div>
      {(config.label || showDetails) && (
        <div className={`flex min-w-0 flex-col gap-0.5 text-sm ${wide ? 'items-start text-left' : 'items-center text-center'}`}>
          {config.label && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{config.label}</span>}
          {showDetails && details}
        </div>
      )}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: QrWidget });
