import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Timer, ArrowRight } from 'lucide-react';
import ProductCard from '../product/ProductCard';
const products = [];
import './DailyDrops.css';

export default function DailyDrops() {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 23, seconds: 59 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const newProducts = products.filter(p => p.isNew).slice(0, 3);

  return (
    <section className="daily-drops">
      <div className="container">
        <div className="drops-wrapper glass-card">
          <div className="drops-header">
            <div className="drops-info">
              <h2 className="section-title">{t('sections.dailyDrops')}</h2>
              <p className="section-desc">{t('sections.dailyDropsDesc')}</p>
            </div>
            
            <div className="countdown-container">
              <span className="countdown-label">{t('sections.nextDrop')}</span>
              <div className="countdown-timer">
                <Timer size={20} className="timer-icon" />
                <div className="time-block">
                  <span className="time-value">{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="time-unit">h</span>
                </div>
                <span className="time-sep">:</span>
                <div className="time-block">
                  <span className="time-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="time-unit">m</span>
                </div>
                <span className="time-sep">:</span>
                <div className="time-block">
                  <span className="time-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  <span className="time-unit">s</span>
                </div>
              </div>
            </div>
          </div>

          <div className="drops-grid">
            {newProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="drops-footer">
            <Link to="/marketplace?filter=new" className="btn btn-outline">
              {t('sections.viewAll')} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
