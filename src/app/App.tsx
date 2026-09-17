import { StoreProvider, useStore } from './lib/store';
import { Dashboard } from './components/Dashboard';
import { Dialogs } from './components/Dialogs';
import { Toolbar } from './components/Toolbar';
import { AdminApp } from './admin/AdminApp';
import { DisplayLayer, Toasts } from './components/Overlays';
import { BackgroundLayer } from './components/BackgroundLayer';

function Shell() {
  const { layout, error, editMode } = useStore();
  // With several screens, the screen tabs (edit) / dots (view) live in a strip above the grid instead of over the tiles.
  const multi = (layout?.screens.length ?? 0) > 1;
  const topInset = multi ? (editMode ? 60 : 26) : 0;


  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">Can't reach the MagicDash server</h1>
          <p className="mt-2 text-white/50 text-sm">{error} — retrying…</p>
          <p className="mt-4 text-white/40 text-xs">
            Is it running? <code className="font-mono">npm run dev</code> or <code className="font-mono">npm start</code>
          </p>
        </div>
      </div>
    );
  }
  if (!layout) return <div className="flex h-full items-center justify-center text-white/30 text-sm">Loading…</div>;

  return (
    <div className="relative h-full w-full">
      <BackgroundLayer />
      <div className="absolute inset-x-0 bottom-0 transition-[top] duration-300" style={{ top: topInset }}>
        <Dashboard />
      </div>
      <Toolbar />
      <Dialogs />
      <Toasts />
      <DisplayLayer />
    </div>
  );
}

export default function App() {
  const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
  return <StoreProvider>{isAdmin ? <AdminApp /> : <Shell />}</StoreProvider>;
}
