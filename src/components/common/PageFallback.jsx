/** Shown for the split second a page's code is still loading. */
export default function PageFallback() {
  return (
    <div className="page-fallback" aria-busy="true" aria-label="Loading">
      <div className="loader spin" />
    </div>
  );
}
