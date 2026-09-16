/**
 * Output devices: every kiosk / browser showing the dashboard registers itself with a heartbeat and can be
 * configured individually (which screens it cycles, rotation, brightness, forced off) and targeted by
 * host events (show screen, attention, notify, reload, identify).
 */
import path from 'node:path';
import type { Express, Request } from 'express';
import { JsonStore, DATA_DIR } from './storage';
import { broadcast } from './events';
import { isAuthenticated } from './auth';

export interface DeviceConfig {
  /** Screen ids this device cycles through; empty = all. */
  screens?: string[];
  rotation?: { enabled: boolean; intervalSec: number };
  /** 10–100, software dim on this device; undefined = follow the dashboard. */
  brightness?: number;
  /** 'auto' follows the display schedule; 'off' blacks this device out; 'on' ignores the schedule. */
  power?: 'auto' | 'on' | 'off';
}
export interface Device {
  id: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  ip?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  currentScreen?: string;
  appVersion?: string;
  config: DeviceConfig;
}

const store = new JsonStore<Record<string, Device>>(path.join(DATA_DIR, 'devices.json'), () => ({}));
const ONLINE_MS = 90_000;

export async function loadDevices() {
  await store.load();
}
export function listDevices(): Array<Device & { online: boolean }> {
  const now = Date.now();
  return Object.values(store.get())
    .map((d) => ({ ...d, online: now - new Date(d.lastSeen).getTime() < ONLINE_MS }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
}
export function getDevice(id: string) {
  return store.get()[id];
}
async function save(d: Device) {
  await store.set({ ...store.get(), [d.id]: d });
}

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function registerDeviceRoutes(app: Express) {
  /** Public: kiosks call this every 30 s. Returns the device's config. */
  app.post('/api/devices/heartbeat', async (req, res) => {
    const b = (req.body ?? {}) as { id?: string; name?: string; screen?: string; viewport?: { width: number; height: number }; version?: string };
    if (!b.id || !ID_RE.test(b.id)) {
      res.status(400).json({ error: 'id required (letters, digits, - _)' });
      return;
    }
    const now = new Date().toISOString();
    const existing = store.get()[b.id];
    const d: Device = existing
      ? { ...existing, lastSeen: now }
      : { id: b.id, name: b.name?.slice(0, 60) || b.id, firstSeen: now, lastSeen: now, config: {} };
    d.ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    d.userAgent = String(req.headers['user-agent'] ?? '').slice(0, 200);
    if (b.viewport) d.viewport = { width: Number(b.viewport.width) || 0, height: Number(b.viewport.height) || 0 };
    if (b.screen) d.currentScreen = b.screen;
    if (b.version) d.appVersion = b.version;
    const changed = !existing || Date.now() - new Date(existing.lastSeen).getTime() > 20_000 || existing.currentScreen !== d.currentScreen;
    if (changed) await save(d);
    res.json({ ok: true, name: d.name, config: d.config });
  });

  app.get('/api/devices', (_req, res) => res.json(listDevices()));

  app.put('/api/devices/:id', async (req, res) => {
    const d = getDevice(req.params.id);
    if (!d) {
      res.status(404).json({ error: 'No such device' });
      return;
    }
    const b = (req.body ?? {}) as { name?: string; config?: DeviceConfig };
    if (typeof b.name === 'string' && b.name.trim()) d.name = b.name.trim().slice(0, 60);
    if (b.config) {
      const c = b.config;
      d.config = {
        screens: Array.isArray(c.screens) && c.screens.length ? c.screens.map(String) : undefined,
        rotation: c.rotation ? { enabled: !!c.rotation.enabled, intervalSec: Math.max(3, Number(c.rotation.intervalSec) || 30) } : undefined,
        brightness: c.brightness === undefined || c.brightness === null ? undefined : Math.max(10, Math.min(100, Number(c.brightness))),
        power: c.power === 'on' || c.power === 'off' ? c.power : 'auto',
      };
    }
    await save(d);
    broadcast({ plugin: '$host', event: 'device', payload: { deviceId: d.id, name: d.name, config: d.config } });
    res.json({ ok: true, device: d });
  });

  app.delete('/api/devices/:id', async (req, res) => {
    const all = { ...store.get() };
    if (!all[req.params.id]) {
      res.status(404).json({ error: 'No such device' });
      return;
    }
    delete all[req.params.id];
    await store.set(all);
    broadcast({ plugin: '$host', event: 'device', payload: { deviceId: req.params.id, forgotten: true } });
    res.json({ ok: true });
  });

  /** POST /api/devices/:id/action { action: 'identify' | 'reload' | 'show', screenId? } */
  app.post('/api/devices/:id/action', (req, res) => {
    const d = getDevice(req.params.id);
    if (!d) {
      res.status(404).json({ error: 'No such device' });
      return;
    }
    const { action, screenId } = (req.body ?? {}) as { action?: string; screenId?: string };
    if (action === 'identify') {
      broadcast({ plugin: '$host', event: 'notify', payload: { id: `identify-${Date.now()}`, title: `This is “${d.name}”`, message: `Device id ${d.id}`, level: 'info', durationSec: 8, icon: '📺', at: new Date().toISOString(), deviceId: d.id } });
    } else if (action === 'reload') {
      broadcast({ plugin: '$host', event: 'reload', payload: { deviceId: d.id } });
    } else if (action === 'show' && screenId) {
      broadcast({ plugin: '$host', event: 'showScreen', payload: { screenId, deviceId: d.id } });
    } else {
      res.status(400).json({ error: 'Unknown action' });
      return;
    }
    res.json({ ok: true });
  });
}

/** Devices can be addressed by id or name in targeted events. */
export function resolveDeviceId(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const all = store.get();
  if (all[ref]) return ref;
  const byName = Object.values(all).find((d) => d.name.toLowerCase() === ref.toLowerCase());
  return byName?.id ?? ref;
}

export function isDeviceRequestAuthed(req: Request) {
  return isAuthenticated(req);
}
