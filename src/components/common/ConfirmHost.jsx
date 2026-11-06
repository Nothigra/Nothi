import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmHost.css';

/**
 * In-site confirmation dialog (replaces window.confirm, which looks out of
 * place and is blocked in some in-app browsers).
 *
 *   if (await askConfirm({ title: 'Delete this product?', confirmLabel: 'Delete', danger: true })) …
 *
 * <ConfirmHost /> is mounted once in AppRoot.
 */
let open = null;

export function askConfirm(options) {
  if (!open) return Promise.resolve(window.confirm(options?.title || 'Are you sure?'));
  return new Promise((resolve) => open({ ...options, resolve }));
}

/** In-site replacement for window.alert: one message, one OK button. */
export function notify(message, title = 'Something went wrong') {
  if (!open) { window.alert(message); return Promise.resolve(true); }
  return new Promise((resolve) => open({ title, message, confirmLabel: 'OK', single: true, resolve }));
}

export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  const okRef = useRef(null);

  useEffect(() => {
    open = (r) => setReq(r);
    return () => { open = null; };
  }, []);

  const close = (value) => {
    req?.resolve(value);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return undefined;
    okRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;
  return createPortal(
    <div className="nb-confirm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="nb-confirm" role="alertdialog" aria-modal="true" aria-labelledby="nb-confirm-title">
        <h2 id="nb-confirm-title">{req.title || 'Are you sure?'}</h2>
        {req.message && <p>{req.message}</p>}
        <div className="nb-confirm-actions">
          {!req.single && <button type="button" className="btn btn-secondary" onClick={() => close(false)}>{req.cancelLabel || 'Cancel'}</button>}
          <button
            type="button"
            ref={okRef}
            className={`btn ${req.danger ? 'nb-confirm-danger' : 'btn-primary'}`}
            onClick={() => close(true)}
          >
            {req.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
