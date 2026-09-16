import type { Response } from 'express';
import type { PluginEvent } from '../src/sdk/types';

const clients = new Set<Response>();

export function addSseClient(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(`retry: 3000\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(`: ping\n\n`), 25_000);
  res.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

const internal = new Set<(ev: PluginEvent) => void>();
/** Server-side subscription to everything that is broadcast (used by the display module to watch HA states). */
export function onBroadcast(fn: (ev: PluginEvent) => void): () => void {
  internal.add(fn);
  return () => internal.delete(fn);
}

export function broadcast(ev: PluginEvent) {
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(data);
  internal.forEach((fn) => {
    try {
      fn(ev);
    } catch (e) {
      console.error('[events] listener failed', e);
    }
  });
}

export function clientCount() {
  return clients.size;
}
