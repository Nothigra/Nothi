import { Search, Filter, Mail, ExternalLink } from 'lucide-react';
import Input from '../../components/ui/Input';
import './DashboardProducts.css';

const dummyCustomers = [
  { id: 1, buyer: 'Alex Johnson', email: 'alex@example.com', purchases: 12, revenue: '$348.00', lastPurchase: '2h ago', avatar: 'A' },
  { id: 2, buyer: 'Maria Garcia', email: 'maria@example.com', purchases: 5, revenue: '$225.00', lastPurchase: '4h ago', avatar: 'M' },
  { id: 3, buyer: 'James Smith', email: 'james@example.com', purchases: 1, revenue: '$15.00', lastPurchase: '5h ago', avatar: 'J' },
  { id: 4, buyer: 'Emma Wilson', email: 'emma@example.com', purchases: 8, revenue: '$232.00', lastPurchase: '1d ago', avatar: 'E' },
  { id: 5, buyer: 'Noah Taylor', email: 'noah@example.com', purchases: 2, revenue: '$24.00', lastPurchase: '2d ago', avatar: 'N' },
];

export default function DashboardCustomers() {
  return (
    <div className="dashboard-products">
      <div className="flex justify-between items-center mb-2xl">
        <h2 className="text-xl font-bold">Your Customers</h2>
        <button className="btn btn-outline flex-center gap-sm">
          <Mail size={16} /> Message All
        </button>
      </div>

      <div className="glass-card">
        <div className="p-lg border-b flex justify-between items-center">
          <div style={{ width: '300px' }}>
            <Input 
              iconLeft={Search}
              placeholder="Search customers..."
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
                <th className="font-semibold py-md px-xl">Buyer</th>
                <th className="font-semibold py-md px-xl">Email</th>
                <th className="font-semibold py-md px-xl">Purchases</th>
                <th className="font-semibold py-md px-xl">Total Spent</th>
                <th className="font-semibold py-md px-xl">Last Purchase</th>
                <th className="font-semibold py-md px-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dummyCustomers.map((customer) => (
                <tr key={customer.id} className="border-b last:border-0 hover:bg-secondary transition-colors">
                  <td className="py-lg px-xl flex items-center gap-md">
                    <div className="avatar avatar-sm">{customer.avatar}</div>
                    <span className="font-medium">{customer.buyer}</span>
                  </td>
                  <td className="py-lg px-xl text-muted">{customer.email}</td>
                  <td className="py-lg px-xl">{customer.purchases}</td>
                  <td className="py-lg px-xl font-medium text-success">{customer.revenue}</td>
                  <td className="py-lg px-xl text-muted text-sm">{customer.lastPurchase}</td>
                  <td className="py-lg px-xl text-right">
                    <button className="btn-icon mr-sm"><Mail size={18} /></button>
                    <button className="btn-icon"><ExternalLink size={18} /></button>
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
