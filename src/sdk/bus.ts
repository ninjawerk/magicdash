/**
 * Inter-plugin event bus (browser side). Widgets publish facts other widgets can react to,
 * e.g. the weather tile publishes `weather:current` and a greeting tile shows "bring an umbrella".
 *
 * Topics are namespaced `<pluginId>:<name>`. The latest payload per topic is retained so late
 * subscribers get it immediately. Publishing is local to this browser (each kiosk/admin page has its own bus).
 */
import { useEffect, useRef, useState } from 'react';

type Handler<T = unknown> = (payload: T, topic: string) => void;
const handlers = new Map<string, Set<Handler>>();
const latest = new Map<string, unknown>();

export function publish<T = unknown>(topic: string, payload: T): void {
  latest.set(topic, payload);
  handlers.get(topic)?.forEach((h) => h(payload, topic));
  handlers.get('*')?.forEach((h) => h(payload, topic));
}

export function subscribe<T = unknown>(topic: string, handler: Handler<T>): () => void {
  let set = handlers.get(topic);
  if (!set) handlers.set(topic, (set = new Set()));
  set.add(handler as Handler);
  return () => set!.delete(handler as Handler);
}

/** Last published payload for a topic, if any. */
export function peek<T = unknown>(topic: string): T | undefined {
  return latest.get(topic) as T | undefined;
}

/** React: subscribe to a topic; returns the latest payload (or undefined). */
export function useTopic<T = unknown>(topic: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => peek<T>(topic));
  useEffect(() => {
    setValue(peek<T>(topic));
    return subscribe<T>(topic, setValue);
  }, [topic]);
  return value;
}

/** React: run a handler for each message on a topic. */
export function useSubscribe<T = unknown>(topic: string, handler: Handler<T>) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe<T>(topic, (p, t) => ref.current(p, t)), [topic]);
}

/** Well-known topics published by bundled plugins. */
export interface WeatherCurrentTopic {
  temp: number;
  units: 'metric' | 'imperial';
  code: number;
  isDay: boolean;
  description: string;
  /** Max precipitation probability over the next ~12 hours (0-100). */
  rainSoon: number;
  tMax?: number;
  tMin?: number;
  location?: string;
}
export interface CalendarNextTopic {
  title: string;
  start: string;
  end: string;
  location?: string;
  minutesUntil: number;
}
