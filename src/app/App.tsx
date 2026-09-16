import { useEffect } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { Dashboard } from './components/Dashboard';
import { Dialogs } from './components/Dialogs';
import { Toolbar } from './components/Toolbar';

function Shell() {
  const { layout, error } = useStore();

  useEffect(() => {
    if (!layout) return;
    const root = document.documentElement;
    root.style.setProperty('--accent', layout.theme.accent);
    root.style.setProperty('--tile-bg', layout.theme.tileBackground);
    root.style.setProperty('--tile-radius', `${layout.theme.tileRadius}px`);
    document.body.style.background = layout.theme.background;
  }, [layout?.theme]);

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
      <Dashboard />
      <Toolbar />
      <Dialogs />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
