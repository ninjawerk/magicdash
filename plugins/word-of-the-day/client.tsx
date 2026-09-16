import { BookOpen } from 'lucide-react';
import { definePlugin, usePluginQuery, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';
import type { Word } from './server';

interface Config {
  source?: 'merriam-webster' | 'wiktionary';
  showPronunciation?: boolean;
  showSource?: boolean;
  align?: 'left' | 'center';
}

function WordWidget({ config, api, size }: WidgetProps<Config>) {
  const q = usePluginQuery<Word>(api, '/word', { query: { source: config.source ?? 'merriam-webster' }, refreshMs: 60 * 60_000 });
  const center = config.align === 'center';
  if (q.error && !q.data) return <p className="p-5 text-sm text-red-200">{q.error}</p>;
  if (!q.data) return <p className="p-5 text-sm text-white/40">Looking up today’s word…</p>;
  const w = q.data;
  const wordSize = Math.max(22, Math.min(56, size.width / Math.max(6, w.word.length * 0.62)));
  const defSize = Math.max(12, Math.min(18, size.height / 9));
  return (
    <div key={w.word} className={`fade-in flex h-full flex-col justify-center px-5 pb-4 ${center ? 'items-center text-center' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-bold leading-none tracking-tight" style={{ fontSize: wordSize }}>
          {w.word}
        </span>
        {w.partOfSpeech && <span className="text-sm italic text-[var(--accent)]">{w.partOfSpeech}</span>}
        {config.showPronunciation !== false && w.pronunciation && <span className="font-mono text-sm text-white/50">\{w.pronunciation}\</span>}
      </div>
      <p className={`mt-2 leading-snug text-white/80 ${size.height > 260 ? 'line-clamp-5' : 'line-clamp-3'}`} style={{ fontSize: defSize }}>
        {w.definition}
      </p>
      {w.example && size.height > 260 && <p className="mt-2 line-clamp-2 text-sm italic text-white/45">“{w.example}”</p>}
      {config.showSource !== false && (
        <div className="mt-auto pt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/35">
          <BookOpen size={11} /> {w.source}
        </div>
      )}
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: WordWidget });
