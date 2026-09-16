/**
 * Discovers every plugin's browser entry at build time.
 * Any folder under /plugins with a client.tsx is picked up automatically.
 */
import type { ClientPlugin } from '@sdk/client';

const modules = import.meta.glob<{ default: ClientPlugin }>('../../../plugins/*/client.tsx', { eager: true });

const registry = new Map<string, ClientPlugin>();
for (const [file, mod] of Object.entries(modules)) {
  const plugin = mod.default;
  if (!plugin?.manifest?.id) {
    console.warn(`[registry] ${file} does not default-export definePlugin(...)`);
    continue;
  }
  if (file.includes('/_')) continue; // skip _template & friends
  registry.set(plugin.manifest.id, plugin);
}

export function getClientPlugin(id: string): ClientPlugin | undefined {
  return registry.get(id);
}

export function listClientPlugins(): ClientPlugin[] {
  return [...registry.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
