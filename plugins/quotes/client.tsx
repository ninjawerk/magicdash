import { useMemo } from 'react';
import { Quote as QuoteIcon } from 'lucide-react';
import { definePlugin, usePluginQuery, useRotation, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';
import { BUNDLED_QUOTES, parseQuoteLine, type Quote } from './quotes';

interface Config {
  source?: 'bundled' | 'custom' | 'zenquotes';
  custom?: string[];
  intervalMin?: number;
  align?: 'left' | 'center';
}

function QuotesWidget({ config, api, size }: WidgetProps<Config>) {
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

export default definePlugin<Config>({ manifest, Widget: QuotesWidget });
