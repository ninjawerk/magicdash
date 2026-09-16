import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';
import { fetchFeed, stripHtml } from '../../server/feeds';

export interface Word {
  word: string;
  partOfSpeech?: string;
  pronunciation?: string;
  definition: string;
  example?: string;
  date?: string;
  link?: string;
  source: string;
}

const POS = ['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'proper noun', 'phrase', 'idiom', 'numeral', 'determiner', 'particle'];
const POS_ABBR: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', interj: 'interjection', prep: 'preposition', conj: 'conjunction', pron: 'pronoun', num: 'numeral', det: 'determiner', 'proper n': 'proper noun' };

async function merriamWebster(): Promise<Word> {
  const { items } = await fetchFeed('https://www.merriam-webster.com/wotd/feed/rss2', 'Merriam-Webster');
  const it = items[0];
  if (!it) throw new Error('Empty feed');
  const word = it.title.trim();
  const html = it.html ?? '';
  // description: "<strong>word</strong> &#149; \pron\ &#149; <em>noun</em>" then definition paragraphs; shortdef via itunes:summary-ish text
  const flat = stripHtml(html);
  const pron = flat.match(/\\([^\\]+)\\/)?.[1]?.trim();
  const pos = POS.find((p) => new RegExp(`\\\\\\s*(?:•|&#149;|\\u0095|·)?\\s*${p}\\b`, 'i').test(flat) || new RegExp(`\\b${p}\\b`, 'i').test(flat.slice(0, 260)));
  // Definition: text after the part of speech up to "// " example or "Examples" / "Did you know"
  let definition = '';
  const afterPos = pos ? flat.slice(flat.toLowerCase().indexOf(pos.toLowerCase()) + pos.length) : flat;
  definition = afterPos.split(/\/\/|Examples?:|Did You Know\?|Did you know\?/i)[0].replace(/^[\s:.•-]+/, '').trim();
  const example = afterPos
    .match(/\/\/\s*([\s\S]*?)(?:Did You Know\?|See the entry|$)/i)?.[1]
    ?.split(/Examples?:|See the entry/i)[0]
    .split('//')[0]
    .trim()
    .slice(0, 240);
  return { word, partOfSpeech: pos, pronunciation: pron, definition: definition.slice(0, 400), example: example || undefined, date: it.date, link: it.link, source: 'Merriam-Webster' };
}

async function wiktionary(): Promise<Word> {
  const { items } = await fetchFeed('https://en.wiktionary.org/w/api.php?action=featuredfeed&feed=wotd&feedformat=atom', 'Wiktionary');
  const today = Date.now();
  const it = items.filter((i) => !i.date || new Date(i.date).getTime() <= today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0] ?? items[0];
  if (!it) throw new Error('Empty feed');
  const html = it.html ?? '';
  const word = stripHtml(html.match(/id="WOTD-rss-title"[^>]*>([\s\S]*?)<\/(?:span|a|b|strong)>/i)?.[1] ?? '') || it.title.replace(/^Word of the day for .*$/i, '').trim();
  const descHtml = html.match(/id="WOTD-rss-description"[^>]*>([\s\S]*)/i)?.[1] ?? html;
  const firstLi = descHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/i)?.[1];
  const definition = stripHtml(firstLi ?? descHtml).slice(0, 400);
  const flat = stripHtml(html);
  const afterWord = flat.slice(flat.indexOf(word) + word.length).trim();
  const abbr = afterWord.match(/^(proper n|n|v|adj|adv|interj|prep|conj|pron|num|det)\b/i)?.[1]?.toLowerCase();
  return {
    word,
    partOfSpeech: abbr ? POS_ABBR[abbr] : undefined,
    definition: definition.replace(/^\(([^)]*)\)\s*/, '($1) '),
    date: it.date,
    link: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
    source: 'Wiktionary',
  };
}

export default defineServerPlugin((ctx) => {
  ctx.router.get(
    '/word',
    asyncHandler(async (req, res) => {
      const source = req.query.source === 'wiktionary' ? 'wiktionary' : 'merriam-webster';
      const word = await ctx.cache.wrap(`wotd:${source}`, 60 * 60_000, () => (source === 'wiktionary' ? wiktionary() : merriamWebster()));
      res.json(word);
    }),
  );
});
