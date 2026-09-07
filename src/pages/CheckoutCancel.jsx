import { Link } from 'react-router';
import { XCircle, ArrowLeft, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CheckoutCancel() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--color-bg)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Cancel icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            border: '2px solid rgba(239,68,68,0.25)',
          }}
        >
          <XCircle size={40} style={{ color: '#ef4444' }} />
        </motion.div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
          fontFamily: 'var(--font-display)',
        }}>
          Payment Cancelled
        </h1>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '32px', lineHeight: 1.6 }}>
          No charge was made. Your cart is still saved — you can go back and try again whenever you're ready.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link
            to="/marketplace"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 24px', fontSize: '15px' }}
          >
            <ArrowLeft size={18} />
            Back to Marketplace
          </Link>

          <Link
            to="/"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 24px', fontSize: '15px' }}
          >
            <ShoppingBag size={18} />
            Go Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
