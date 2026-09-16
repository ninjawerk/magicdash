import { definePlugin, usePluginQuery, type WidgetProps } from '../../src/sdk/client';
import manifest from './manifest';

interface Config {
  greeting?: string;
  refreshSec?: number;
  flavour?: string;
}

function MyWidget({ config, api, size }: WidgetProps<Config>) {
  const { data, error, loading } = usePluginQuery<{ time: string; hasKey: boolean }>(api, '/data', {
    refreshMs: (config.refreshSec ?? 60) * 1000,
  });

  if (error) return <p className="p-4 text-sm text-red-300">{error}</p>;
  if (loading) return <p className="p-4 text-sm text-white/40">Loading…</p>;

  return (
    <div className="flex h-full flex-col justify-center px-5 pb-4">
      <div className="font-bold" style={{ fontSize: Math.min(40, size.width / 8) }}>
        {config.greeting ?? 'Hello'} 👋
      </div>
      <div className="text-sm text-white/50">
        Server time {data?.time} · flavour: {config.flavour ?? 'none'} · key {data?.hasKey ? 'set' : 'missing'}
      </div>
    </div>
  );
}

export default definePlugin<Config>({ manifest, Widget: MyWidget });
