/**
 * MagicDash Plugin SDK — server side.
 *
 * A plugin's optional `server.ts` exports `default defineServerPlugin((ctx) => { ... })`.
 * The host mounts `ctx.router` at `/api/plugins/<plugin-id>`.
 */
import type { Request, RequestHandler, Response, Router } from 'express';
import type { PluginManifest } from './types';

export * from './types';

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export interface SettingsStore<T = Record<string, unknown>> {
  /** Current plugin-wide settings, secrets included (server only). */
  get(): T;
  /** Merge and persist. */
  set(patch: Partial<T>): Promise<void>;
  /** Called whenever settings for this plugin change (from the UI or from `set`). */
  onChange(cb: (next: T, prev: T) => void): () => void;
}

export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  /** Return cached value or compute + cache it. */
  wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
}

export interface PluginServerContext<S = Record<string, unknown>> {
  manifest: PluginManifest;
  /** Express router mounted at `/api/plugins/<id>`. Add GET/POST handlers here. */
  router: Router;
  settings: SettingsStore<S>;
  cache: Cache;
  log: Logger;
  /** Absolute directory this plugin may write files to (under ./data/plugins/<id>). */
  dataDir: string;
  /** Push an event to every connected browser. Widgets receive it via `usePluginEvent`. */
  emit: (event: string, payload?: unknown) => void;
  /** Public base URL of the dashboard (for OAuth redirects). */
  publicUrl: () => string;
  /** Register cleanup to run on shutdown / reload. */
  onShutdown: (cb: () => void | Promise<void>) => void;
  /**
   * Ask every connected dashboard to switch to the first screen showing one of this plugin's tiles and hold
   * it there (same lock rules as the widget-side API: one holder, 120 s max). Use `releaseAttention()` when done.
   */
  requestAttention: (reason?: string) => void;
  releaseAttention: () => void;
  /** Show a toast on every connected dashboard. */
  notify: (toast: { message: string; title?: string; level?: 'info' | 'success' | 'warn' | 'error'; durationSec?: number; icon?: string; screen?: string; switchScreen?: boolean; deviceId?: string }) => void;
}

export type ServerPluginSetup<S = Record<string, unknown>> = (
  ctx: PluginServerContext<S>,
) => void | Promise<void>;

export function defineServerPlugin<S = Record<string, unknown>>(setup: ServerPluginSetup<S>): ServerPluginSetup<S> {
  return setup;
}

/** Small helper: wrap an async express handler so thrown errors turn into JSON 500s. */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res) => {
    fn(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) res.status(500).json({ error: message });
    });
  };
}
