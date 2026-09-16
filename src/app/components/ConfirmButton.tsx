import { useEffect, useState, type ReactNode } from 'react';

/**
 * Two-tap confirmation that works everywhere (window.confirm is blocked in some embedded browsers and awkward on
 * touch kiosks): first tap arms the button and shows `confirmLabel`, a second tap within 4 s runs `onConfirm`.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Tap again to confirm',
  className = 'btn btn-ghost',
  armedClassName = 'btn bg-red-500/30 text-red-100 border border-red-400/40',
  title,
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: ReactNode;
  className?: string;
  armedClassName?: string;
  title?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={armed ? armedClassName : className}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
