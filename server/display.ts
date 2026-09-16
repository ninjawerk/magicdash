/**
 * Display power & brightness.
 *  - Hardware when available: /sys/class/backlight/* (DSI Touch Display etc.) and an output on/off command
 *    (wlr-randr on Wayland, vcgencmd on legacy; override with MAGICDASH_DISPLAY_ON / MAGICDASH_DISPLAY_OFF).
 *  - Always: the state is broadcast as $host/display and the kiosk blacks out / dims in software, so it works
 *    on any panel even if the hardware paths aren't writable.
 *  - Schedule (off/on times), night mode brightness, and presence wake via Home Assistant entity changes.
 */
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { inWindow, type DisplayState } from '../src/sdk/types';
import { broadcast, onBroadcast } from './events';
import { layoutStore, settingsStore } from './storage';

const run = promisify(execFile);

export interface DisplaySettings {
  schedule: { enabled: boolean; offAt: string; onAt: string; days?: number[] };
  /** Home Assistant entity ids whose change to on/home/open wakes the display. */
  presenceEntities: string[];
  wakeSeconds: number;
  /** Keep the display on while any presence entity is on/home, regardless of schedule. */
  stayOnWhilePresent: boolean;
  /** Day brightness (%), used outside night mode. */
  brightness: number;
}
const DEFAULTS: DisplaySettings = { schedule: { enabled: false, offAt: '23:30', onAt: '06:30' }, presenceEntities: [], wakeSeconds: 120, stayOnWhilePresent: true, brightness: 100 };

const state: DisplayState = { on: true, brightness: 100, hardware: { backlight: false, power: false } };
let backlightDir: string | undefined;
let backlightMax = 255;
let manualUntil = 0; // manual override (or wake) expiry; 0 = none
let manualOn: boolean | undefined;
let presentEntities = new Set<string>();
const ACTIVE = new Set(['on', 'home', 'open', 'unlocked', 'playing', 'detected', 'occupied']);

export function getDisplaySettings(): DisplaySettings {
  const raw = (settingsStore.get().$host?.display as Partial<DisplaySettings> | undefined) ?? {};
  return { ...DEFAULTS, ...raw, schedule: { ...DEFAULTS.schedule, ...(raw.schedule ?? {}) } };
}
async function saveDisplaySettings(patch: Partial<DisplaySettings>) {
  const all = settingsStore.get();
  const cur = getDisplaySettings();
  const next = { ...cur, ...patch, schedule: { ...cur.schedule, ...(patch.schedule ?? {}) } };
  await settingsStore.set({ ...all, $host: { ...(all.$host ?? {}), display: next } });
  return next;
}

async function detectHardware() {
  try {
    const dirs = await fs.readdir('/sys/class/backlight');
    if (dirs.length) {
      backlightDir = `/sys/class/backlight/${dirs[0]}`;
      backlightMax = Number(await fs.readFile(`${backlightDir}/max_brightness`, 'utf8')) || 255;
      await fs.access(`${backlightDir}/brightness`, fs.constants.W_OK);
      state.hardware.backlight = true;
    }
  } catch {
    state.hardware.backlight = false;
  }
  state.hardware.power = !!(process.env.MAGICDASH_DISPLAY_ON && process.env.MAGICDASH_DISPLAY_OFF) || (await which('wlr-randr')) || (await which('vcgencmd'));
}
async function which(cmd: string) {
  try {
    await run('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

async function applyHardware() {
  if (state.hardware.backlight && backlightDir) {
    const level = state.on ? Math.round((Math.max(5, state.brightness) / 100) * backlightMax) : 0;
    await fs.writeFile(`${backlightDir}/brightness`, String(level)).catch((e) => console.warn('[display] backlight write failed:', (e as Error).message));
  }
  if (state.hardware.power) {
    const custom = state.on ? process.env.MAGICDASH_DISPLAY_ON : process.env.MAGICDASH_DISPLAY_OFF;
    try {
      if (custom) await run('sh', ['-c', custom]);
      else if (await which('wlr-randr')) {
        // Runs from the systemd service: point at the desktop user's Wayland socket.
        const env = { ...process.env, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? '/run/user/1000', WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY ?? 'wayland-0' };
        const { stdout } = await run('wlr-randr', [], { env });
        const output = stdout.match(/^(\S+)\s/m)?.[1];
        if (output) await run('wlr-randr', ['--output', output, state.on ? '--on' : '--off'], { env });
      } else if (await which('vcgencmd')) await run('vcgencmd', ['display_power', state.on ? '1' : '0']);
    } catch (e) {
      console.warn('[display] power command failed:', (e as Error).message.split('\n')[0]);
    }
  }
}

function publish() {
  broadcast({ plugin: '$host', event: 'display', payload: state });
}

/** Decide the desired state from schedule, night mode, presence and manual overrides, then apply. */
async function evaluate(reason = 'schedule') {
  const s = getDisplaySettings();
  const now = new Date();
  const layout = layoutStore.get();
  let on = true;
  if (s.schedule.enabled) {
    // The "off window" is offAt → onAt.
    on = !inWindow({ from: s.schedule.offAt, to: s.schedule.onAt, days: s.schedule.days }, now);
  }
  if (s.stayOnWhilePresent && presentEntities.size > 0) on = true;
  if (manualUntil && Date.now() < manualUntil && manualOn !== undefined) on = manualOn;
  else if (manualUntil && Date.now() >= manualUntil) {
    manualUntil = 0;
    manualOn = undefined;
  }
  const night = layout.night;
  const brightness = night?.enabled && inWindow({ from: night.from, to: night.to }, now) ? Math.max(10, Math.min(100, night.brightness)) : Math.max(10, Math.min(100, s.brightness));
  const changed = on !== state.on || brightness !== state.brightness;
  state.on = on;
  state.brightness = brightness;
  state.reason = reason;
  if (changed) {
    console.log(`[display] ${on ? 'on' : 'off'} · ${brightness}% (${reason})`);
    await applyHardware();
    publish();
  }
}

export async function setDisplay(opts: { on?: boolean; brightness?: number; forSeconds?: number }, reason = 'api') {
  if (opts.on !== undefined) {
    manualOn = opts.on;
    manualUntil = opts.forSeconds ? Date.now() + opts.forSeconds * 1000 : Number.MAX_SAFE_INTEGER;
  }
  if (opts.brightness !== undefined) await saveDisplaySettings({ brightness: Math.max(10, Math.min(100, opts.brightness)) });
  await evaluate(reason);
  return state;
}
/** Re-run the schedule/night-mode evaluation now (called after the layout changes). */
export function reevaluateDisplay(reason = 'layout changed') {
  return evaluate(reason);
}
export function clearManual() {
  manualUntil = 0;
  manualOn = undefined;
  return evaluate('manual cleared');
}

export async function startDisplay() {
  await detectHardware();
  console.log(`[display] hardware: backlight=${state.hardware.backlight} power=${state.hardware.power}`);
  await evaluate('startup');
  setInterval(() => evaluate('schedule'), 30_000).unref();
  // Presence: watch Home Assistant state events that the HA plugin broadcasts.
  onBroadcast((ev) => {
    if (ev.plugin !== 'home-assistant') return;
    const s = getDisplaySettings();
    if (s.presenceEntities.length === 0) return;
    const update = (entity_id: string, st: string | undefined, changed: boolean) => {
      if (!s.presenceEntities.includes(entity_id)) return;
      const active = !!st && ACTIVE.has(st);
      const was = presentEntities.has(entity_id);
      if (active) presentEntities.add(entity_id);
      else presentEntities.delete(entity_id);
      if (changed && active && !was) {
        manualOn = true;
        manualUntil = Date.now() + s.wakeSeconds * 1000;
        void evaluate(`presence: ${entity_id}`);
      } else if (changed) void evaluate(`presence: ${entity_id}`);
    };
    if (ev.event === 'state') {
      const p = ev.payload as { entity_id: string; state: { state: string } | null };
      update(p.entity_id, p.state?.state, true);
    } else if (ev.event === 'states') {
      for (const st of ev.payload as Array<{ entity_id: string; state: string }>) update(st.entity_id, st.state, false);
    }
  });
}

export function registerDisplayRoutes(app: Express) {
  app.get('/api/display', (_req, res) => res.json({ state, settings: getDisplaySettings(), manual: manualUntil ? { on: manualOn, until: manualUntil === Number.MAX_SAFE_INTEGER ? null : new Date(manualUntil).toISOString() } : null }));
  /** POST /api/display { on?, brightness?, forSeconds? }  or { clear: true } */
  app.post('/api/display', async (req, res) => {
    const b = (req.body ?? {}) as { on?: boolean; brightness?: number; forSeconds?: number; clear?: boolean };
    if (b.clear) {
      await clearManual();
      res.json({ ok: true, state });
      return;
    }
    res.json({ ok: true, state: await setDisplay(b, 'api') });
  });
  app.put('/api/display/settings', async (req, res) => {
    const next = await saveDisplaySettings((req.body ?? {}) as Partial<DisplaySettings>);
    await evaluate('settings changed');
    res.json({ ok: true, settings: next, state });
  });
}
