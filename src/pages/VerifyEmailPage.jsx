import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import './AuthPages.css';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const navigate = useNavigate();
  const { verifyOtp, resendOtp, user, profile, isLoading } = useAuth();
  
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  // Auto-redirect if already logged in and verified
  useEffect(() => {
    if (!isLoading && user) {
      if (profile?.onboarding_completed) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  }, [user, profile, isLoading, navigate]);

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendStatus('');

    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(email, code, 'signup');
      if (res.error) {
        setError(res.error.message || 'Verification failed. The code might be expired or incorrect.');
      } else {
        // Success — Supabase will fire an onAuthStateChange event which AuthContext
        // will pick up, setting `user`. The useEffect above will then redirect.
        // Explicit navigate here as a fallback for mock mode or slow state propagation.
        if (!res.data?.session) {
          navigate('/onboarding');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendStatus('');
    setLoading(true);
    try {
      const res = await resendOtp(email, 'signup');
      if (res.error) {
        setError(res.error.message || 'Failed to resend code.');
      } else {
        setResendStatus('A new code has been sent to your email.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page centered-layout">
      <motion.div 
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="auth-header text-center">
          <Link to="/" className="auth-logo justify-center mb-md">
            <div className="logo-icon w-8 h-8 flex-center bg-text-primary text-bg rounded-md">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span>Nothi</span>
          </Link>
          <h1 className="auth-title">Verify your email</h1>
          <p className="auth-subtitle">
            We sent a 6-digit verification code to<br/>
            <strong>{email}</strong>
          </p>
        </div>

        {error && (
          <div className="auth-error-banner mb-lg">
            {error}
          </div>
        )}
        
        {resendStatus && (
          <div className="bg-success-subtle text-success p-md rounded-md mb-lg text-sm text-center font-medium">
            {resendStatus}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="mb-lg text-center">
            <label className="block text-sm font-medium text-secondary mb-xs">
              Enter 6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCode(val);
                if (val.length === 6) setError('');
              }}
              className="text-center text-3xl font-bold tracking-widest p-sm border border-border rounded-md w-full bg-bg focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              placeholder="000000"
              autoFocus
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full mb-md"
            disabled={loading || code.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="auth-footer text-center mt-lg">
          <p className="text-secondary text-sm">
            Didn't receive the code?
            <button 
              className="text-accent ml-xs font-medium hover:underline bg-transparent border-none cursor-pointer"
              onClick={handleResend}
              disabled={loading}
            >
              Resend code
            </button>
          </p>
          <div className="mt-md">
             <Link to="/login" className="text-secondary hover:text-primary text-sm transition-colors">
               Back to log in
             </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
