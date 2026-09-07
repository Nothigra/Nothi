import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, Download } from 'lucide-react';
import { orders as mockOrders } from '../../data';
import { formatDate } from '../../utils/helpers';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isMockMode } from '../../lib/supabase';
import './DashboardPages.css';

export default function DashboardOrders() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [realOrders, setRealOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (isMockMode || !profile?.id) {
        setLoading(false);
        return;
      }
      
      const { data } = await supabase.from('purchases')
        .select('id, purchased_at, price_paid, status, product:products(title), buyer:public_profiles!buyer_id(username, avatar_url)')
        .eq('seller_id', profile.id)
        .order('purchased_at', { ascending: false });

      if (data) {
        setRealOrders(data);
      }
      setLoading(false);
    };

    fetchOrders();
  }, [profile, isMockMode]);

  const displayOrders = isMockMode ? mockOrders : realOrders.map(o => ({
    id: o.id,
    product: o.product?.title || 'Unknown Product',
    customer: o.buyer?.username || 'Guest',
    email: o.buyer?.email || '',
    date: o.purchased_at,
    amount: o.price_paid,
    status: o.status
  }));

  const filteredOrders = activeTab === 'all' 
    ? displayOrders 
    : displayOrders.filter(o => o.status === activeTab);

  const getStatusClass = (status) => {
    switch(status) {
      case 'completed': return 'status-success';
      case 'pending': return 'status-warning';
      case 'cancelled': return 'status-error';
      default: return '';
    }
  };

  return (
    <div className="dashboard-orders">
      <div className="dashboard-section glass-card">
        <div className="section-header">
          <div className="tabs-simple">
            <button 
              className={`tab-simple ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              {t('dashboard.allOrders')}
            </button>
            <button 
              className={`tab-simple ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              {t('dashboard.pending')}
            </button>
            <button 
              className={`tab-simple ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              {t('dashboard.completed')}
            </button>
            <button 
              className={`tab-simple ${activeTab === 'cancelled' ? 'active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
            >
              {t('dashboard.cancelled')}
            </button>
          </div>
          
          <div className="flex gap-sm">
            <button className="btn btn-outline btn-sm flex-center gap-sm">
              <Filter size={16} /> Filter
            </button>
            <button className="btn btn-outline btn-sm flex-center gap-sm">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>{t('dashboard.customer')}</th>
                <th>{t('dashboard.product')}</th>
                <th>{t('dashboard.date')}</th>
                <th>{t('dashboard.amount')}</th>
                <th>{t('dashboard.status')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td className="text-muted font-mono">{order.id}</td>
                  <td>
                    <div className="font-medium">{order.customer}</div>
                    <div className="text-xs text-muted">{order.email}</div>
                  </td>
                  <td>{order.product}</td>
                  <td>{formatDate(order.date)}</td>
                  <td className="font-medium">{formatPrice(order.amount)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {t(`dashboard.${order.status}`)}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm">{t('dashboard.viewOrder')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
