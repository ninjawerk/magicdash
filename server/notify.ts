/** Toast notifications: POST /api/notify → every connected dashboard shows a toast. */
import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import type { Toast } from '../src/sdk/types';
import { broadcast } from './events';
import { resolveDeviceId } from './devices';

const recent: number[] = [];
const LIMIT_PER_MIN = 30;

export function notify(input: Partial<Toast> & { message: string; deviceId?: string }): Toast {
  const toast: Toast = {
    deviceId: resolveDeviceId(input.deviceId),
    id: randomBytes(6).toString('hex'),
    message: String(input.message).slice(0, 500),
    title: input.title ? String(input.title).slice(0, 80) : undefined,
    level: (['info', 'success', 'warn', 'error'] as const).includes(input.level as never) ? (input.level as Toast['level']) : 'info',
    durationSec: input.durationSec === undefined ? 10 : Math.max(0, Math.min(3600, Number(input.durationSec))),
    icon: input.icon ? String(input.icon).slice(0, 8) : undefined,
    screen: input.screen,
    switchScreen: !!input.switchScreen,
    at: new Date().toISOString(),
  };
  broadcast({ plugin: '$host', event: 'notify', payload: toast });
  console.log(`[notify] ${toast.level}: ${toast.title ? toast.title + ' — ' : ''}${toast.message}`);
  return toast;
}

export function registerNotifyRoutes(app: Express) {
  /** Public (no token) so a Home Assistant automation can post a message; lightly rate limited. */
  app.post('/api/notify', (req, res) => {
    const now = Date.now();
    while (recent.length && recent[0] < now - 60_000) recent.shift();
    if (recent.length >= LIMIT_PER_MIN) {
      res.status(429).json({ error: 'Too many notifications; max 30 per minute.' });
      return;
    }
    const body = (req.body ?? {}) as Partial<Toast> & { message?: string };
    if (!body.message || typeof body.message !== 'string') {
      res.status(400).json({ error: '"message" is required' });
      return;
    }
    recent.push(now);
    res.json({ ok: true, toast: notify(body as Partial<Toast> & { message: string }) });
  });
}
