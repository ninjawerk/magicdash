import { useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { hostApi } from '../../lib/api';
import { useStore } from '../../lib/store';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PasswordSection />
      <TokensSection />
    </div>
  );
}

function PasswordSection() {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setMsg({ err: 'New passwords don’t match.' });
    setBusy(true);
    try {
      await hostApi.changePassword(cur, pw);
      setMsg({ ok: 'Password changed. Other browsers are signed out.' });
      setCur('');
      setPw('');
      setPw2('');
    } catch (e2) {
      setMsg({ err: (e2 as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="surface rounded-2xl border border-white/10 p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white/70">
        <KeyRound size={14} /> Admin password
      </h2>
      <p className="mb-4 text-xs text-white/45">Protects this panel and edit mode on the kiosk. Lost it? On the Pi: <span className="font-mono">npm run set-password &lt;new&gt;</span> then <span className="font-mono">sudo systemctl restart magicdash</span>.</p>
      <form onSubmit={submit} className="grid max-w-md gap-3">
        <input className="input" type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input className="input" type="password" placeholder="New password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {msg.err && <p className="text-xs text-red-300">{msg.err}</p>}
        {msg.ok && <p className="text-xs text-emerald-300">{msg.ok}</p>}
        <button className="btn btn-primary w-fit" disabled={busy || !cur || pw.length < 6}>
          {busy && <Loader2 size={14} className="animate-spin" />} Change password
        </button>
      </form>
    </section>
  );
}

function TokensSection() {
  const { apiFor } = useStore();
  void apiFor;
  const [tokens, setTokens] = useState<Awaited<ReturnType<typeof hostApi.tokens>>>([]);
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<{ name: string; token: string }>();
  const [err, setErr] = useState<string>();
  const load = () => hostApi.tokens().then(setTokens).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
  }, []);
  const create = async () => {
    try {
      const r = await hostApi.createToken(name || 'token');
      setFresh({ name: r.name, token: r.token });
      setName('');
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const origin = window.location.origin;
  return (
    <section className="surface rounded-2xl border border-white/10 p-6">
      <h2 className="mb-1 text-sm font-semibold text-white/70">API tokens</h2>
      <p className="mb-4 text-xs text-white/45">
        For the MCP server and automations. Send as <span className="font-mono">Authorization: Bearer &lt;token&gt;</span>. Tokens can do everything the admin can.
      </p>
      <div className="flex max-w-md gap-2">
        <input className="input" placeholder="Name, e.g. claude-code" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary whitespace-nowrap" onClick={create}>
          <Plus size={14} /> Create
        </button>
      </div>
      {fresh && (
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm">
          <p className="font-medium text-emerald-200">Token “{fresh.name}” created — copy it now, it won’t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded bg-black/40 px-2 py-1 font-mono text-xs">{fresh.token}</code>
            <button className="btn btn-ghost p-2" onClick={() => navigator.clipboard?.writeText(fresh.token)} title="Copy">
              <Copy size={14} />
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">Claude Code:</p>
          <code className="mt-1 block select-all break-all rounded bg-black/40 px-2 py-1 font-mono text-[11px]">
            claude mcp add magicdash -e MAGICDASH_URL={origin} -e MAGICDASH_TOKEN={fresh.token} -- npx tsx /path/to/magicdash/mcp/server.ts
          </code>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1">
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 text-xs text-white/40">
                created {new Date(t.createdAt).toLocaleDateString()}
                {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}` : ' · never used'}
              </span>
            </span>
            <button
              className="btn btn-ghost p-1.5 hover:bg-red-500/20 hover:text-red-200"
              title="Revoke"
              onClick={async () => {
                if (confirm(`Revoke token "${t.name}"?`)) {
                  await hostApi.revokeToken(t.id);
                  load();
                }
              }}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {tokens.length === 0 && <li className="px-4 py-3 text-sm text-white/40">No tokens yet.</li>}
      </ul>
    </section>
  );
}
