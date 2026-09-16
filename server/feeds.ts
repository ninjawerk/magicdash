/** Shared RSS/Atom fetching + parsing for plugins (news, word of the day...). */
import { XMLParser } from 'fast-xml-parser';

export interface FeedItem {
  title: string;
  link?: string;
  /** ISO date */
  date?: string;
  summary?: string;
  /** Raw HTML content when present */
  html?: string;
  image?: string;
  source: string;
}

const UA = 'MagicDash/0.1 (kiosk dashboard RSS reader)';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '#cdata', textNodeName: '#text', trimValues: true });

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  const o = v as Record<string, unknown>;
  return text(o['#cdata'] ?? o['#text'] ?? '');
}
function attr(v: unknown, name: string): string | undefined {
  if (!v) return undefined;
  const o = (Array.isArray(v) ? v[0] : v) as Record<string, unknown>;
  const a = o?.[`@_${name}`];
  return typeof a === 'string' ? a : undefined;
}
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}
function firstImg(html: string): string | undefined {
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
}
function toIso(d: string | undefined): string | undefined {
  if (!d) return undefined;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export async function fetchFeed(url: string, sourceName?: string): Promise<{ title: string; items: FeedItem[] }> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' } });
  if (!r.ok) throw new Error(`${new URL(url).hostname} responded ${r.status}`);
  const xml = await r.text();
  const doc = parser.parse(xml) as Record<string, unknown>;

  // RSS 2.0
  const rss = doc.rss as Record<string, unknown> | undefined;
  if (rss?.channel) {
    const ch = rss.channel as Record<string, unknown>;
    const title = sourceName ?? (stripHtml(text(ch.title)) || new URL(url).hostname);
    const raw = ch.item ? (Array.isArray(ch.item) ? ch.item : [ch.item]) : [];
    const items = (raw as Record<string, unknown>[]).map<FeedItem>((it) => {
      const html = text(it['content:encoded']) || text(it.description);
      const image =
        attr(it['media:thumbnail'], 'url') ?? attr(it['media:content'], 'url') ?? attr(it.enclosure, 'url')?.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)?.input ?? firstImg(html);
      return {
        title: stripHtml(text(it.title)),
        link: text(it.link) || attr(it.link, 'href'),
        date: toIso(text(it.pubDate) || text(it['dc:date'])),
        summary: stripHtml(text(it.description)),
        html,
        image,
        source: title,
      };
    });
    return { title, items };
  }

  // Atom
  const feed = doc.feed as Record<string, unknown> | undefined;
  if (feed) {
    const title = sourceName ?? (stripHtml(text(feed.title)) || new URL(url).hostname);
    const raw = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
    const items = (raw as Record<string, unknown>[]).map<FeedItem>((e) => {
      const links = e.link ? (Array.isArray(e.link) ? e.link : [e.link]) : [];
      const alt = (links as Record<string, unknown>[]).find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
      const html = text(e.content) || text(e.summary);
      return {
        title: stripHtml(text(e.title)),
        link: attr(alt, 'href'),
        date: toIso(text(e.updated) || text(e.published)),
        summary: stripHtml(text(e.summary) || html).slice(0, 500),
        html,
        image: attr(e['media:thumbnail'], 'url') ?? firstImg(html),
        source: title,
      };
    });
    return { title, items };
  }
  throw new Error('Not an RSS or Atom feed');
}
