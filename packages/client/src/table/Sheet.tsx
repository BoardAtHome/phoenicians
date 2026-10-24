import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

/** A bottom sheet on phones, a centered dialog on wide screens. Tapping outside or Escape closes it. */
export function Sheet({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button type="button" className="round-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
