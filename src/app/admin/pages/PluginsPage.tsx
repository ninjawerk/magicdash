import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { InstallPluginDialog, PluginSettingsDialog } from '../../components/Dialogs';
import { listClientPlugins } from '../../lib/registry';

export function PluginsPage() {
  const configurable = listClientPlugins().filter((p) => (p.manifest.settings?.length ?? 0) > 0);
  const [open, setOpen] = useState<string | undefined>();
  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl border border-white/10 p-6">
        <h2 className="mb-1 text-sm font-semibold text-white/70">Plugin settings</h2>
        <p className="mb-4 text-xs text-white/45">Connections and keys shared by every tile of a plugin — Google account, Home Assistant token, image folder, API keys.</p>
        <div className="flex flex-wrap gap-2">
          {configurable.map((p) => (
            <button key={p.manifest.id} className={`btn ${open === p.manifest.id ? 'btn-primary' : 'btn-default'}`} onClick={() => setOpen(open === p.manifest.id ? undefined : p.manifest.id)}>
              <span>{p.manifest.icon}</span> {p.manifest.name} <Settings2 size={13} className="opacity-60" />
            </button>
          ))}
        </div>
        {open && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <PluginSettingsDialog key={open} pluginId={open} onClose={() => setOpen(undefined)} />
          </div>
        )}
      </section>
      <section className="surface rounded-2xl border border-white/10 p-6">
        <InstallPluginDialog onClose={() => undefined} />
      </section>
    </div>
  );
}
