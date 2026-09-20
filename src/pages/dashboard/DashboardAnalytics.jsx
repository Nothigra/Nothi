import { useState } from 'react';
import { Download, ChevronDown, Globe, BarChart3 } from 'lucide-react';
import './DashboardProducts.css';

export default function DashboardAnalytics() {
  const [timeRange, setTimeRange] = useState('30d');

  return (
    <div className="dashboard-analytics pb-2xl">
      <div className="dashboard-page-header flex flex-col md:flex-row md:items-end justify-between mb-xl">
        <div>
          <h1 className="dashboard-title">Analytics Overview</h1>
          <p className="dashboard-subtitle">Track your store performance and traffic.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-md items-start md:items-center mt-md md:mt-0">
          <div className="segmented-tabs m-0">
            {['Today', '7d', '30d', '90d', '12m', 'All'].map(tab => (
              <button 
                key={tab}
                className={`segmented-tab ${timeRange === tab ? 'active' : ''}`}
                onClick={() => setTimeRange(tab)}
              >
                {tab === 'All' ? 'Lifetime' : tab}
              </button>
            ))}
          </div>
          
          <div className="dropdown-wrapper">
            <button className="btn btn-outline flex-center gap-sm bg-card">
              <Download size={16} /> Export <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="stats-grid mb-xl" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Revenue</p>
          <h3 className="text-3xl font-bold font-display">$0.00</h3>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Orders</p>
          <h3 className="text-3xl font-bold font-display">0</h3>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Downloads</p>
          <h3 className="text-3xl font-bold font-display">0</h3>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Favorites</p>
          <h3 className="text-3xl font-bold font-display">0</h3>
        </div>
      </div>

      {/* Revenue Chart — empty state (no historical/time-series data collected yet) */}
      <div className="settings-card mb-xl m-0">
        <div className="card-header border-b border-border pb-md mb-lg">
          <h3 className="card-title text-lg">Revenue Over Time</h3>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-2xl px-lg" style={{ minHeight: '240px' }}>
          <BarChart3 size={32} className="text-tertiary mb-md" />
          <p className="font-semibold mb-xs">No sales yet</p>
          <p className="text-sm text-secondary">Your revenue chart will appear here once you make your first sale.</p>
        </div>
      </div>
      
      {/* Secondary Metrics & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl mb-xl">
        {/* Traffic Sources */}
        <div className="settings-card m-0">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base flex items-center gap-sm"><Globe size={18} className="text-secondary" /> Traffic Sources</h3>
          </div>
          <div className="card-body flex flex-col items-center justify-center text-center py-xl px-lg text-secondary text-sm">
            Traffic source tracking isn't available yet.
          </div>
        </div>

        {/* Top Products */}
        <div className="settings-card m-0">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base">Top Products</h3>
          </div>
          <div className="card-body flex flex-col items-center justify-center text-center py-xl px-lg text-secondary text-sm">
            You don't have any published products yet.
          </div>
        </div>
      </div>

    </div>
  );
}
