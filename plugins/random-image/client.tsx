import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { definePlugin, usePluginQuery, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config {
  source?: 'picsum' | 'folder' | 'urls';
  urls?: string[];
  subfolder?: string;
  intervalSec?: number;
  fit?: 'cover' | 'contain';
  kenBurns?: boolean;
  shuffle?: boolean;
  caption?: boolean;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function RandomImageWidget({ config, api, size, instanceId }: WidgetProps<Config>) {
  const source = config.source ?? 'picsum';
  const interval = Math.max(3, config.intervalSec ?? 60) * 1000;
  const files = usePluginQuery<string[]>(api, '/list', {
    enabled: source === 'folder',
    query: { filter: config.subfolder || undefined },
    refreshMs: 10 * 60 * 1000,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), interval);
    return () => clearInterval(id);
  }, [interval]);

  const list = useMemo(() => {
    let items: Array<{ src: string; caption?: string }> = [];
    if (source === 'urls') items = (config.urls ?? []).filter(Boolean).map((u) => ({ src: u }));
    if (source === 'folder') items = (files.data ?? []).map((p) => ({ src: api.url('/file', { p }), caption: p }));
    return config.shuffle === false ? items : shuffled(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, config.urls, files.data, config.shuffle]);

  let src: string | undefined;
  let caption: string | undefined;
  if (source === 'picsum') {
    // Ask for roughly the tile's size in device pixels; seed changes each tick so the browser can't cache it.
    const w = Math.max(200, Math.round(size.width * (window.devicePixelRatio || 1)));
    const h = Math.max(200, Math.round(size.height * (window.devicePixelRatio || 1)));
    src = `https://picsum.photos/seed/${instanceId}-${tick}/${w}/${h}`;
  } else if (list.length) {
    const item = list[tick % list.length];
    src = item.src;
    caption = item.caption;
  }

  const [loaded, setLoaded] = useState<string>();
  const [failed, setFailed] = useState<string>();

  if (!src) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-white/40 p-4 text-center">
        <ImageOff />
        <p className="text-sm">
          {source === 'folder' ? files.error ?? (files.loading ? 'Scanning folder…' : 'No images found in the folder.') : 'Add some image URLs in this tile’s settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/40 overflow-hidden">
      <img
        key={src}
        src={src}
        alt=""
        onLoad={() => setLoaded(src)}
        onError={() => setFailed(src)}
        className={`absolute inset-0 h-full w-full ${config.fit === 'contain' ? 'object-contain' : 'object-cover'} ${loaded === src ? 'fade-in' : 'opacity-0'} ${
          config.kenBurns !== false && config.fit !== 'contain' ? 'ken-burns' : ''
        }`}
        draggable={false}
      />
      {failed === src && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
          <ImageOff className="mr-2" size={16} /> Couldn’t load image
        </div>
      )}
      {config.caption && caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-xs text-white/80 truncate">{caption}</div>
      )}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: RandomImageWidget });
