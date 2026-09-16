import type { Cache } from '../src/sdk/server';

export function createCache(): Cache {
  const map = new Map<string, { value: unknown; expires: number }>();
  const inflight = new Map<string, Promise<unknown>>();
  const get = <T,>(key: string): T | undefined => {
    const hit = map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      map.delete(key);
      return undefined;
    }
    return hit.value as T;
  };
  return {
    get,
    set: (key, value, ttlMs) => {
      map.set(key, { value, expires: Date.now() + ttlMs });
    },
    delete: (key) => {
      map.delete(key);
    },
    async wrap(key, ttlMs, fn) {
      const hit = get(key);
      if (hit !== undefined) return hit as Awaited<ReturnType<typeof fn>>;
      const existing = inflight.get(key);
      if (existing) return existing as Promise<Awaited<ReturnType<typeof fn>>>;
      const p = fn()
        .then((v) => {
          map.set(key, { value: v, expires: Date.now() + ttlMs });
          return v;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
  };
}
