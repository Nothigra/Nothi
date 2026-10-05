import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScreenFocus } from '../../lib/screenFocus';

/** iOS/Android-style action sheet that slides up from the bottom. */
export default function AppSheet({ open, onClose, title, children }) {
  // A sheet belongs to its screen: it closes if that screen is left (tabs stay mounted)
  const { active } = useScreenFocus();
  useEffect(() => { if (!active && open) onClose(); }, [active, open, onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || !active) return null;
  return createPortal(
    <div className="app-sheet-backdrop" onClick={onClose}>
      <div className="app-sheet" role="dialog" aria-modal="true" aria-label={title || 'Actions'} onClick={(e) => e.stopPropagation()}>
        <span className="app-sheet-grip" aria-hidden="true" />
        {title && <p className="app-sheet-title">{title}</p>}
        <div className="app-sheet-body">{children}</div>
        <button type="button" className="app-sheet-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}
