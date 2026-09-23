import { useState, useEffect } from 'react';
import { Download, ChevronDown, Globe, BarChart3, Monitor, Smartphone, Tablet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { getSellerAnalytics } from '../../api/analyticsApi';
import './DashboardProducts.css';

const RANGES = ['Today', '7d', '30d', '90d', '12m', 'All'];

const SOURCE_LABELS = {
  direct: 'Direct',
  google: 'Search',
  social: 'Social',
  other: 'Other',
};

export default function DashboardAnalytics() {
  const { profile, isMockMode } = useAuth();
  const { formatPrice } = useCurrency();
  const [timeRange, setTimeRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (isMockMode || !profile?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const result = await getSellerAnalytics(profile.id, timeRange);
      if (isMounted) {
        setData(result);
        setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [profile?.id, isMockMode, timeRange]);

  const totalViews = data?.totalViews || 0;
  const totalRevenue = data?.totalRevenue || 0;
  const totalOrders = data?.totalOrders || 0;
  const conversionRate = data?.conversionRate || 0;
  const hasAnyData = data?.hasAnyData || false;
  const sourceTotals = data?.sourceTotals || { direct: 0, google: 0, social: 0, other: 0 };
  const deviceTotals = data?.deviceTotals || { mobile: 0, desktop: 0, tablet: 0 };
  const revenueChart = data?.revenueChart || [];
  const topProducts = data?.topProducts || [];

  const totalSourceViews = Object.values(sourceTotals).reduce((a, b) => a + b, 0);
  const totalDeviceViews = Object.values(deviceTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="dashboard-analytics pb-2xl">
      <div className="dashboard-page-header flex flex-col md:flex-row md:items-end justify-between mb-xl">
        <div>
          <h1 className="dashboard-title">Analytics Overview</h1>
          <p className="dashboard-subtitle">Track your store performance and traffic.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-md items-start md:items-center mt-md md:mt-0">
          <div className="segmented-tabs m-0">
            {RANGES.map(tab => (
              <button 
                key={tab}
                className={`segmented-tab ${timeRange === tab ? 'active' : ''}`}
                onClick={() => setTimeRange(tab)}
              >
                {tab === 'All' ? 'Lifetime' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="stats-grid mb-xl" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Revenue</p>
          <h3 className="text-3xl font-bold font-display">{formatPrice(totalRevenue)}</h3>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Orders</p>
          <h3 className="text-3xl font-bold font-display">{totalOrders}</h3>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Views</p>
          <h3 className="text-3xl font-bold font-display">{totalViews}</h3>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Conversion</p>
          <h3 className="text-3xl font-bold font-display">{conversionRate.toFixed(1)}%</h3>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="settings-card mb-xl m-0">
        <div className="card-header border-b border-border pb-md mb-lg">
          <h3 className="card-title text-lg">Revenue Over Time</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-2xl">
            <div className="loader spin" />
          </div>
        ) : revenueChart.length > 0 ? (
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} tickFormatter={v => formatPrice(v)} />
                <Tooltip
                  formatter={(value) => formatPrice(value)}
                  contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-accent)" strokeWidth={2} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-2xl px-lg" style={{ minHeight: '240px' }}>
            <BarChart3 size={32} className="text-tertiary mb-md" />
            <p className="font-semibold mb-xs">No sales yet</p>
            <p className="text-sm text-secondary">Your revenue chart will appear here once you make your first sale.</p>
          </div>
        )}
      </div>
      
      {/* Secondary Metrics & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl mb-xl">
        {/* Traffic Sources */}
        <div className="settings-card m-0">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base flex items-center gap-sm"><Globe size={18} className="text-secondary" /> Traffic Sources</h3>
          </div>
          {totalSourceViews > 0 ? (
            <div className="card-body pt-md px-md pb-md">
              {Object.entries(sourceTotals).map(([key, count]) => {
                const pct = totalSourceViews > 0 ? Math.round((count / totalSourceViews) * 100) : 0;
                return (
                  <div key={key} className="flex flex-col gap-xs mb-md">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{SOURCE_LABELS[key]}</span>
                      <span className="text-secondary">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-bg-tertiary h-2 rounded-full overflow-hidden">
                      <div className="bg-accent h-full rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-body flex flex-col items-center justify-center text-center py-xl px-lg text-secondary text-sm">
              No visits recorded yet for this period.
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="settings-card m-0">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base">Devices</h3>
          </div>
          {totalDeviceViews > 0 ? (
            <div className="card-body flex items-center justify-around py-lg">
              <div className="flex flex-col items-center gap-xs">
                <Smartphone size={22} className="text-secondary" />
                <span className="font-bold">{Math.round((deviceTotals.mobile / totalDeviceViews) * 100)}%</span>
                <span className="text-xs text-tertiary uppercase">Mobile</span>
              </div>
              <div className="flex flex-col items-center gap-xs">
                <Monitor size={22} className="text-secondary" />
                <span className="font-bold">{Math.round((deviceTotals.desktop / totalDeviceViews) * 100)}%</span>
                <span className="text-xs text-tertiary uppercase">Desktop</span>
              </div>
              <div className="flex flex-col items-center gap-xs">
                <Tablet size={22} className="text-secondary" />
                <span className="font-bold">{Math.round((deviceTotals.tablet / totalDeviceViews) * 100)}%</span>
                <span className="text-xs text-tertiary uppercase">Tablet</span>
              </div>
            </div>
          ) : (
            <div className="card-body flex flex-col items-center justify-center text-center py-xl px-lg text-secondary text-sm">
              No visits recorded yet for this period.
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="settings-card m-0">
        <div className="card-header pb-md border-b border-border">
          <h3 className="card-title text-base">Top Products</h3>
        </div>
        {topProducts.length > 0 ? (
          <div className="card-body p-0">
            {topProducts.map((p, i) => (
              <div key={i} className="flex justify-between items-center p-md border-b border-border last:border-0">
                <span className="font-medium text-sm">{p.name}</span>
                <span className="font-bold text-sm">{formatPrice(p.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-body flex flex-col items-center justify-center text-center py-xl px-lg text-secondary text-sm">
            {hasAnyData ? 'No sales yet for this period.' : "You don't have any published products yet."}
          </div>
        )}
      </div>
    </div>
  );
}
