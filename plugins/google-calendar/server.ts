import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';
import type { CalEvent, Status } from './shared';
import { fetchIcsEvents, parseFeeds } from './ics';

interface Settings {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  icsFeeds?: string[];
}
interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  email?: string;
}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/userinfo.email'];

export default defineServerPlugin<Settings>((ctx) => {
  const tokenFile = path.join(ctx.dataDir, 'tokens.json');
  let tokens: Tokens | undefined;
  let lastError: string | undefined;

  const loadTokens = async () => {
    try {
      tokens = JSON.parse(await fs.readFile(tokenFile, 'utf8')) as Tokens;
    } catch {
      tokens = undefined;
    }
  };
  const saveTokens = async (t: Tokens | undefined) => {
    tokens = t;
    if (t) await fs.writeFile(tokenFile, JSON.stringify(t, null, 2), { mode: 0o600 });
    else await fs.rm(tokenFile, { force: true });
  };
  void loadTokens();

  const redirectUri = (req: Request) => {
    const override = ctx.settings.get().redirectUri?.trim();
    if (override) return override;
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host');
    return `${proto}://${host}/api/plugins/${ctx.manifest.id}/auth/callback`;
  };

  const configured = () => {
    const s = ctx.settings.get();
    return !!(s.clientId && s.clientSecret);
  };

  async function refreshIfNeeded(): Promise<string> {
    if (!tokens) throw new Error('Google account not connected');
    if (tokens.expires_at - Date.now() > 60_000) return tokens.access_token;
    const s = ctx.settings.get();
    const body = new URLSearchParams({
      client_id: s.clientId!,
      client_secret: s.clientSecret!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
    const data = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!r.ok || !data.access_token) {
      lastError = data.error_description ?? data.error ?? `Token refresh failed (${r.status})`;
      if (data.error === 'invalid_grant') await saveTokens(undefined); // revoked — force reconnect
      throw new Error(lastError);
    }
    await saveTokens({ ...tokens, access_token: data.access_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 });
    lastError = undefined;
    return data.access_token;
  }

  async function gapi<T>(url: string): Promise<T> {
    const token = await refreshIfNeeded();
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Google API ${r.status}: ${text.slice(0, 200)}`);
    }
    return r.json() as Promise<T>;
  }

  const feeds = () => parseFeeds(ctx.settings.get().icsFeeds);
  ctx.settings.onChange(() => {
    ctx.cache.delete('calendars');
    ctx.emit('settings');
  });

  // --- Status -----------------------------------------------------------------
  ctx.router.get('/status', (req, res) => {
    const st: Status = {
      configured: configured(),
      connected: !!tokens,
      icsCount: feeds().length,
      email: tokens?.email,
      redirectUri: redirectUri(req),
      error: lastError,
    };
    res.json(st);
  });

  // --- OAuth -------------------------------------------------------------------
  ctx.router.post('/auth/start', (req, res) => {
    const s = ctx.settings.get();
    if (!configured()) {
      res.status(400).json({ error: 'Save your Client ID and Client Secret first.' });
      return;
    }
    const params = new URLSearchParams({
      client_id: s.clientId!,
      redirect_uri: redirectUri(req),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    res.json({ redirect: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  ctx.router.get(
    '/auth/callback',
    asyncHandler(async (req, res) => {
      const code = String(req.query.code ?? '');
      const err = req.query.error;
      if (err || !code) {
        res.status(400).send(`<h2>Google sign-in failed</h2><p>${String(err ?? 'no code')}</p><a href="/">Back</a>`);
        return;
      }
      const s = ctx.settings.get();
      const body = new URLSearchParams({
        code,
        client_id: s.clientId!,
        client_secret: s.clientSecret!,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      });
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
      const data = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
      if (!r.ok || !data.access_token || !data.refresh_token) {
        res.status(400).send(`<h2>Token exchange failed</h2><pre>${data.error_description ?? JSON.stringify(data)}</pre><a href="/">Back</a>`);
        return;
      }
      let email: string | undefined;
      try {
        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${data.access_token}` } });
        email = ((await info.json()) as { email?: string }).email;
      } catch {
        /* optional */
      }
      await saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000, email });
      lastError = undefined;
      ctx.cache.delete('calendars');
      ctx.emit('connected', { email });
      res.redirect('/?connected=google-calendar');
    }),
  );

  ctx.router.post(
    '/auth/disconnect',
    asyncHandler(async (_req, res) => {
      if (tokens) {
        fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refresh_token)}`, { method: 'POST' }).catch(() => {});
      }
      await saveTokens(undefined);
      ctx.cache.delete('calendars');
      ctx.emit('disconnected');
      res.json({ ok: true, message: 'Disconnected' });
    }),
  );

  // --- Data --------------------------------------------------------------------
  interface GCalList {
    items: Array<{ id: string; summary: string; summaryOverride?: string; primary?: boolean; backgroundColor?: string; accessRole: string; selected?: boolean }>;
  }
  const calendarList = () =>
    ctx.cache.wrap('calendars', 10 * 60_000, () => gapi<GCalList>('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250'));

  ctx.router.get(
    '/calendars',
    asyncHandler(async (_req, res) => {
      const ics = feeds().map((f) => ({ value: f.id, label: f.name, description: 'ICS feed', group: 'Feeds' }));
      if (!tokens) {
        if (ics.length === 0) {
          res.status(400).json({ error: 'Connect your Google account or add an ICS feed in the plugin settings first.' });
          return;
        }
        res.json(ics);
        return;
      }
      const list = await calendarList();
      const google = list.items
        .sort((a, b) => Number(!!b.primary) - Number(!!a.primary) || a.summary.localeCompare(b.summary))
        .map((c) => ({ value: c.id, label: c.summaryOverride ?? c.summary, description: c.primary ? 'Primary' : c.accessRole, group: ics.length ? 'Google' : undefined }));
      res.json([...google, ...ics]);
    }),
  );

  interface GEvent {
    id: string;
    status?: string;
    summary?: string;
    location?: string;
    description?: string;
    htmlLink?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
  }
  interface GEvents {
    items: GEvent[];
  }

  /** GET /events?calendars=a,b&days=2 */
  ctx.router.get(
    '/events',
    asyncHandler(async (req, res) => {
      const allFeeds = feeds();
      if (!tokens && allFeeds.length === 0) {
        res.status(400).json({ error: 'Google account not connected' });
        return;
      }
      const days = Math.min(14, Math.max(1, Number(req.query.days ?? 2)));
      let ids = String(req.query.calendars ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // Nothing selected → primary Google calendar (if connected) + every ICS feed.
      if (ids.length === 0) ids = [...(tokens ? ['primary'] : []), ...allFeeds.map((f) => f.id)];
      const icsIds = ids.filter((id) => id.startsWith('ics:'));
      const googleIds = ids.filter((id) => !id.startsWith('ics:'));
      const list = tokens && googleIds.length ? await calendarList() : { items: [] };
      const nameOf = (id: string) => {
        const c = list.items.find((x) => x.id === id || (id === 'primary' && x.primary));
        return { name: c?.summaryOverride ?? c?.summary ?? id, color: c?.backgroundColor, id: c?.id ?? id };
      };

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + days * 86_400_000);
      const key = `events:${ids.join(',')}:${days}`;
      const events = await ctx.cache.wrap(key, 60_000, async () => {
        const all: CalEvent[] = [];
        const errors: string[] = [];
        await Promise.all(
          icsIds.map(async (id) => {
            const feed = allFeeds.find((f) => f.id === id);
            if (!feed) return;
            try {
              all.push(...(await fetchIcsEvents(feed, start, end)));
            } catch (e) {
              errors.push((e as Error).message);
              ctx.log.warn('ICS feed failed:', feed.name, (e as Error).message);
            }
          }),
        );
        if (errors.length && all.length === 0 && googleIds.length === 0) throw new Error(errors.join('; '));
        await Promise.all(
          (tokens ? googleIds : []).map(async (id) => {
            const meta = nameOf(id);
            const params = new URLSearchParams({
              timeMin: start.toISOString(),
              timeMax: end.toISOString(),
              singleEvents: 'true',
              orderBy: 'startTime',
              maxResults: '100',
            });
            const data = await gapi<GEvents>(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${params}`);
            for (const e of data.items ?? []) {
              if (e.status === 'cancelled') continue;
              const allDay = !!e.start.date;
              all.push({
                id: `${meta.id}:${e.id}`,
                title: e.summary ?? '(no title)',
                start: allDay ? new Date(e.start.date + 'T00:00:00').toISOString() : e.start.dateTime!,
                end: allDay ? new Date(e.end.date + 'T00:00:00').toISOString() : e.end.dateTime!,
                allDay,
                location: e.location,
                description: e.description,
                calendarId: meta.id,
                calendarName: meta.name,
                color: meta.color,
                status: e.status,
                htmlLink: e.htmlLink,
              });
            }
          }),
        );
        return all.sort((a, b) => a.start.localeCompare(b.start));
      });
      res.json(events);
    }),
  );
});
