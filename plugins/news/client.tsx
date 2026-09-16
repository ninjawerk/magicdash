import { useEffect, useMemo } from 'react';
import { Newspaper } from 'lucide-react';
import { definePlugin, formatDuration, useNow, usePluginQuery, useRotation, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Item {
  title: string;
  link?: string;
  date?: string;
  summary?: string;
  image?: string;
  source: string;
}
interface Config {
  feeds?: string[];
  layout?: 'headline' | 'list';
  intervalSec?: number;
  showImage?: boolean;
  showSummary?: boolean;
  maxAgeHours?: number;
}

function ago(iso: string | undefined, now: Date) {
  if (!iso) return '';
  const ms = now.getTime() - new Date(iso).getTime();
  return ms < 60_000 ? 'just now' : `${formatDuration(ms)} ago`;
}

function NewsWidget({ config, api, size, setBackground, editMode, openSettings }: WidgetProps<Config>) {
  const feeds = (config.feeds ?? []).filter(Boolean);
  const q = usePluginQuery<{ items: Item[]; errors: string[] }>(api, '/items', {
    enabled: feeds.length > 0,
    query: { feeds: JSON.stringify(feeds), maxAgeHours: config.maxAgeHours ?? 48, limit: 40 },
    refreshMs: 10 * 60_000,
  });
  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const now = useNow(30_000);
  const [index] = useRotation(items.length, Math.max(3, config.intervalSec ?? 12) * 1000);
  const layout = config.layout ?? 'headline';
  const current = items[index];

  useEffect(() => {
    if (layout === 'headline' && config.showImage !== false && current?.image) {
      setBackground(`linear-gradient(180deg, color-mix(in srgb, var(--surface) 55%, transparent) 0%, color-mix(in srgb, var(--surface) 88%, transparent) 100%), url("${current.image}") center / cover no-repeat`);
    } else setBackground(undefined);
    return () => setBackground(undefined);
  }, [layout, config.showImage, current?.image, setBackground]);

  if (feeds.length === 0) {
    return (
      <Center onClick={editMode ? openSettings : undefined}>
        <Newspaper className="text-white/40" />
        <p className="text-sm text-white/60">Add a feed URL in this tile’s settings.</p>
      </Center>
    );
  }
  if (q.error && !q.data) return <Center><p className="text-sm text-red-200">{q.error}</p></Center>;
  if (!q.data) return <Center><p className="text-sm text-white/40">Loading headlines…</p></Center>;
  if (items.length === 0) return <Center><p className="text-sm text-white/40">No recent items.</p></Center>;

  if (layout === 'list') {
    const rows = Math.max(1, Math.floor((size.height - 12) / 44));
    return (
      <div className="flex h-full flex-col px-5 pb-3 overflow-hidden">
        {items.slice(0, rows).map((it, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-white/5 py-2 last:border-0" style={{ minHeight: 44 }}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-snug">{it.title}</span>
              <span className="block text-[11px] text-white/40 truncate">
                {it.source}
                {it.date ? ` · ${ago(it.date, now)}` : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  const fontSize = Math.max(16, Math.min(34, Math.sqrt((size.width * Math.max(60, size.height - 60) * 0.5) / Math.max(30, current.title.length * 0.5 * 1.25))));
  return (
    <div key={index} className="fade-in relative flex h-full flex-col justify-end px-5 pb-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
        <Newspaper size={12} className="text-[var(--accent)]" /> {current.source}
        {current.date && <span className="font-medium normal-case tracking-normal text-white/40">· {ago(current.date, now)}</span>}
        <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-white/30">
          {index + 1}/{items.length}
        </span>
      </div>
      <h3 className="font-bold leading-tight tracking-tight line-clamp-3" style={{ fontSize }}>
        {current.title}
      </h3>
      {config.showSummary !== false && current.summary && size.height > 140 && (
        <p className="mt-2 line-clamp-2 text-sm text-white/60">{current.summary}</p>
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

export default definePlugin<Config>({ manifest, Widget: NewsWidget });
