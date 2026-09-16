import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowUpCircle,
  DatabaseBackup,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Palette,
  Puzzle,
  ScrollText,
  Settings,
  Shield,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { applyTheme, normalizeTheme } from '../lib/themes';
import { InlineModalContext } from '../components/Modal';
import { Dialogs } from '../components/Dialogs';
import { OverviewPage } from './pages/OverviewPage';
import { LayoutPage } from './pages/LayoutPage';
import { ScreensPage } from './pages/ScreensPage';
import { PluginsPage } from './pages/PluginsPage';
import { AppearancePage } from './pages/AppearancePage';
import { BackupPage } from './pages/BackupPage';
import { LogsPage } from './pages/LogsPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { SettingsPage } from './pages/SettingsPage';

export type Route = 'overview' | 'layout' | 'screens' | 'plugins' | 'appearance' | 'backup' | 'logs' | 'updates' | 'settings';

const NAV: Array<{ id: Route; label: string; icon: typeof Activity; group?: string }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'layout', label: 'Layout', icon: LayoutDashboard },
  { id: 'screens', label: 'Screens', icon: Layers },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'backup', label: 'Backup', icon: DatabaseBackup, group: 'System' },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'updates', label: 'Updates', icon: ArrowUpCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function routeFromPath(): Route {
  const seg = window.location.pathname.replace(/^\/admin\/?/, '').split('/')[0] as Route;
  return NAV.some((n) => n.id === seg) ? seg : 'overview';
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(routeFromPath);
  useEffect(() => {
    const onPop = () => setRoute(routeFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = (r: Route) => {
    window.history.pushState({}, '', r === 'overview' ? '/admin' : `/admin/${r}`);
    setRoute(r);
  };
  return [route, go];
}

export function AdminApp() {
  const { layout, auth, setEditMode } = useStore();
  const [route, go] = useRoute();

  useEffect(() => {
    document.title = 'MagicDash admin';
    if (layout) applyTheme(normalizeTheme(layout.theme));
  }, [layout?.theme, layout]);

  // Edit mode is only meaningful on the Layout page.
  useEffect(() => {
    setEditMode(route === 'layout' && auth.authenticated);
  }, [route, auth.authenticated, setEditMode]);

  if (!auth.loaded || !layout) {
    return (
      <Center>
        <Loader2 className="animate-spin text-white/50" />
      </Center>
    );
  }
  if (!auth.configured) return <SetupScreen />;
  if (!auth.authenticated) return <LoginScreen />;

  const page: Record<Route, ReactNode> = {
    overview: <OverviewPage go={go} />,
    layout: <LayoutPage />,
    screens: <ScreensPage />,
    plugins: <PluginsPage />,
    appearance: <AppearancePage />,
    backup: <BackupPage />,
    logs: <LogsPage />,
    updates: <UpdatesPage />,
    settings: <SettingsPage />,
  };
  const current = NAV.find((n) => n.id === route)!;

  return (
    <InlineModalContext.Provider value={true}>
      <div className="flex h-full w-full overflow-hidden text-[15px]">
        <Sidebar route={route} go={go} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="surface flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-6">
            <current.icon size={18} className="text-[var(--accent)]" />
            <h1 className="text-base font-semibold">{current.label}</h1>
            <span className="ml-auto text-xs text-white/40">MagicDash admin</span>
          </header>
          <div className={`min-h-0 flex-1 overflow-y-auto ${route === 'layout' ? 'p-4' : 'p-6'}`}>
            <div className={route === 'layout' ? 'h-full' : 'mx-auto max-w-4xl'}>{page[route]}</div>
          </div>
        </main>
        <Dialogs />
      </div>
    </InlineModalContext.Provider>
  );
}

function Sidebar({ route, go }: { route: Route; go: (r: Route) => void }) {
  const { logout } = useStore();
  return (
    <aside className="surface flex w-60 shrink-0 flex-col border-r border-white/10">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[#0b0f17]">
          <Shield size={16} />
        </span>
        <div>
          <div className="text-sm font-bold leading-tight">MagicDash</div>
          <div className="text-[11px] text-white/40">Admin</div>
        </div>
      </div>
      <nav className="flex-1 px-3">
        {NAV.map((n, i) => (
          <div key={n.id}>
            {n.group && <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">{n.group}</div>}
            {i === 0 && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Dashboard</div>}
            <button
              onClick={() => go(n.id)}
              className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                route === n.id ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <n.icon size={16} /> {n.label}
            </button>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <a href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <ExternalLink size={16} /> Open dashboard
        </a>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full items-center justify-center p-6">{children}</div>;
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Center>
      <div className="surface w-full max-w-sm rounded-2xl border border-white/10 p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[#0b0f17]">
            <Shield size={18} />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            <p className="text-sm text-white/50">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </Center>
  );
}

function SetupScreen() {
  const { setup } = useStore();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setErr('Passwords don’t match.');
    setBusy(true);
    setErr(undefined);
    try {
      await setup(pw);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Welcome to MagicDash" subtitle="Set an admin password to protect this dashboard.">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="password" autoFocus placeholder="New password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" placeholder="Repeat password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={busy || pw.length < 6}>
          {busy && <Loader2 className="animate-spin" size={14} />} Set password & continue
        </button>
        <p className="text-xs text-white/40">
          The kiosk view stays public on your network; editing and the admin panel need this password. Lost it? Run <code className="font-mono">npm run set-password</code> on the Pi.
        </p>
      </form>
    </AuthCard>
  );
}

function LoginScreen() {
  const { login } = useStore();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    try {
      await login(pw);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Sign in" subtitle="MagicDash admin">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="password" autoFocus placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-xs text-red-300">{err}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={busy || !pw}>
          {busy && <Loader2 className="animate-spin" size={14} />} Sign in
        </button>
        <a href="/" className="block text-center text-xs text-white/40 hover:text-white/70">
          Back to the dashboard
        </a>
      </form>
    </AuthCard>
  );
}
