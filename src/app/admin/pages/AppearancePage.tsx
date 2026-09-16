import { ThemeDialog } from '../../components/Dialogs';
export function AppearancePage() {
  return (
    <div className="surface rounded-2xl border border-white/10 p-6">
      <ThemeDialog onClose={() => undefined} />
    </div>
  );
}
