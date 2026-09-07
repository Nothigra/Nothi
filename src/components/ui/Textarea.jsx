import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import './Textarea.css';

const Textarea = forwardRef(({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  hint,
  disabled = false,
  placeholder,
  className = '',
  wrapperClassName = '',
  autoGrow = true,
  maxLength,
  minRows = 3,
  ...props
}, forwardedRef) => {
  const [isFocused, setIsFocused] = useState(false);
  const internalRef = useRef(null);
  
  // Use forwarded ref if provided, otherwise internal
  const ref = forwardedRef || internalRef;

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const hasValue = value !== undefined && value !== null && value !== '';

  useEffect(() => {
    console.log('[DEBUG] Textarea MOUNTED');
    return () => console.log('[DEBUG] Textarea UNMOUNTED');
  }, []);

  console.log('[DEBUG] Textarea RENDERED, value:', value);

  // Auto-grow logic
  useEffect(() => {
    if (autoGrow && ref && ref.current) {
      const el = ref.current;
      el.style.height = 'auto'; // Reset to auto to calculate shrink
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value, autoGrow, ref]);

  const charCount = value ? String(value).length : 0;
  const showCounter = maxLength !== undefined;
  const isNearLimit = showCounter && charCount > maxLength * 0.9;
  const isAtLimit = showCounter && charCount >= maxLength;

  return (
    <div className={`digi-textarea-wrapper ${wrapperClassName}`}>
      <div 
        className={`digi-textarea-container ${isFocused ? 'focused' : ''} ${hasValue ? 'has-value' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      >
        {label && (
          <label className="digi-textarea-label">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder || (label ? ' ' : '')}
          className={`digi-textarea ${autoGrow ? 'auto-grow' : ''} ${!label ? 'no-floating-label' : ''}`}
          rows={minRows}
          maxLength={maxLength}
          {...props}
        />

        {showCounter && (
          <div className="digi-textarea-footer">
            <span className={`digi-textarea-counter ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
              {charCount} / {maxLength}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="digi-textarea-message error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="digi-textarea-message hint">
          {hint}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
