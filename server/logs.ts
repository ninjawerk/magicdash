/** In-memory log ring buffer fed by console.*, streamed to the admin Logs page over SSE. */
import type { Express } from 'express';
import { broadcast } from './events';

export interface LogEntry {
  seq: number;
  ts: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
}
const MAX = 1000;
const buffer: LogEntry[] = [];
let seq = 0;
let installed = false;

function fmt(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack ?? a.message;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .replace(/\x1b\[[0-9;]*m/g, '');
}

export function push(level: LogEntry['level'], msg: string) {
  const entry: LogEntry = { seq: ++seq, ts: new Date().toISOString(), level, msg: msg.slice(0, 4000) };
  buffer.push(entry);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  try {
    broadcast({ plugin: '$host', event: 'log', payload: entry });
  } catch {
    /* ignore */
  }
}

/** Wrap console.* so everything the server (and plugins) print is captured. */
export function installLogCapture() {
  if (installed) return;
  installed = true;
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  console.log = (...a) => {
    orig.log(...a);
    push('info', fmt(a));
  };
  console.info = (...a) => {
    orig.info(...a);
    push('info', fmt(a));
  };
  console.warn = (...a) => {
    orig.warn(...a);
    push('warn', fmt(a));
  };
  console.error = (...a) => {
    orig.error(...a);
    push('error', fmt(a));
  };
  console.debug = (...a) => {
    orig.debug(...a);
    push('debug', fmt(a));
  };
  process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
  process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
}

export function registerLogRoutes(app: Express) {
  /** GET /api/logs?after=<seq>&level=warn&limit=500 */
  app.get('/api/logs', (req, res) => {
    const after = Number(req.query.after ?? 0);
    const limit = Math.min(1000, Number(req.query.limit ?? 500));
    const min = String(req.query.level ?? 'debug');
    const order = ['debug', 'info', 'warn', 'error'];
    const minIdx = Math.max(0, order.indexOf(min));
    const out = buffer.filter((e) => e.seq > after && order.indexOf(e.level) >= minIdx).slice(-limit);
    res.json({ entries: out, latest: seq, total: buffer.length });
  });
  app.get('/api/logs/download', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="magicdash-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log"`);
    res.send(buffer.map((e) => `${e.ts} ${e.level.toUpperCase().padEnd(5)} ${e.msg}`).join('\n'));
  });
}
