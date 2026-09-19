import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  DollarSign, TrendingUp, Package, ShoppingBag, Plus, ExternalLink, 
  Activity, ArrowRight, Settings, BarChart3, CheckCircle2, Circle, Users, Globe, Eye
} from 'lucide-react';
import { Link } from 'react-router';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { orders } from '../../data';
import './DashboardOverview.css';


export default function DashboardOverview() {
  const { profile, isMockMode } = useAuth();
  const { formatPrice } = useCurrency();
  const [timeRange, setTimeRange] = useState('30d');
  const [realProducts, setRealProducts] = useState([]);
  const [realOrders, setRealOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (isMockMode || !profile?.id) return;
      
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('*').eq('seller_id', profile.id),
        supabase.from('purchases')
          .select('id, purchased_at, price_paid, status, product:products(title), buyer:public_profiles!buyer_id(username, avatar_url)')
          .eq('seller_id', profile.id)
          .order('purchased_at', { ascending: false })
          .limit(4)
      ]);

      if (productsRes.data) setRealProducts(productsRes.data);
      if (ordersRes.data) setRealOrders(ordersRes.data);
      setLoadingOrders(false);
    };

    fetchData();
  }, [profile?.id, isMockMode]);

  const products = isMockMode ? (profile?.products || []) : realProducts;
  const displayOrders = isMockMode ? orders : realOrders.map(o => ({
    id: o.id,
    product: o.product?.title || 'Unknown Product',
    customer: o.buyer?.username || 'Guest',
    email: o.buyer?.email || '',
    date: o.purchased_at,
    amount: o.price_paid,
    status: o.status
  }));
  const totalSales = products.reduce((sum, p) => sum + (p.sales_count || 0), 0);
  const totalRevenue = products.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
  const balance = (profile?.balance || 0) / 100;

  const sortedTopProducts = useMemo(() => {
    return [...products].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 5);
  }, [products]);

  // Calculate completion percentage
  const steps = [
    { id: 'profile', label: 'Complete profile', done: !!profile?.username },
    { id: 'payment', label: 'Connect payouts', done: false }, // Mock
    { id: 'product', label: 'Publish first product', done: products.length > 0 },
    { id: 'sale', label: 'Make first sale', done: totalSales > 0 }
  ];
  const completedSteps = steps.filter(s => s.done).length;
  const completionPercentage = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="dashboard-overview">
      {/* Premium Hero */}
      <div className="premium-hero">
        <div>
          <h1 className="dashboard-title text-3xl mb-xs">Welcome back, {profile?.username || 'Creator'}</h1>
          <p className="text-secondary text-lg">Your store is ready. You have {products.length} published products and 0 pending payouts.</p>
        </div>
        
        <div className="hero-stats-row">
          <div className="hero-stat">
            <span className="text-sm text-secondary">Total Revenue</span>
            <span className="text-2xl font-bold">{formatPrice(totalRevenue)}</span>
          </div>
          <div className="hero-stat">
            <span className="text-sm text-secondary">Available Balance</span>
            <span className="text-2xl font-bold">{formatPrice(balance)}</span>
          </div>
          <div className="hero-stat">
            <span className="text-sm text-secondary">Total Sales</span>
            <span className="text-2xl font-bold">{totalSales}</span>
          </div>
        </div>
      </div>

      {/* Premium Stats Grid */}
      <div className="stats-grid mb-2xl">
        <div className="premium-stat-card">
          <div className="flex justify-between items-start mb-md">
            <div className="stat-icon-wrapper text-accent bg-accent-subtle">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-sm text-secondary mb-xs">Net Revenue</p>
          <h3 className="text-3xl font-bold">{formatPrice(totalRevenue)}</h3>
        </div>

        <div className="premium-stat-card">
          <div className="flex justify-between items-start mb-md">
            <div className="stat-icon-wrapper text-accent bg-accent-subtle">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="text-sm text-secondary mb-xs">Total Orders</p>
          <h3 className="text-3xl font-bold">{totalSales}</h3>
        </div>

        <div className="premium-stat-card">
          <div className="flex justify-between items-start mb-md">
            <div className="stat-icon-wrapper text-accent bg-accent-subtle">
              <Eye size={20} />
            </div>
          </div>
          <p className="text-sm text-secondary mb-xs">Product Views</p>
          <h3 className="text-3xl font-bold">{totalViews}</h3>
        </div>

        <div className="premium-stat-card">
          <div className="flex justify-between items-start mb-md">
            <div className="stat-icon-wrapper text-accent bg-accent-subtle">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-sm text-secondary mb-xs">Conversion Rate</p>
          <h3 className="text-3xl font-bold">{totalViews > 0 ? ((totalSales / totalViews) * 100).toFixed(1) : '0.0'}%</h3>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-lg">
        <div>
          <h3 className="text-xl font-bold">Performance Analytics</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl mb-2xl">
        {/* Main Chart */}
        <div className="settings-card m-0 lg:col-span-3">
          <div className="card-header border-b border-border pb-md mb-lg">
            <h3 className="card-title text-base flex items-center gap-xs"><Activity size={18} className="text-accent" /> Sales & Views (Lifetime)</h3>
          </div>
          <div className="flex flex-col gap-lg py-md px-sm">
            <div className="flex items-center gap-md">
              <div className="w-20 text-sm font-medium text-secondary">Views</div>
              <div className="flex-1 h-8 bg-bg-tertiary rounded-md overflow-hidden relative">
                <div className="h-full bg-text-tertiary transition-all duration-1000" style={{ width: `${totalViews === 0 && totalSales === 0 ? 0 : Math.max(2, (totalViews / Math.max(1, totalViews + totalSales)) * 100)}%` }}></div>
              </div>
              <div className="w-16 text-right font-bold text-lg">{totalViews}</div>
            </div>
            <div className="flex items-center gap-md">
              <div className="w-20 text-sm font-medium text-secondary">Sales</div>
              <div className="flex-1 h-8 bg-bg-tertiary rounded-md overflow-hidden relative">
                <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${totalViews === 0 && totalSales === 0 ? 0 : Math.max(2, (totalSales / Math.max(1, totalViews + totalSales)) * 100)}%` }}></div>
              </div>
              <div className="w-16 text-right font-bold text-lg">{totalSales}</div>
            </div>
          </div>
        </div>

        {/* Per-Product Performance Table */}
        <div className="settings-card m-0 lg:col-span-3 mb-2xl">
          <div className="card-header border-b border-border pb-md mb-0">
            <h3 className="card-title text-base flex items-center gap-xs"><Package size={18} className="text-secondary" /> Per-Product Performance</h3>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="dashboard-table w-full">
                <thead>
                  <tr>
                    <th className="pl-xl">Product</th>
                    <th className="text-right">Views</th>
                    <th className="text-right">Sales</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right pr-xl">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-xl text-secondary italic">No products yet.</td>
                    </tr>
                  )}
                  {products.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).map(p => {
                    const views = p.views || 0;
                    const sales = p.sales_count || 0;
                    const revenue = p.revenue || 0;
                    const conv = views > 0 ? ((sales / views) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={p.id}>
                        <td className="pl-xl py-md font-medium">{p.title}</td>
                        <td className="text-right py-md">{views}</td>
                        <td className="text-right py-md text-accent font-medium">{sales}</td>
                        <td className="text-right py-md">{formatPrice(revenue)}</td>
                        <td className="text-right pr-xl py-md text-emerald-500">{conv}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid two-cols mb-2xl">
        {/* Recent Orders */}
        <div className="settings-card m-0 flex flex-col h-full">
          <div className="card-header flex justify-between items-center border-b border-border pb-md mb-0">
            <h3 className="card-title text-lg">Recent Orders</h3>
          </div>
          <div className="card-body p-0 flex-1">
            <table className="dashboard-table w-full">
              <thead>
                <tr>
                  <th className="text-xs uppercase text-secondary font-semibold pl-xl">Product</th>
                  <th className="text-xs uppercase text-secondary font-semibold">Date</th>
                  <th className="text-xs uppercase text-secondary font-semibold pr-xl text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.slice(0, 4).map(o => (
                  <tr key={o.id}>
                    <td className="pl-xl py-md">
                      <div className="font-medium text-sm text-primary">{o.product}</div>
                      <div className="text-xs text-secondary">{o.customer}</div>
                    </td>
                    <td className="text-sm text-secondary py-md">{new Date(o.date).toLocaleDateString()}</td>
                    <td className="text-sm font-medium pr-xl text-right py-md">{formatPrice(o.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Store Completion */}
        <div className="settings-card m-0">
          <div className="card-header border-b border-border pb-md mb-lg">
            <h3 className="card-title text-lg">Store Setup</h3>
          </div>
          <div className="card-body pt-0">
            <div className="flex justify-between items-end mb-sm">
              <span className="text-3xl font-bold">{completionPercentage}%</span>
              <span className="text-sm text-secondary font-medium">Completed</span>
            </div>
            <div className="completion-progress-bar">
              <div className="completion-progress-fill" style={{ width: `${completionPercentage}%` }}></div>
            </div>
            
            <div className="flex flex-col mt-md">
              {steps.map(step => (
                <div key={step.id} className="completion-item py-xs">
                  <div className={`completion-icon ${step.done ? 'done' : 'pending'}`}>
                    {step.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </div>
                  <span className={`text-sm ${step.done ? 'text-secondary line-through' : 'text-primary font-medium'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
