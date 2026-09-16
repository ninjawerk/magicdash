import WebSocket from 'ws';
import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';
import type { HaState, HaStatus } from './shared';

interface Settings {
  url?: string;
  token?: string;
}

export default defineServerPlugin<Settings>((ctx) => {
  const states = new Map<string, HaState>();
  let ws: WebSocket | undefined;
  let connected = false;
  let version: string | undefined;
  let lastError: string | undefined;
  let msgId = 1;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let backoff = 2000;
  let closedByUs = false;

  const baseUrl = () => ctx.settings.get().url?.trim().replace(/\/+$/, '');
  const configured = () => !!(baseUrl() && ctx.settings.get().token);

  function scheduleReconnect() {
    if (reconnectTimer || closedByUs) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, backoff);
    backoff = Math.min(backoff * 2, 60_000);
  }

  function connect() {
    if (!configured()) return;
    const url = baseUrl()!;
    const wsUrl = url.replace(/^http/, 'ws') + '/api/websocket';
    ctx.log.info('connecting to', wsUrl);
    closedByUs = false;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      lastError = (e as Error).message;
      scheduleReconnect();
      return;
    }
    const sock = ws;
    const send = (obj: Record<string, unknown>) => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify(obj));
    let getStatesId = 0;

    sock.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (msg.type) {
        case 'auth_required':
          version = msg.ha_version as string;
          send({ type: 'auth', access_token: ctx.settings.get().token });
          break;
        case 'auth_ok':
          connected = true;
          lastError = undefined;
          backoff = 2000;
          ctx.log.info(`connected (HA ${version})`);
          getStatesId = msgId++;
          send({ id: getStatesId, type: 'get_states' });
          send({ id: msgId++, type: 'subscribe_events', event_type: 'state_changed' });
          ctx.emit('status', status());
          break;
        case 'auth_invalid':
          lastError = `Authentication failed: ${msg.message}`;
          ctx.log.error(lastError);
          closedByUs = true; // don't hammer HA with a bad token
          sock.close();
          ctx.emit('status', status());
          break;
        case 'result':
          if (msg.id === getStatesId && Array.isArray(msg.result)) {
            states.clear();
            for (const s of msg.result as HaState[]) states.set(s.entity_id, s);
            ctx.emit('states', [...states.values()]);
          }
          break;
        case 'event': {
          const ev = msg.event as { event_type: string; data: { entity_id: string; new_state: HaState | null } };
          if (ev?.event_type === 'state_changed') {
            const ns = ev.data.new_state;
            if (ns) states.set(ev.data.entity_id, ns);
            else states.delete(ev.data.entity_id);
            ctx.emit('state', { entity_id: ev.data.entity_id, state: ns });
          }
          break;
        }
      }
    });
    sock.on('error', (e) => {
      lastError = e.message;
      ctx.log.warn('socket error:', e.message);
    });
    sock.on('close', () => {
      const was = connected;
      connected = false;
      if (was) ctx.emit('status', status());
      if (!closedByUs) scheduleReconnect();
    });
  }

  function disconnect() {
    closedByUs = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    ws?.close();
    ws = undefined;
    connected = false;
  }

  const status = (): HaStatus => ({ configured: configured(), connected, entities: states.size, error: lastError, version });

  ctx.settings.onChange(() => {
    ctx.log.info('settings changed — reconnecting');
    disconnect();
    states.clear();
    lastError = undefined;
    connect();
  });
  ctx.onShutdown(disconnect);
  connect();

  // --- Routes ------------------------------------------------------------------
  ctx.router.get('/status', (_req, res) => res.json(status()));

  ctx.router.get('/states', (_req, res) => res.json([...states.values()]));

  /** Options for the entity picker, grouped by domain. */
  ctx.router.get('/entities', (_req, res) => {
    if (!configured()) {
      res.status(400).json({ error: 'Set the Home Assistant URL and token in the plugin settings first.' });
      return;
    }
    if (!connected && states.size === 0) {
      res.status(503).json({ error: lastError ?? 'Not connected to Home Assistant yet — try again in a moment.' });
      return;
    }
    const opts = [...states.values()]
      .map((s) => ({
        value: s.entity_id,
        label: s.attributes.friendly_name ?? s.entity_id,
        description: s.entity_id,
        group: s.entity_id.split('.')[0],
      }))
      .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
    res.json(opts);
  });

  /** POST /service { domain, service, entity_id?, data? } */
  ctx.router.post(
    '/service',
    asyncHandler(async (req, res) => {
      const { domain, service, entity_id, data } = req.body as { domain: string; service: string; entity_id?: string; data?: Record<string, unknown> };
      if (!domain || !service) {
        res.status(400).json({ error: 'domain and service are required' });
        return;
      }
      const r = await fetch(`${baseUrl()}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ctx.settings.get().token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ...(entity_id ? { entity_id } : {}), ...(data ?? {}) }),
      });
      if (!r.ok) throw new Error(`Home Assistant ${r.status}: ${(await r.text()).slice(0, 200)}`);
      res.json({ ok: true });
    }),
  );
});
