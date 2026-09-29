import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as store from '../lib/accountStore';

const CurrencyContext = createContext();

// Every amount stored in the database (product prices, price_paid, revenue,
// seller_amount_cents...) is in EUR, and Stripe charges in EUR. Other
// currencies are a display-only conversion of that EUR amount.
export const BASE_CURRENCY = 'EUR';

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
    return BASE_CURRENCY;
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

  // `rates` are quoted against USD, so EUR -> X = amount / rate(EUR) * rate(X).
  const convertPrice = useCallback((eurAmount) => {
    const amount = Number(eurAmount) || 0;
    if (currency === BASE_CURRENCY) return amount;
    const eurRate = rates[BASE_CURRENCY] || STATIC_RATES[BASE_CURRENCY];
    const targetRate = rates[currency];
    if (!eurRate || !targetRate) return amount;
    return (amount / eurRate) * targetRate;
  }, [currency, rates]);

  // Always shows the real EUR amount, whatever currency the viewer picked.
  // Use it wherever the exact charged/earned figure matters.
  const formatEur = useCallback((eurAmount) => new Intl.NumberFormat('fr-BE', {
    style: 'currency', currency: BASE_CURRENCY,
  }).format(Number(eurAmount) || 0), []);

  const isConverted = currency !== BASE_CURRENCY;

  const formatPrice = useCallback((eurAmount) => {
    const converted = convertPrice(eurAmount);
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).formatToParts(converted);
    
    const customSymbol = CURRENCY_SYMBOLS[currency] || currency;
    return parts.map(p => p.type === 'currency' ? customSymbol : p.value).join('');
  }, [currency, convertPrice]);

  return (
    <CurrencyContext.Provider value={{ currency, changeCurrency, convertPrice, formatPrice, formatEur, isConverted, rates, CURRENCY_SYMBOLS }}>
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
