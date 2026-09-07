import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, Check, TrendingUp, Sparkles } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import './BoostModal.css';

const BOOST_PLANS = [
  { 
    id: '24h', 
    days: 1, 
    title: '24 Hours', 
    price: 2.99, 
    desc: 'Perfect for launching a new product.' 
  },
  { 
    id: '3d', 
    days: 3, 
    title: '3 Days', 
    price: 4.99, 
    desc: 'Great for increasing visibility.' 
  },
  { 
    id: '7d', 
    days: 7, 
    title: '7 Days', 
    price: 6.99, 
    desc: 'Ideal for maximizing exposure.', 
    recommended: true 
  }
];

export default function BoostModal({ isOpen, onClose, product, onBoost }) {
  const [selectedPlanId, setSelectedPlanId] = useState('7d');
  const [isProcessing, setIsProcessing] = useState(false);
  const { formatPrice } = useCurrency();
  const { profile } = useAuth();

  if (!isOpen || !product) return null;

  const isBoosted = profile?.isMockMode 
    ? (product.boost && new Date(product.boost.endDate) > new Date())
    : (product.boosted_until && new Date(product.boosted_until) > new Date());

  const endDate = isBoosted ? new Date(profile?.isMockMode ? product.boost.endDate : product.boosted_until) : null;

  // Future-proof function for applying creator discounts
  const getPrice = (plan) => {
    return plan.price; 
  };

  const handleActivate = async () => {
    setIsProcessing(true);
    const plan = BOOST_PLANS.find(p => p.id === selectedPlanId);
    
    // Simulate payment/processing delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.days);

    const boostData = {
      active: true,
      type: "marketplace",
      plan: plan.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      priority: 1
    };

    onBoost(product.id, boostData);
    setIsProcessing(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div 
          className="boost-modal"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>

          <div className="boost-modal-header">
            <div className="boost-icon-wrapper">
              <Rocket size={24} className="text-accent" />
            </div>
            <h2>{isBoosted ? 'Product Currently Boosted' : 'Boost Product Visibility'}</h2>
            <p className="text-muted">
              {isBoosted 
                ? `"${product.title?.en || product.title || 'This product'}" is already receiving increased visibility in the Marketplace.`
                : `Select a duration to temporarily elevate "${product.title?.en || product.title || 'this product'}" in the Marketplace and Featured sections.`
              }
            </p>
          </div>

          {isBoosted ? (
            <div className="p-xl text-center flex flex-col items-center">
              <div className="bg-success-subtle text-success p-md rounded-full mb-md">
                <Check size={32} />
              </div>
              <h3 className="font-bold text-lg mb-xs">Boost Active</h3>
              <p className="text-secondary mb-xl">
                Boost expires on {endDate.toLocaleDateString()} at {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </p>
              <button className="btn btn-outline w-full" onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              <div className="boost-plans">
            {BOOST_PLANS.map(plan => {
              const price = getPrice(plan);
              const isSelected = selectedPlanId === plan.id;
              
              return (
                <div 
                  key={plan.id}
                  className={`boost-plan-card ${isSelected ? 'selected' : ''} ${plan.recommended ? 'recommended' : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  {plan.recommended && <div className="recommended-badge"><Sparkles size={12} /> BEST VALUE</div>}
                  <div className="plan-radio">
                    <div className="radio-circle">
                      {isSelected && <div className="radio-dot" />}
                    </div>
                  </div>
                  <div className="plan-content">
                    <div className="plan-title-row">
                      <span className="plan-title">{plan.title}</span>
                      <span className="plan-price">{formatPrice(price)}</span>
                    </div>
                    <p className="plan-desc">{plan.desc}</p>
                    {isSelected && (
                      <motion.div 
                        className="plan-perks"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <div className="perk"><TrendingUp size={14} /> Increased Marketplace visibility</div>
                        <div className="perk"><Check size={14} /> Higher Featured probability</div>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="boost-modal-footer">
            <p className="boost-disclaimer">
              Boosted products receive higher visibility in Marketplace listings and Featured sections during the selected period.
            </p>
            <div className="footer-actions">
              <button className="btn btn-outline" onClick={onClose} disabled={isProcessing}>Cancel</button>
              <button className="btn btn-primary flex-center gap-sm" onClick={handleActivate} disabled={isProcessing}>
                {isProcessing ? 'Activating...' : 'Activate Boost'} <Rocket size={16} />
              </button>
            </div>
          </div>
        </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
