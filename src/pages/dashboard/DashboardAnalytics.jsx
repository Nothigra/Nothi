import { useState } from 'react';
import { 
  Download, TrendingUp, Users, Globe, ShoppingBag, Eye, 
  Heart, ChevronDown, Smartphone, Monitor, ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import './DashboardProducts.css';

const revenueData = [
  { name: 'Mon', current: 4000, previous: 2400 },
  { name: 'Tue', current: 3000, previous: 1398 },
  { name: 'Wed', current: 2000, previous: 9800 },
  { name: 'Thu', current: 2780, previous: 3908 },
  { name: 'Fri', current: 1890, previous: 4800 },
  { name: 'Sat', current: 2390, previous: 3800 },
  { name: 'Sun', current: 3490, previous: 4300 },
];

const trafficSources = [
  { source: 'Direct', visitors: 4200, percentage: 45 },
  { source: 'Google', visitors: 2800, percentage: 30 },
  { source: 'Twitter', visitors: 1500, percentage: 15 },
  { source: 'Other', visitors: 900, percentage: 10 },
];

const topProducts = [
  { name: 'Ultimate UI Kit', revenue: 12450, sales: 249 },
  { name: 'SaaS Dashboard Template', revenue: 8200, sales: 164 },
  { name: 'Framer Motion Course', revenue: 4500, sales: 90 },
];

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
          <h3 className="text-3xl font-bold font-display">$3,420.00</h3>
          <p className="stat-trend positive mt-sm"><TrendingUp size={14} /> +12% vs previous {timeRange}</p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Visitors</p>
          <h3 className="text-3xl font-bold font-display">8,924</h3>
          <p className="stat-trend positive mt-sm"><TrendingUp size={14} /> +24% vs previous {timeRange}</p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Orders</p>
          <h3 className="text-3xl font-bold font-display">342</h3>
          <p className="stat-trend positive mt-sm"><TrendingUp size={14} /> +8% vs previous {timeRange}</p>
        </div>
        <div className="premium-stat-card">
          <p className="text-sm text-secondary font-medium mb-xs uppercase tracking-wider">Conversion</p>
          <h3 className="text-3xl font-bold font-display">3.8%</h3>
          <p className="stat-trend negative mt-sm"><TrendingUp size={14} className="rotate-180" /> -0.2% vs previous {timeRange}</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="settings-card mb-xl m-0">
        <div className="card-header border-b border-border pb-md mb-lg">
          <h3 className="card-title text-lg">Revenue vs Previous Period</h3>
        </div>
        <div style={{ height: '280px', minHeight: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-text-tertiary)" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="var(--color-text-tertiary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--color-text-tertiary)', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--color-text-tertiary)', fontSize: 12}} tickFormatter={v => `$${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="previous" name="Previous" stroke="var(--color-text-tertiary)" fillOpacity={1} fill="url(#colorPrev)" />
              <Area type="monotone" dataKey="current" name="Current" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorCurrent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Secondary Metrics & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl mb-xl">
        {/* Micro Metrics */}
        <div className="lg:col-span-1 grid grid-cols-2 gap-md">
          <div className="settings-card m-0 p-lg flex flex-col justify-center">
            <div className="flex items-center gap-sm text-secondary mb-xs">
              <ShoppingBag size={16} /> <span className="text-xs font-semibold uppercase">Avg Order</span>
            </div>
            <p className="text-2xl font-bold">$28.50</p>
          </div>
          <div className="settings-card m-0 p-lg flex flex-col justify-center">
            <div className="flex items-center gap-sm text-secondary mb-xs">
              <Users size={16} /> <span className="text-xs font-semibold uppercase">Repeat</span>
            </div>
            <p className="text-2xl font-bold">24%</p>
          </div>
          <div className="settings-card m-0 p-lg flex flex-col justify-center">
            <div className="flex items-center gap-sm text-secondary mb-xs">
              <Download size={16} /> <span className="text-xs font-semibold uppercase">Downloads</span>
            </div>
            <p className="text-2xl font-bold">1,204</p>
          </div>
          <div className="settings-card m-0 p-lg flex flex-col justify-center">
            <div className="flex items-center gap-sm text-secondary mb-xs">
              <Heart size={16} /> <span className="text-xs font-semibold uppercase">Favorites</span>
            </div>
            <p className="text-2xl font-bold">342</p>
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="settings-card m-0 lg:col-span-1">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base flex items-center gap-sm"><Globe size={18} className="text-secondary" /> Traffic Sources</h3>
          </div>
          <div className="card-body pt-md px-0 pb-0">
            {trafficSources.map((source, i) => (
              <div key={i} className="flex flex-col gap-xs mb-md px-md">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{source.source}</span>
                  <span className="text-secondary">{source.visitors} ({source.percentage}%)</span>
                </div>
                <div className="w-full bg-bg-tertiary h-2 rounded-full overflow-hidden">
                  <div className="bg-accent h-full rounded-full" style={{ width: `${source.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="settings-card m-0 lg:col-span-1">
          <div className="card-header pb-md border-b border-border flex justify-between items-center">
            <h3 className="card-title text-base">Top Products</h3>
            <button className="text-xs text-accent hover:underline">View All</button>
          </div>
          <div className="card-body p-0">
            {topProducts.map((product, i) => (
              <div key={i} className="flex justify-between items-center p-md border-b border-border last:border-0 hover:bg-bg-tertiary transition-colors cursor-pointer">
                <div>
                  <h4 className="font-medium text-sm text-primary mb-[2px]">{product.name}</h4>
                  <p className="text-xs text-secondary">{product.sales} sales</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm block">${(product.revenue / 100).toFixed(2)}</span>
                  <ChevronRight size={14} className="text-tertiary inline-block mt-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Funnel & Devices Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
        <div className="settings-card m-0">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base">Sales Funnel</h3>
          </div>
          <div className="card-body flex justify-around items-end h-[200px] pt-xl pb-sm">
            <div className="flex flex-col items-center gap-sm w-1/3">
              <div className="w-full bg-accent-subtle rounded-t-lg relative" style={{ height: '100%' }}>
                <div className="absolute top-sm left-0 w-full text-center text-accent font-bold">8.9k</div>
              </div>
              <span className="text-xs font-semibold uppercase text-secondary">Visitors</span>
            </div>
            <div className="flex flex-col items-center gap-sm w-1/3">
              <div className="w-full bg-accent rounded-t-lg opacity-80 relative" style={{ height: '40%' }}>
                <div className="absolute -top-xl left-0 w-full text-center font-bold">1.2k</div>
              </div>
              <span className="text-xs font-semibold uppercase text-secondary">Added to Cart</span>
            </div>
            <div className="flex flex-col items-center gap-sm w-1/3">
              <div className="w-full bg-accent rounded-t-lg relative" style={{ height: '15%' }}>
                <div className="absolute -top-xl left-0 w-full text-center font-bold">342</div>
              </div>
              <span className="text-xs font-semibold uppercase text-secondary">Purchased</span>
            </div>
          </div>
        </div>

        <div className="settings-card m-0">
          <div className="card-header pb-md border-b border-border">
            <h3 className="card-title text-base">Devices</h3>
          </div>
          <div className="card-body flex items-center justify-center h-[200px]">
            <div className="w-1/2 pr-lg border-r border-border text-center">
              <Monitor size={32} className="mx-auto text-accent mb-sm" />
              <h4 className="text-2xl font-bold mb-xs">68%</h4>
              <p className="text-sm text-secondary uppercase font-semibold">Desktop</p>
            </div>
            <div className="w-1/2 pl-lg text-center">
              <Smartphone size={32} className="mx-auto text-secondary mb-sm" />
              <h4 className="text-2xl font-bold mb-xs">32%</h4>
              <p className="text-sm text-secondary uppercase font-semibold">Mobile</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
