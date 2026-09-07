import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Download, ArrowRight, Package, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGamification } from '../context/GamificationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [dots, setDots] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  
  const { gamificationState, refreshState } = useGamification();
  const { profile } = useAuth();
  
  // Capture the XP before the webhook finishes
  const initialXpRef = useRef(gamificationState?.xp);

  // Animated dots while webhook processes
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);

    let isMounted = true;
    let pollCount = 0;
    const MAX_POLLS = 10; // 10 polls * 2 seconds = 20 seconds max

    const pollForWebhookCompletion = async () => {
      if (!profile || !isMounted) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('xp')
          .eq('id', profile.id)
          .single();

        if (data) {
          // If XP has increased from what we knew before checkout, the webhook has processed the purchase!
          // (Or if we didn't know the initial XP, we just fallback to the max timeout)
          if (initialXpRef.current !== undefined && data.xp > initialXpRef.current) {
            if (isMounted) {
              refreshState();
              setIsVerified(true);
            }
            return; // Stop polling
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }

      pollCount++;
      if (pollCount < MAX_POLLS) {
        setTimeout(pollForWebhookCompletion, 2000);
      } else {
        // Fallback: Max wait reached, refresh anyway just in case
        if (isMounted) {
          refreshState();
          setIsVerified(true);
        }
      }
    };

    // Start polling
    setTimeout(pollForWebhookCompletion, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [profile, refreshState]);

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
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            border: '2px solid rgba(16,185,129,0.3)',
          }}
        >
          <CheckCircle2 size={40} style={{ color: '#10b981' }} />
        </motion.div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
          fontFamily: 'var(--font-display)',
        }}>
          Payment Successful!
        </h1>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '8px', lineHeight: 1.6 }}>
          Your purchase is confirmed. Your download will appear in your library shortly.
        </p>

        <div style={{ 
          color: isVerified ? 'var(--color-success)' : 'var(--color-text-tertiary)', 
          fontSize: '13px', 
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          {isVerified ? (
            <><Check size={14} /> Payment verified and rewards updated!</>
          ) : (
            <>Verifying payment with Stripe{dots}</>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link
            to="/dashboard/purchases"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 24px', fontSize: '15px' }}
          >
            <Download size={18} />
            Go to My Purchases
          </Link>

          <Link
            to="/marketplace"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 24px', fontSize: '15px' }}
          >
            <Package size={18} />
            Continue Shopping
            <ArrowRight size={16} />
          </Link>
        </div>

        {sessionId && (
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '11px', marginTop: '24px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            Session: {sessionId}
          </p>
        )}
      </motion.div>
    </div>
  );
}
