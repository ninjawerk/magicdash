import { X } from 'lucide-react';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

/** When true, Modal renders as a plain panel (used by the admin pages to embed dialog content). */
export const InlineModalContext = createContext(false);

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const inline = useContext(InlineModalContext);
  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, inline]);

  if (inline) {
    return (
      <div className="flex flex-col">
        <div className="px-1 pb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
        </div>
        <div className="select-text">{children}</div>
        {footer && <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/10 pt-4">{footer}</div>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className="surface w-full max-h-[92vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost -mr-2 -mt-1 p-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-4 overflow-y-auto select-text">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
