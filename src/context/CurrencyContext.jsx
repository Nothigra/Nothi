import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as store from '../lib/accountStore';

const CurrencyContext = createContext();

// Static fallback rates (USD base) — used when API is unavailable
const STATIC_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 151.20, CAD: 1.36,
  AUD: 1.52, CHF: 0.90, BRL: 5.01, INR: 83.10, MXN: 16.70,
  SGD: 1.35, AED: 3.67, KRW: 1380.50, ZAR: 18.90
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$',
  AUD: 'A$', CHF: 'CHF', BRL: 'R$', INR: '₹', MXN: '$',
  SGD: 'S$', AED: 'د.إ', KRW: '₩', ZAR: 'R'
};

export function CurrencyProvider({ children }) {
  const { profile, isAuthenticated, isMockMode } = useAuth();

  const [currency, setCurrencyState] = useState(() => {
    // On initial load, check session account's currency
    if (isMockMode) {
      const sessionId = store.getSession();
      if (sessionId) {
        const account = store.getAccount(sessionId);
        if (account?.currency) return account.currency;
      }
    }
    return 'USD';
  });

  const [rates, setRates] = useState(STATIC_RATES);

  // Try to fetch live rates on mount
  useEffect(() => {
    const apiKey = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
    if (!apiKey) return;

    const fetchRates = async () => {
      try {
        const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
        const data = await res.json();
        if (data.result === 'success') {
          setRates(data.conversion_rates);
        }
      } catch {
        // API failed — keep static rates
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // When account switches, apply that account's currency
  useEffect(() => {
    if (isAuthenticated && profile?.currency) {
      setCurrencyState(profile.currency);
    }
  }, [isAuthenticated, profile?.id, profile?.currency]);

  const changeCurrency = useCallback((newCurrency) => {
    setCurrencyState(newCurrency);
    if (isMockMode) {
      const sessionId = store.getSession();
      if (sessionId) {
        store.updateAccount(sessionId, { currency: newCurrency });
      }
    }
  }, [isMockMode]);

  const convertPrice = useCallback((usdAmount) => {
    const rate = rates[currency] || 1;
    return usdAmount * rate;
  }, [currency, rates]);

  const formatPrice = useCallback((usdAmount) => {
    const converted = convertPrice(usdAmount);
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).formatToParts(converted);
    
    const customSymbol = CURRENCY_SYMBOLS[currency] || currency;
    return parts.map(p => p.type === 'currency' ? customSymbol : p.value).join('');
  }, [currency, convertPrice]);

  return (
    <CurrencyContext.Provider value={{ currency, changeCurrency, convertPrice, formatPrice, rates, CURRENCY_SYMBOLS }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
}

export default CurrencyContext;
