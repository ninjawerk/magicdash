/**
 * Image providers that accept a subject. Server-side only (some need keys, all need caching).
 * Each returns a list of images the widget can rotate through.
 */
export interface ProviderImage {
  src: string;
  caption?: string;
  link?: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  needsKey?: 'unsplashKey' | 'pexelsKey' | 'pixabayKey';
  defaultSubject: string;
  description: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'picsum', label: 'Lorem Picsum — random photos (no subject)', defaultSubject: '', description: 'Random photos, no key.' },
  { id: 'loremflickr', label: 'LoremFlickr — Flickr photos by keyword', defaultSubject: 'nature', description: 'No key. Keywords, comma-separated.' },
  { id: 'wikimedia', label: 'Wikimedia Commons — by subject', defaultSubject: 'landscape', description: 'No key. Free-licence photos and art.' },
  { id: 'nasa', label: 'NASA image library — by subject', defaultSubject: 'nebula', description: 'No key. Space imagery.' },
  { id: 'cleveland', label: 'Cleveland Museum of Art — artworks by subject', defaultSubject: 'landscape', description: 'No key. CC0 artworks with great search.' },
  { id: 'unsplash', label: 'Unsplash — by subject (free API key)', needsKey: 'unsplashKey', defaultSubject: 'nature', description: 'Needs a free Unsplash key.' },
  { id: 'pexels', label: 'Pexels — by subject (free API key)', needsKey: 'pexelsKey', defaultSubject: 'nature', description: 'Needs a free Pexels key.' },
  { id: 'pixabay', label: 'Pixabay — by subject (free API key)', needsKey: 'pixabayKey', defaultSubject: 'nature', description: 'Needs a free Pixabay key.' },
];

const UA = 'MagicDash/0.1 (kiosk dashboard; +https://github.com/magicdash)';

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers } });
  if (!r.ok) throw new Error(`${new URL(url).hostname} responded ${r.status}`);
  return r.json() as Promise<T>;
}

export async function fetchImages(
  provider: string,
  subject: string,
  count: number,
  keys: { unsplashKey?: string; pexelsKey?: string; pixabayKey?: string },
  size: { w: number; h: number },
): Promise<ProviderImage[]> {
  const info = PROVIDERS.find((p) => p.id === provider);
  if (!info) throw new Error(`Unknown provider "${provider}"`);
  const q = (subject || info.defaultSubject).trim();
  const n = Math.max(1, Math.min(50, count));

  switch (provider) {
    case 'picsum':
      return Array.from({ length: n }, (_, i) => ({ src: `https://picsum.photos/seed/md-${Date.now()}-${i}/${size.w}/${size.h}` }));

    case 'loremflickr': {
      const kw = encodeURIComponent(q.split(/[\s,]+/).filter(Boolean).join(','));
      return Array.from({ length: n }, (_, i) => ({ src: `https://loremflickr.com/${size.w}/${size.h}/${kw}?lock=${Math.floor(Math.random() * 100000) + i}`, caption: q }));
    }

    case 'wikimedia': {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: `filetype:bitmap ${q}`,
        gsrnamespace: '6',
        gsrlimit: String(n),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: String(size.w),
        format: 'json',
      });
      const data = await getJson<{ query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; url: string; descriptionurl?: string; extmetadata?: { ImageDescription?: { value: string }; Artist?: { value: string } } }> }> } }>(
        `https://commons.wikimedia.org/w/api.php?${params}`,
      );
      return Object.values(data.query?.pages ?? {})
        .map((p) => {
          const ii = p.imageinfo?.[0];
          if (!ii) return undefined;
          const title = p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
          return { src: ii.thumburl ?? ii.url, caption: title, link: ii.descriptionurl } as ProviderImage;
        })
        .filter((x): x is ProviderImage => !!x);
    }

    case 'nasa': {
      const data = await getJson<{ collection: { items: Array<{ href: string; data: Array<{ title: string; nasa_id: string }>; links?: Array<{ href: string }> }> } }>(
        `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=${Math.min(n, 25)}`,
      );
      // Each item lists its available renditions; pick a web-sized one (orig can be tens of MB).
      const items = await Promise.all(
        data.collection.items.map(async (it) => {
          const thumb = it.links?.[0]?.href;
          let src = thumb;
          try {
            const files = await getJson<string[]>(it.href);
            const pick = (suffix: string) => files.find((f) => f.toLowerCase().includes(`~${suffix}.`));
            src = (pick('large') ?? pick('medium') ?? pick('small') ?? thumb)?.replace(/^http:/, 'https:');
          } catch {
            /* keep thumb */
          }
          return src ? ({ src, caption: it.data?.[0]?.title, link: `https://images.nasa.gov/details/${it.data?.[0]?.nasa_id}` } as ProviderImage) : undefined;
        }),
      );
      return items.filter((x): x is ProviderImage => !!x);
    }

    case 'cleveland': {
      const params = new URLSearchParams({ q, has_image: '1', cc0: '1', limit: String(n) });
      const data = await getJson<{ data: Array<{ id: number; title: string; url: string; creators?: Array<{ description?: string }>; images?: { web?: { url: string }; print?: { url: string } } }> }>(
        `https://openaccess-api.clevelandart.org/api/artworks/?${params}`,
      );
      return data.data
        .map((a) => {
          const src = size.w > 1200 ? a.images?.print?.url ?? a.images?.web?.url : a.images?.web?.url;
          if (!src) return undefined;
          const artist = a.creators?.[0]?.description?.replace(/\s*\(.*$/, '');
          return { src, caption: artist ? `${a.title} — ${artist}` : a.title, link: a.url } as ProviderImage;
        })
        .filter((x): x is ProviderImage => !!x);
    }

    case 'unsplash': {
      if (!keys.unsplashKey) throw new Error('Add an Unsplash API key in the Random image plugin settings.');
      const data = await getJson<Array<{ urls: { regular: string; raw: string }; user: { name: string }; links: { html: string }; alt_description?: string }>>(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&count=${Math.min(n, 30)}&orientation=${size.w >= size.h ? 'landscape' : 'portrait'}`,
        { authorization: `Client-ID ${keys.unsplashKey}` },
      );
      return data.map((p) => ({ src: `${p.urls.raw}&w=${size.w}&q=80&fit=max`, caption: `${p.alt_description ?? ''} — ${p.user.name} / Unsplash`.replace(/^ — /, ''), link: p.links.html }));
    }

    case 'pexels': {
      if (!keys.pexelsKey) throw new Error('Add a Pexels API key in the Random image plugin settings.');
      const data = await getJson<{ photos: Array<{ src: { large2x: string }; photographer: string; url: string; alt?: string }> }>(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${Math.min(n, 80)}&orientation=${size.w >= size.h ? 'landscape' : 'portrait'}`,
        { authorization: keys.pexelsKey },
      );
      return data.photos.map((p) => ({ src: p.src.large2x, caption: `${p.alt ?? ''} — ${p.photographer} / Pexels`.replace(/^ — /, ''), link: p.url }));
    }

    case 'pixabay': {
      if (!keys.pixabayKey) throw new Error('Add a Pixabay API key in the Random image plugin settings.');
      const data = await getJson<{ hits: Array<{ largeImageURL: string; user: string; pageURL: string; tags: string }> }>(
        `https://pixabay.com/api/?key=${encodeURIComponent(keys.pixabayKey)}&q=${encodeURIComponent(q)}&image_type=photo&per_page=${Math.max(3, Math.min(n, 200))}&orientation=${size.w >= size.h ? 'horizontal' : 'vertical'}&safesearch=true`,
      );
      return data.hits.map((h) => ({ src: h.largeImageURL, caption: `${h.tags} — ${h.user} / Pixabay`, link: h.pageURL }));
    }
  }
  return [];
}
