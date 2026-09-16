import { promises as fs } from 'node:fs';
import ical, { type VEvent } from 'node-ical';
import type { CalEvent } from './shared';

export interface IcsFeed {
  id: string;
  name: string;
  url: string;
  color?: string;
}

const PALETTE = ['#f28b82', '#fbbc04', '#33b679', '#8ab4f8', '#ff8bc7', '#a7ffeb', '#e6c9a8', '#c58af9'];

/** Parse settings lines like "Work | https://…/basic.ics" or a bare URL / path. */
export function parseFeeds(lines: string[] | undefined): IcsFeed[] {
  const out: IcsFeed[] = [];
  for (const raw of lines ?? []) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|').map((s) => s.trim());
    const url = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const name = parts.length > 1 ? parts.slice(0, -1).join(' | ') : hostnameOf(url);
    const id = `ics:${out.length}`;
    out.push({ id, name, url, color: PALETTE[out.length % PALETTE.length] });
  }
  return out;
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split('/').pop() || 'Calendar';
  }
}

async function loadIcs(url: string): Promise<Record<string, unknown>> {
  if (/^https?:\/\//i.test(url)) {
    const r = await fetch(url.replace(/^webcal:/i, 'https:'), { headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8' } });
    if (!r.ok) throw new Error(`Feed ${hostnameOf(url)} returned ${r.status}`);
    return ical.async.parseICS(await r.text());
  }
  if (/^webcal:\/\//i.test(url)) return loadIcs(url.replace(/^webcal:/i, 'https:'));
  // Local file path
  return ical.async.parseICS(await fs.readFile(url, 'utf8'));
}

export async function fetchIcsEvents(feed: IcsFeed, from: Date, to: Date): Promise<CalEvent[]> {
  const data = await loadIcs(feed.url);
  const out: CalEvent[] = [];
  for (const item of Object.values(data)) {
    const ev = item as VEvent;
    if (ev?.type !== 'VEVENT' || !ev.start) continue;
    if (String(ev.status ?? '').toUpperCase() === 'CANCELLED') continue;
    const instances = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true });
    for (const inst of instances) {
      const allDay = inst.isFullDay || ev.datetype === 'date';
      const start = new Date(inst.start);
      let end = inst.end ? new Date(inst.end) : new Date(start.getTime() + (allDay ? 86_400_000 : 3_600_000));
      if (allDay) {
        // Normalise to local midnight boundaries so "today" logic matches Google events.
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        if (e <= s) e.setDate(s.getDate() + 1);
        out.push(mk(feed, ev, inst.summary ?? ev.summary, s, e, true, inst.start.getTime()));
        continue;
      }
      if (end <= start) end = new Date(start.getTime() + 3_600_000);
      out.push(mk(feed, ev, inst.summary ?? ev.summary, start, end, false, inst.start.getTime()));
    }
  }
  return out;
}

function mk(feed: IcsFeed, ev: VEvent, summary: unknown, start: Date, end: Date, allDay: boolean, key: number): CalEvent {
  const text = (v: unknown) => (typeof v === 'string' ? v : v && typeof v === 'object' && 'val' in (v as object) ? String((v as { val: unknown }).val) : undefined);
  return {
    id: `${feed.id}:${ev.uid}:${key}`,
    title: text(summary) ?? '(no title)',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    location: text(ev.location),
    description: text(ev.description),
    calendarId: feed.id,
    calendarName: feed.name,
    color: feed.color,
    status: typeof ev.status === 'string' ? ev.status.toLowerCase() : undefined,
    htmlLink: text(ev.url),
  };
}
