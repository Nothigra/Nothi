import { DownloadCloud, HelpCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import './DashboardProducts.css';

const dummyDownloads = [
  { id: 1, product: 'Minimal Lower Thirds', creator: 'MotionDesign', installedVersion: '1.0.0', latestVersion: '1.2.0', status: 'update-available' },
  { id: 2, product: 'Vintage Film Grains', creator: 'CinePacks', installedVersion: '2.1.0', latestVersion: '2.1.0', status: 'up-to-date' },
  { id: 3, product: 'YouTube Creator Kit', creator: 'DigitalAssets', installedVersion: 'Not Installed', latestVersion: '1.0.5', status: 'not-installed' },
];

export default function DashboardDownloads() {
  return (
    <div className="dashboard-products">
      <div className="mb-2xl">
        <h2 className="text-xl font-bold mb-xs">Your Library</h2>
        <p className="text-muted text-sm">Access and download your purchased digital assets.</p>
      </div>

      <div className="grid-1-col" style={{ display: 'grid', gap: 'var(--space-6)' }}>
        {dummyDownloads.map((item) => (
          <div key={item.id} className="glass-card p-xl flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 'var(--space-6)' }}>
            <div className="flex items-center gap-lg">
              <div style={{ width: '80px', height: '56px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-tertiary)' }}></div>
              <div>
                <h3 className="font-bold text-lg mb-xs">{item.product}</h3>
                <p className="text-muted text-sm">by {item.creator}</p>
                <div className="flex gap-md mt-sm items-center">
                  <span className="text-xs font-semibold px-sm py-xs rounded-full bg-secondary">
                    Latest: v{item.latestVersion}
                  </span>
                  {item.status === 'update-available' && (
                    <span className="text-xs font-semibold px-sm py-xs rounded-full text-warning bg-warning-subtle flex items-center gap-xs">
                      <AlertCircle size={12} /> Update Available
                    </span>
                  )}
                  {item.status === 'up-to-date' && (
                    <span className="text-xs font-semibold px-sm py-xs rounded-full text-success bg-success-subtle flex items-center gap-xs">
                      <CheckCircle2 size={12} /> Up to date
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-md">
              <button className="btn btn-outline flex-center gap-sm">
                <FileText size={16} /> Changelog
              </button>
              <button className="btn btn-outline flex-center gap-sm">
                <HelpCircle size={16} /> Support
              </button>
              <button className="btn btn-primary flex-center gap-sm">
                <DownloadCloud size={16} /> Download {item.status === 'update-available' ? 'Update' : ''}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
