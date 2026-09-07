import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import './AuthPages.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithOAuth, loginWithEmail, signUpWithEmail, resetPasswordForEmail, user, profile, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      if (profile?.onboarding_completed) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  }, [user, profile, isLoading, navigate]);

  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
        return '';
      case 'password':
        if (!isForgotPassword) {
          if (!value) return 'Password is required.';
          if (value.length < 8) return 'Password must be at least 8 characters.';
        }
        return '';
      case 'firstName':
        if (!isLogin && !value) return 'First name is required.';
        return '';
      case 'lastName':
        if (!isLogin && !value) return 'Last name is required.';
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleOAuthLogin = async (provider) => {
    setError('');
    setLoading(true);

    try {
      const result = await loginWithOAuth(provider);
      // loginWithOAuth only returns a result in mock mode
      if (result) {
        if (result.isNewUser) {
          navigate('/onboarding');
        } else {
          navigate('/marketplace');
        }
      }
      // In real mode, it redirects, so we do nothing and keep loading true
    } catch (err) {
      setError(err.message || `Failed to continue with ${provider}.`);
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isForgotPassword) {
      const emailErr = validateField('email', formData.email);
      setFieldErrors({ ...fieldErrors, email: emailErr });
      if (emailErr) return;

      setLoading(true);
      try {
        await resetPasswordForEmail(formData.email);
        setResetSent(true);
      } catch (err) {
        setError(err.message || 'Failed to send reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const emailErr = validateField('email', formData.email);
    const passErr = validateField('password', formData.password);
    const firstErr = !isLogin ? validateField('firstName', formData.firstName) : '';
    const lastErr = !isLogin ? validateField('lastName', formData.lastName) : '';
    
    setFieldErrors({ email: emailErr, password: passErr, firstName: firstErr, lastName: lastErr });

    if (emailErr || passErr || firstErr || lastErr) return;

    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await loginWithEmail(formData.email, formData.password);
      } else {
        res = await signUpWithEmail(formData.email, formData.password, formData.firstName, formData.lastName);
      }

      if (res.error) {
        const msg = res.error.message;
        if (msg.includes('Email not confirmed')) {
          setError('Please check your email and enter the 6-digit code first.');
          setTimeout(() => navigate(`/auth/verify?email=${encodeURIComponent(formData.email)}`), 1500);
        } else if (msg.includes('Invalid login credentials')) {
          setError('Email or password is incorrect.');
        } else if (msg.includes('Error sending confirmation email')) {
          setError('Supabase SMTP Error: Failed to send confirmation email. Please check your Resend/SMTP configuration in the Supabase Dashboard.');
        } else {
          setError(msg || 'Authentication failed. Please check your credentials.');
        }
      } else {
        if (!isLogin) {
          navigate(`/auth/verify?email=${encodeURIComponent(formData.email)}`);
        } else {
          navigate('/auth/callback');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
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
          <h1 className="auth-title">
            {isForgotPassword ? 'Reset password' : isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="auth-subtitle">
            {isForgotPassword 
              ? 'Enter your email to receive a password reset link.' 
              : isLogin 
                ? 'Enter your details to sign in to your account.' 
                : 'Join the ultimate marketplace for digital creators.'}
          </p>
        </div>

        {error && (
          <div className="auth-error-banner mb-lg">
            {error}
          </div>
        )}

        {resetSent ? (
          <div className="text-center mb-xl">
            <div className="w-16 h-16 bg-success-subtle text-success rounded-full flex-center mx-auto mb-md">
              <Mail size={32} />
            </div>
            <h2 className="text-lg font-bold mb-xs">Check your email</h2>
            <p className="text-secondary mb-lg">We sent a password reset link to <br/><strong>{formData.email}</strong></p>
            <button className="btn btn-outline w-full" onClick={() => { setIsForgotPassword(false); setResetSent(false); }}>
              Back to log in
            </button>
          </div>
        ) : (
          <>
            {!isForgotPassword && (
              <>
                <div className="auth-oauth-container">
          <button 
            className="btn btn-outline w-full flex-center gap-sm mb-sm auth-oauth-btn"
            style={{ fontSize: '15px', padding: '10px 0', height: '44px' }}
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          
          <button 
            className="btn btn-outline w-full flex-center gap-sm auth-oauth-btn"
            style={{ fontSize: '15px', padding: '10px 0', height: '44px' }}
            onClick={() => handleOAuthLogin('discord')}
            disabled={loading}
          >
            <svg width="24" height="24" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
              <path fill="#5865F2" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            Continue with Discord
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>
              </>
        )}

        <form className="auth-form" onSubmit={handleEmailSubmit}>
          {!isLogin && !isForgotPassword && (
            <div className="flex gap-md mb-md">
              <Input 
                label="First Name"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={fieldErrors.firstName}
                size="md"
              />
              <Input 
                label="Last Name"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={fieldErrors.lastName}
                size="md"
              />
            </div>
          )}

          <Input 
            label="Email address"
            type="email"
            name="email"
            iconLeft={Mail}
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={fieldErrors.email}
            wrapperClassName="mb-md"
            size="md"
          />

            <div className="mb-lg">
              {isLogin && !isForgotPassword && (
                <div className="text-right mb-xs">
                  <button type="button" className="auth-forgot-link bg-transparent border-none cursor-pointer p-0" style={{ fontSize: '13px' }} onClick={() => setIsForgotPassword(true)}>Forgot password?</button>
                </div>
              )}
              {!isForgotPassword && (
                <Input 
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  iconLeft={Lock}
                  iconRight={showPassword ? Eye : EyeOff}
                  onIconRightClick={() => setShowPassword(!showPassword)}
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={fieldErrors.password}
                  size="md"
                />
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="auth-footer text-center mt-xl">
            <p className="text-secondary text-sm">
              {isForgotPassword ? (
                <>
                  Remember your password? 
                  <button 
                    className="text-accent ml-xs font-medium hover:underline bg-transparent border-none cursor-pointer"
                    onClick={() => { setIsForgotPassword(false); setError(''); }}
                  >
                    Log in
                  </button>
                </>
              ) : isLogin ? (
                <>
                  Don't have an account?
                  <button 
                    className="text-accent ml-xs font-medium hover:underline bg-transparent border-none cursor-pointer"
                    onClick={() => { setIsLogin(false); setError(''); setFieldErrors({ email: '', password: '', firstName: '', lastName: '' }); }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?
                  <button 
                    className="text-accent ml-xs font-medium hover:underline bg-transparent border-none cursor-pointer"
                    onClick={() => { setIsLogin(true); setError(''); setFieldErrors({ email: '', password: '', firstName: '', lastName: '' }); }}
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
