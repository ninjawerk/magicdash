import { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, Trash2 } from 'lucide-react';
import { hostApi } from '../../lib/api';
import { subscribeEvents } from '@sdk/client';

type Entry = { seq: number; ts: string; level: string; msg: string };
const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const COLOR: Record<string, string> = { debug: 'text-white/40', info: 'text-white/80', warn: 'text-amber-300', error: 'text-red-300' };

export function LogsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('info');
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hostApi
      .logs(0, 'debug', 1000)
      .then((r) => setEntries(r.entries))
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(
    () =>
      subscribeEvents((ev) => {
        if (ev.plugin === '$host' && ev.event === 'log' && !paused) setEntries((l) => [...l.slice(-1499), ev.payload as Entry]);
      }),
    [paused],
  );
  useEffect(() => {
    if (!paused) bottom.current?.scrollIntoView({ block: 'end' });
  }, [entries, paused]);

  const minIdx = LEVELS.indexOf(level);
  const q = filter.toLowerCase();
  const shown = entries.filter((e) => LEVELS.indexOf(e.level as never) >= minIdx && (!q || e.msg.toLowerCase().includes(q)));

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-white/5 p-1">
          {LEVELS.map((l) => (
            <button key={l} className={`rounded-md px-3 py-1 text-xs font-medium ${level === l ? 'bg-[var(--accent)] text-[#0b0f17]' : 'text-white/60 hover:text-white'}`} onClick={() => setLevel(l)}>
              {l}+
            </button>
          ))}
        </div>
        <input className="input max-w-xs" placeholder="Filter… e.g. [home-assistant]" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="text-xs text-white/40">{shown.length} lines</span>
        <span className="ml-auto flex gap-1">
          <button className="btn btn-ghost" onClick={() => setPaused((p) => !p)} title={paused ? 'Resume' : 'Pause auto-scroll'}>
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-ghost" onClick={() => setEntries([])} title="Clear view">
            <Trash2 size={14} />
          </button>
          <a className="btn btn-default" href="/api/logs/download" download>
            <Download size={14} /> Download
          </a>
        </span>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-[12px] leading-relaxed">
        {shown.map((e) => (
          <div key={e.seq} className="flex gap-3 whitespace-pre-wrap break-words">
            <span className="shrink-0 text-white/30">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
            <span className={`w-12 shrink-0 uppercase ${COLOR[e.level] ?? ''}`}>{e.level}</span>
            <span className={COLOR[e.level] ?? ''}>{e.msg}</span>
          </div>
        ))}
        {shown.length === 0 && <p className="text-white/30">Nothing at this level yet.</p>}
        <div ref={bottom} />
      </div>
      <p className="text-[11px] text-white/35">The last 1000 lines the server printed (plugins included) are kept in memory. For everything since boot on a Pi: <span className="font-mono">journalctl -u magicdash</span>.</p>
    </div>
  );
}
