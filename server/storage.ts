import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DashboardLayout } from '../src/sdk/types';

export const DATA_DIR = path.resolve(process.env.MAGICDASH_DATA ?? 'data');

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}

/** A tiny JSON document store with a write queue so concurrent saves don't clobber each other. */
export class JsonStore<T> {
  private value: T | undefined;
  private queue: Promise<void> = Promise.resolve();
  constructor(private file: string, private fallback: () => T) {}

  async load(): Promise<T> {
    if (this.value === undefined) this.value = await readJson(this.file, this.fallback());
    return this.value;
  }

  get(): T {
    if (this.value === undefined) throw new Error(`Store ${this.file} not loaded`);
    return this.value;
  }

  async set(next: T): Promise<void> {
    this.value = next;
    this.queue = this.queue.then(() => writeJson(this.file, next)).catch((e) => console.error('[storage]', e));
    await this.queue;
  }
}

export function defaultLayout(): DashboardLayout {
  return {
    version: 1,
    grid: { cols: 12, rows: 8, gap: 14, padding: 18 },
    theme: {
      background: 'radial-gradient(1200px 800px at 15% 10%, #16213a 0%, #0b0f17 55%, #070a10 100%)',
      accent: '#7c9cff',
      tileBackground: 'rgba(255,255,255,0.05)',
      tileRadius: 22,
      showTitles: true,
      fg: '#e7ebf3',
      surface: '#121826',
      dark: true,
      preset: 'midnight',
    },
    widgets: [
      { id: 'w-clock', pluginId: 'clock', x: 0, y: 0, w: 4, h: 2, config: {} },
      { id: 'w-schedule', pluginId: 'google-calendar', x: 4, y: 0, w: 8, h: 5, config: {} },
      { id: 'w-weather', pluginId: 'weather', x: 0, y: 2, w: 4, h: 3, config: {} },
      { id: 'w-quotes', pluginId: 'quotes', x: 0, y: 5, w: 4, h: 3, config: {} },
      { id: 'w-image', pluginId: 'random-image', x: 4, y: 5, w: 4, h: 3, config: {} },
      { id: 'w-ha', pluginId: 'home-assistant', x: 8, y: 5, w: 4, h: 3, config: {} },
    ],
  };
}

export const layoutStore = new JsonStore<DashboardLayout>(path.join(DATA_DIR, 'layout.json'), defaultLayout);
export const settingsStore = new JsonStore<Record<string, Record<string, unknown>>>(
  path.join(DATA_DIR, 'settings.json'),
  () => ({}),
);
