import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { supabase, isMockMode } from '../lib/supabase';
import Input from '../components/ui/Input';
import './AuthPages.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // Whether we've confirmed a valid recovery session is active
  const [sessionReady, setSessionReady] = useState(isMockMode);

  // Supabase fires a PASSWORD_RECOVERY auth event when the user
  // arrives from the reset email link. We must wait for this event
  // to confirm a real recovery session exists before allowing the
  // form to be used — otherwise updateUser() would fail or apply
  // to the wrong (or no) session.
  useEffect(() => {
    if (isMockMode) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if there's already an active session (user arrived
    // with a valid token fragment already processed by Supabase client)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (!isMockMode) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }

      setSuccess(true);
      // Sign out so they log back in cleanly with the new password
      setTimeout(async () => {
        if (!isMockMode) await supabase.auth.signOut();
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.message || 'Failed to update password. Your reset link may have expired.');
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
          <h1 className="auth-title">Set new password</h1>
          <p className="auth-subtitle">
            {sessionReady
              ? 'Enter and confirm your new password below.'
              : 'Verifying your reset link...'}
          </p>
        </div>

        {error && (
          <div className="auth-error-banner mb-lg">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center mb-xl">
            <div className="bg-success-subtle text-success p-md rounded-md mb-md font-medium">
              Password updated successfully!
            </div>
            <p className="text-secondary text-sm">Redirecting to login...</p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center py-xl text-secondary text-sm">
            <div className="loader spin mx-auto mb-md" style={{ width: '24px', height: '24px', borderWidth: '2px' }} />
            Checking your reset link...
            <div className="mt-lg">
              <Link to="/login" className="text-accent font-medium hover:underline text-sm">
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="mb-md">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                iconLeft={Lock}
                iconRight={showPassword ? Eye : EyeOff}
                onIconRightClick={() => setShowPassword(!showPassword)}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                size="md"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="mb-lg">
              <Input
                label="Confirm New Password"
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                iconLeft={Lock}
                iconRight={showConfirm ? Eye : EyeOff}
                onIconRightClick={() => setShowConfirm(!showConfirm)}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                size="md"
                placeholder="Repeat your new password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
