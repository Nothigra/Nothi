import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import ThemeCard from '../components/common/ThemeCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { SOFTWARE_LIST, CURRENCY_LIST, STYLE_LIST, COUNTRY_LIST } from '../lib/seed';
import * as accountStore from '../lib/accountStore';
import Input from '../components/ui/Input';
import './OnboardingPage.css';

const STEPS = [
  { id: 'username', title: 'Choose your username', subtitle: 'This will be your unique identity on Nothi.' },
  { id: 'country', title: 'Where are you from?', subtitle: 'This helps us tailor the marketplace for your region.' },
  { id: 'software', title: 'What software do you use?', subtitle: 'We\'ll tailor the marketplace to show compatible products.' },
  { id: 'style', title: 'What is your editing style?', subtitle: 'Select styles you edit to help us personalize your feed.' },
  { id: 'theme', title: 'Choose your theme', subtitle: 'You can always change this later in settings.' },
  { id: 'currency', title: 'Select your currency', subtitle: 'All prices will be displayed in your preferred currency.' }
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { updateProfile, user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, changeCurrency } = useCurrency();

  // If already onboarded AND has username, redirect
  useEffect(() => {
    if (profile?.onboarding_completed && profile?.username) {
      navigate('/marketplace');
    }
  }, [profile?.onboarding_completed, profile?.username, navigate]);

  // Per-account storage key for resume
  const accountId = user?.id || 'unknown';
  const STORAGE_KEY = `digilab-onboarding-${accountId}`;

  // Load saved progress from localStorage
  const savedProgress = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })();

  const [currentStep, setCurrentStep] = useState(savedProgress?.step || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State — restore from saved progress
  const [username, setUsername] = useState(savedProgress?.username || '');
  const [country, setCountry] = useState(savedProgress?.country || '');
  const [selectedSoftware, setSelectedSoftware] = useState(savedProgress?.software || []);
  const [selectedStyle, setSelectedStyle] = useState(savedProgress?.style || []);

  // Restore theme/currency from saved progress
  useEffect(() => {
    if (savedProgress?.theme) setTheme(savedProgress.theme);
    if (savedProgress?.currency) changeCurrency(savedProgress.currency);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Validation
  const [error, setError] = useState('');

  // Username uniqueness check state
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const debounceRef = useRef(null);

  // Persist partial progress to localStorage on every meaningful change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      step: currentStep,
      username,
      country,
      software: selectedSoftware,
      style: selectedStyle,
      theme,
      currency
    }));
  }, [currentStep, username, country, selectedSoftware, selectedStyle, theme, currency, STORAGE_KEY]);

  // Debounced username uniqueness check against all accounts
  const checkUsername = useCallback((value) => {
    if (!value || value.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    if (value.length > 20) {
      setUsernameStatus('invalid');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Check against all accounts in the store (excluding current account)
      const taken = accountStore.isUsernameTaken(value, accountId);
      setUsernameStatus(taken ? 'taken' : 'available');
    }, 400);
  }, [accountId]);

  const handleUsernameChange = (e) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    setUsername(value);
    checkUsername(value);
  };

  // Handle step validation
  const validateStep = () => {
    setError('');
    if (currentStep === 0) {
      if (!username.trim()) { setError('Username is required'); return false; }
      if (username.length < 3) { setError('Username must be at least 3 characters'); return false; }
      if (username.length > 20) { setError('Username must be 20 characters or less'); return false; }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) { setError('Only letters, numbers, underscores and dashes allowed'); return false; }
      if (usernameStatus !== 'available') {
        setError(usernameStatus === 'taken' ? 'This username is already taken' : 'Please wait for username check');
        return false;
      }
    }
    if (currentStep === 1) {
      if (!country) { setError('Please select your country'); return false; }
    }
    if (currentStep === 2) {
      if (selectedSoftware.length === 0) { setError('Please select at least one software'); return false; }
    }
    if (currentStep === 3) {
      if (selectedStyle.length === 0) { setError('Please select at least one style'); return false; }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      await finishOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setError('');
    }
  };

  const toggleSoftware = (sw) => {
    setSelectedSoftware(prev => 
      prev.includes(sw) ? prev.filter(i => i !== sw) : [...prev, sw]
    );
  };

  const toggleStyle = (st) => {
    setSelectedStyle(prev => 
      prev.includes(st) ? prev.filter(i => i !== st) : [...prev, st]
    );
  };

  const finishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const res = await updateProfile({
        username: username.toLowerCase().replace(/\s+/g, ''),
        country,
        software: selectedSoftware,
        style: selectedStyle,
        theme,
        currency,
        onboarding_completed: true
      });
      if (!res.success) {
        throw new Error(res.error?.message || res.error || 'Update failed');
      }
      // Clear saved progress
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('marketplaceFilters');
      navigate('/marketplace');
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message || 'Failed to save profile. Please try again.');
      setIsSubmitting(false);
    }
  };

  const isNextDisabled = () => {
    if (isSubmitting) return true;
    if (currentStep === 0) return username.length < 3 || usernameStatus !== 'available';
    if (currentStep === 1) return !country;
    if (currentStep === 2) return selectedSoftware.length === 0;
    if (currentStep === 3) return selectedStyle.length === 0;
    return false;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="onboarding-input-group">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
              maxLength={20}
              size="lg"
            />
            <div className="username-status-row">
              {usernameStatus === 'checking' && (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="username-checking">
                  <Loader2 size={14} className="spin" /> Checking availability...
                </motion.div>
              )}
              {usernameStatus === 'available' && (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="username-available">
                  <CheckCircle2 size={14} /> Username is available!
                </motion.div>
              )}
              {usernameStatus === 'taken' && (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="username-taken">
                  <XCircle size={14} /> Username is already taken
                </motion.div>
              )}
              {usernameStatus === 'invalid' && (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="username-taken">
                  <XCircle size={14} /> 3–20 chars, letters, numbers, _ and - only
                </motion.div>
              )}
            </div>
            <p className="text-xs text-secondary mt-sm">3–20 characters. Letters, numbers, underscores and dashes only.</p>
          </div>
        );
      
      case 1:
        return (
          <div className="onboarding-input-group w-full max-w-sm mx-auto">
            <select
              className="input input-lg w-full bg-bg border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent outline-none"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="" disabled>Select your country</option>
              {COUNTRY_LIST.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        );

      case 2:
        return (
          <div className="onboarding-grid">
            {SOFTWARE_LIST.map((sw) => {
              const swName = typeof sw === 'string' ? sw : sw.name || sw.id;
              const isSelected = selectedSoftware.includes(swName);
              return (
                <button
                  key={swName}
                  className={`onboarding-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSoftware(swName)}
                >
                  <div className="card-checkbox">
                    {isSelected && <Check size={14} />}
                  </div>
                  <span>{swName}</span>
                </button>
              );
            })}
          </div>
        );

      case 3:
        return (
          <div className="onboarding-grid">
            {STYLE_LIST.map((st) => {
              const stName = typeof st === 'string' ? st : st.name || st.id;
              const isSelected = selectedStyle.includes(stName);
              return (
                <button
                  key={stName}
                  className={`onboarding-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleStyle(stName)}
                >
                  <div className="card-checkbox">
                    {isSelected && <Check size={14} />}
                  </div>
                  <span>{stName}</span>
                </button>
              );
            })}
          </div>
        );

      case 4:
        return (
          <div className="onboarding-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <ThemeCard themeKey="light" isSelected={theme === 'light'} onSelect={setTheme} />
            <ThemeCard themeKey="dark" isSelected={theme === 'dark'} onSelect={setTheme} />
          </div>
        );

      case 5:
        return (
          <div className="onboarding-grid currency-grid">
            {CURRENCY_LIST.map((curr) => {
              const isSelected = currency === curr.code;
              return (
                <button
                  key={curr.code}
                  className={`onboarding-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => changeCurrency(curr.code)}
                >
                  <div className="currency-symbol">{curr.symbol}</div>
                  <div className="currency-details">
                    <span className="currency-code">{curr.code}</span>
                    <span className="currency-name">{curr.name}</span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-accent ml-auto" />}
                </button>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        
        {/* Progress Bar */}
        <div className="onboarding-progress">
          {STEPS.map((step, index) => (
            <div 
              key={step.id} 
              className={`progress-dot ${index === currentStep ? 'active' : index < currentStep ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* Content Area */}
        <div className="onboarding-content-wrapper">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="onboarding-content"
            >
              <h1 className="onboarding-title">{STEPS[currentStep].title}</h1>
              <p className="onboarding-subtitle">{STEPS[currentStep].subtitle}</p>

              {error && <div className="onboarding-error">{error}</div>}

              <div className="step-content-area">
                {renderStepContent()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="onboarding-nav">
          <button 
            className={`btn-nav btn-back ${currentStep === 0 ? 'invisible' : ''}`}
            onClick={handleBack}
            disabled={isSubmitting}
          >
            <ChevronLeft size={20} /> Back
          </button>

          <button 
            className="btn-nav btn-next"
            onClick={handleNext}
            disabled={isNextDisabled()}
          >
            {isSubmitting ? 'Saving...' : currentStep === STEPS.length - 1 ? 'Finish' : 'Continue'}
            {!isSubmitting && currentStep < STEPS.length - 1 && <ChevronRight size={20} />}
          </button>
        </div>

      </div>
    </div>
  );
}
