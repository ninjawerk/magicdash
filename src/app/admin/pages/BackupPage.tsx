import { BackupDialog } from '../../components/Dialogs';
export function BackupPage() {
  return (
    <div className="surface rounded-2xl border border-white/10 p-6">
      <BackupDialog onClose={() => undefined} />
    </div>
  );
}
