import { isNativeApp } from '../../lib/native';

/** Shown for the split second a page's code is still loading. */
export default function PageFallback() {
  return (
    <div className="page-fallback" aria-busy="true" aria-label="Loading">
      {isNativeApp
        ? <span className="nothi-dots"><i /><i /><i /></span>
        : <div className="loader spin" />}
    </div>
  );
}
