import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A bottom sheet on phones, a centered dialog on wide screens. Tapping outside or Escape closes it.
 * Without `onClose` it is a prompt that must be answered.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  className = '',
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`scrim ${onClose ? '' : 'blocking'}`} onClick={onClose}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          {onClose && (
            <button type="button" className="round-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
