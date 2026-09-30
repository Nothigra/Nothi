import AppLibraryPanel from './AppLibraryPanel';
import './AppPages.css';

/** /library — the same list as Profile › Library, as its own screen (e.g. from a product page). */
export default function AppLibraryPage() {
  return <div className="app-page"><AppLibraryPanel /></div>;
}
