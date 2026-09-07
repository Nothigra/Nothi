import { useTranslation } from 'react-i18next';
import { Bell, ShoppingBag, Heart, Star, MessageSquare } from 'lucide-react';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const { t } = useTranslation();

  const notifications = [
    { id: 1, type: 'sale', title: 'New Sale!', desc: 'Alex Rivera bought "Cinematic LUTs"', time: '2 hours ago', icon: ShoppingBag, color: '#10B981', read: false },
    { id: 2, type: 'review', title: 'New Review', desc: 'Sarah Chen left a 5-star review', time: '5 hours ago', icon: Star, color: '#F59E0B', read: false },
    { id: 3, type: 'message', title: 'New Message', desc: 'You have a message from Nothi Support', time: '1 day ago', icon: MessageSquare, color: '#3B82F6', read: true },
    { id: 4, type: 'wishlist', title: 'Wishlist Alert', desc: 'A product in your wishlist is on sale', time: '2 days ago', icon: Heart, color: '#EF4444', read: true },
  ];

  return (
    <div className="container py-2xl max-w-3xl">
      <div className="flex justify-between items-center mb-2xl">
        <h1 className="page-title flex items-center gap-md">
          <Bell size={28} /> {t('nav.notifications')}
        </h1>
        <button className="btn btn-outline btn-sm">Mark all as read</button>
      </div>

      <div className="notifications-list flex flex-col gap-md">
        {notifications.map(notif => {
          const Icon = notif.icon;
          return (
            <div key={notif.id} className={`notification-card glass-card ${!notif.read ? 'unread' : ''}`}>
              {!notif.read && <div className="unread-indicator"></div>}
              
              <div className="notif-icon-wrapper" style={{ backgroundColor: `${notif.color}15`, color: notif.color }}>
                <Icon size={20} />
              </div>
              
              <div className="notif-content flex-1">
                <div className="flex justify-between items-start mb-xs">
                  <h3 className="font-semibold">{notif.title}</h3>
                  <span className="text-xs text-muted">{notif.time}</span>
                </div>
                <p className="text-sm text-secondary">{notif.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
