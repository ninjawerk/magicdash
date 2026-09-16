import { ScreensDialog } from '../../components/Dialogs';
export function ScreensPage() {
  return (
    <div className="surface rounded-2xl border border-white/10 p-6">
      <ScreensDialog onClose={() => undefined} />
    </div>
  );
}
