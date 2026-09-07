import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';
import './CurrencyInput.css';

const DEFAULT_CURRENCIES = [
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'CAD', label: 'CAD', symbol: '$' },
  { value: 'AUD', label: 'AUD', symbol: '$' }
];

const CurrencyInput = forwardRef(({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  currency = 'USD',
  onCurrencyChange,
  currencies = DEFAULT_CURRENCIES,
  error,
  hint,
  disabled = false,
  placeholder,
  className = '',
  wrapperClassName = '',
  ...props
}, forwardedRef) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const internalRef = useRef(null);
  const ref = forwardedRef || internalRef;
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const hasValue = value !== undefined && value !== null && value !== '';

  return (
    <div className={`digi-currency-wrapper ${wrapperClassName}`} ref={containerRef}>
      <div 
        className={`digi-currency-container ${isFocused ? 'focused' : ''} ${hasValue ? 'has-value' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      >
        <button
          type="button"
          className="digi-currency-selector"
          onClick={() => !disabled && setIsMenuOpen(!isMenuOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isMenuOpen}
        >
          {currency} <ChevronDown size={14} style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        {isMenuOpen && (
          <div className="digi-currency-menu">
            <div className="digi-select-list" role="listbox">
              {currencies.map((c) => (
                <div
                  key={c.value}
                  className={`digi-select-option ${c.value === currency ? 'selected' : ''}`}
                  onClick={() => {
                    if (onCurrencyChange) onCurrencyChange(c.value);
                    setIsMenuOpen(false);
                    if (ref.current) ref.current.focus();
                  }}
                  role="option"
                  aria-selected={c.value === currency}
                >
                  <span className="digi-select-option-label">{c.value} ({c.symbol})</span>
                  {c.value === currency && <Check size={14} className="digi-select-option-check" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {label && (
          <label className="digi-currency-label">
            {label}
          </label>
        )}

        <input
          ref={ref}
          type="number"
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder || (label ? ' ' : '')}
          className={`digi-currency-input ${!label ? 'no-floating-label' : ''}`}
          step="0.01"
          {...props}
        />
      </div>

      {error && (
        <div className="digi-input-message error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="digi-input-message hint">
          {hint}
        </div>
      )}
    </div>
  );
});

CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;
