import { useState } from 'react';
import { Search, Filter, MoreVertical, Download, ExternalLink } from 'lucide-react';
import Input from '../../components/ui/Input';
import './DashboardProducts.css'; // Reuse table styles

const dummyOrders = [
  { id: '#ORD-1049', product: 'Cinematic LUTs Vol 1', buyer: 'Alex Johnson', amount: '$29.00', status: 'Completed', date: 'Oct 12, 2026' },
  { id: '#ORD-1048', product: 'Transitions Pack Pro', buyer: 'Maria Garcia', amount: '$45.00', status: 'Refunded', date: 'Oct 12, 2026' },
  { id: '#ORD-1047', product: 'Sound Effects Library', buyer: 'James Smith', amount: '$15.00', status: 'Processing', date: 'Oct 11, 2026' },
  { id: '#ORD-1046', product: 'Cinematic LUTs Vol 1', buyer: 'Emma Wilson', amount: '$29.00', status: 'Completed', date: 'Oct 10, 2026' },
  { id: '#ORD-1045', product: 'Typography Titles', buyer: 'Noah Taylor', amount: '$12.00', status: 'Cancelled', date: 'Oct 09, 2026' },
];

export default function DashboardSales() {
  const [activeTab, setActiveTab] = useState('All');

  const filteredOrders = activeTab === 'All' 
    ? dummyOrders 
    : dummyOrders.filter(o => o.status === activeTab);

  return (
    <div className="dashboard-products">
      <div className="flex justify-between items-center mb-2xl">
        <div className="flex gap-md">
          {['All', 'Completed', 'Processing', 'Refunded', 'Cancelled'].map(tab => (
            <button 
              key={tab}
              className={`dashboard-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <button className="btn btn-outline flex-center gap-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="glass-card">
        <div className="p-lg border-b flex justify-between items-center">
          <div style={{ width: '300px' }}>
            <Input 
              iconLeft={Search}
              placeholder="Search orders..."
              clearable={true}
            />
          </div>
          <button className="btn btn-outline flex-center gap-sm">
            <Filter size={16} /> Filter
          </button>
        </div>

        <div className="table-responsive">
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted text-sm border-b">
                <th className="font-semibold py-md px-xl">Order ID</th>
                <th className="font-semibold py-md px-xl">Product</th>
                <th className="font-semibold py-md px-xl">Buyer</th>
                <th className="font-semibold py-md px-xl">Amount</th>
                <th className="font-semibold py-md px-xl">Status</th>
                <th className="font-semibold py-md px-xl">Date</th>
                <th className="font-semibold py-md px-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-secondary transition-colors">
                  <td className="py-lg px-xl font-medium">{order.id}</td>
                  <td className="py-lg px-xl">{order.product}</td>
                  <td className="py-lg px-xl">{order.buyer}</td>
                  <td className="py-lg px-xl font-medium">{order.amount}</td>
                  <td className="py-lg px-xl">
                    <span className={`status-badge ${
                      order.status === 'Completed' ? 'status-success' : 
                      order.status === 'Processing' ? 'status-warning' : 
                      'status-archived'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-lg px-xl text-muted text-sm">{order.date}</td>
                  <td className="py-lg px-xl text-right">
                    <button className="btn-icon"><ExternalLink size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="p-4xl text-center text-muted">
              No orders found with this status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
