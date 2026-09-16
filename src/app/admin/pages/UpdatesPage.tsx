import { useEffect, useState } from 'react';
import { ArrowUpCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { hostApi } from '../../lib/api';
import { ConfirmButton } from '../../components/ConfirmButton';
import { subscribeEvents } from '@sdk/client';

export function UpdatesPage() {
  const [st, setSt] = useState<Awaited<ReturnType<typeof hostApi.updateStatus>>>();
  const [checking, setChecking] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string>();

  const check = () => {
    setChecking(true);
    hostApi
      .updateStatus()
      .then(setSt)
      .catch((e) => setError((e as Error).message))
      .finally(() => setChecking(false));
  };
  useEffect(check, []);
  useEffect(
    () =>
      subscribeEvents((ev) => {
        if (ev.plugin !== '$host') return;
        if (ev.event === 'update') {
          const p = ev.payload as { line: string; error?: boolean };
          setLog((l) => [...l, p.line]);
          if (p.error) setRunning(false);
          if (p.line.startsWith('✔')) setRunning(false);
        }
        if (ev.event === 'restarting') setRestarting(true);
      }),
    [],
  );
  useEffect(() => {
    if (!restarting) return;
    // Poll until the server is back, then reload to pick up the new build.
    let n = 0;
    const id = setInterval(async () => {
      try {
        await hostApi.health();
        window.location.reload();
      } catch {
        if (++n > 120) clearInterval(id);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [restarting]);

  const run = async () => {
    setError(undefined);
    setLog([]);
    setRunning(true);
    try {
      await hostApi.runUpdate();
    } catch (e) {
      setRunning(false);
      setError((e as Error).message);
    }
  };
  const restart = async () => {
    const r = await hostApi.restart();
    if (r.prod) setRestarting(true);
    else setError('Dev mode: restart npm run dev yourself.');
  };

  const g = st?.git;
  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl border border-white/10 p-6">
        <div className="flex items-start gap-4">
          {st?.updateAvailable ? <ArrowUpCircle className="mt-0.5 shrink-0 text-[var(--accent)]" /> : <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{st ? (st.updateAvailable ? `Update available (${g?.behind} new commit${g?.behind === 1 ? '' : 's'})` : 'You’re up to date') : 'Checking…'}</h2>
            <p className="mt-1 text-sm text-white/55">
              Installed: <b>MagicDash {st?.version}</b>
              {g?.available && g.commit ? (
                <>
                  {' '}
                  · <span className="font-mono">{g.branch}@{g.commit}</span>
                  {g.remoteCommit && g.remoteCommit !== g.commit ? <> → <span className="font-mono">{g.remoteCommit}</span></> : null}
                  {g.dirty && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">local changes</span>}
                </>
              ) : (
                <> · not a git checkout — update it the way you installed it</>
              )}
            </p>
            {g?.fetchError && <p className="mt-1 text-xs text-amber-200">Couldn’t compare with the remote: {g.fetchError}</p>}
            {g?.error && <p className="mt-1 text-xs text-red-300">{g.error}</p>}
            {st?.latestRelease && (
              <p className="mt-2 text-sm text-white/55">
                Latest release: <b>{st.latestRelease.tag}</b> · {new Date(st.latestRelease.publishedAt).toLocaleDateString()}{' '}
                <a className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline" href={st.latestRelease.url} target="_blank" rel="noreferrer">
                  notes <ExternalLink size={11} />
                </a>
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn btn-default" onClick={check} disabled={checking}>
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Check again
          </button>
          <ConfirmButton className="btn btn-primary" armedClassName="btn btn-primary ring-2 ring-[var(--accent)]/50" onConfirm={run} disabled={running || !g?.available || (g.dirty ?? false)} title={g?.dirty ? 'Commit or discard local changes first' : ''} confirmLabel="Tap again — rebuilds & restarts (~1 min)">
            {running ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />} {st?.updateAvailable ? 'Update now' : 'Reinstall & rebuild'}
          </ConfirmButton>
          <ConfirmButton className="btn btn-ghost ml-auto" onConfirm={restart} confirmLabel="Tap again to restart">
            <RotateCcw size={14} /> Restart server
          </ConfirmButton>
        </div>
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        <p className="mt-3 text-xs text-white/40">
          Update runs <span className="font-mono">git pull --ff-only</span>, <span className="font-mono">npm ci</span>, <span className="font-mono">npm run build</span>, then restarts the service. Your data folder is untouched. Take a backup first if you like.
        </p>
      </section>
      {(log.length > 0 || restarting) && (
        <section className="rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-white/75">
          {log.map((l, i) => (
            <div key={i} className={l.startsWith('✖') ? 'text-red-300' : l.startsWith('✔') ? 'text-emerald-300' : l.startsWith('$') ? 'text-[var(--accent)]' : ''}>
              {l}
            </div>
          ))}
          {restarting && (
            <div className="mt-2 flex items-center gap-2 text-white/60">
              <Loader2 size={12} className="animate-spin" /> Server restarting — this page reloads when it’s back.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
