import React, { useState, forwardRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import './Input.css';

const Input = forwardRef(({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  iconLeft: IconLeft,
  iconRight: IconRight,
  prefix,
  error,
  hint,
  size = 'md',
  clearable = false,
  onClear,
  type = 'text',
  disabled = false,
  placeholder,
  className = '',
  wrapperClassName = '',
  onIconRightClick,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handleClear = () => {
    if (onClear) onClear();
    else if (onChange) {
      // Mock an event object for standard onChange handlers
      onChange({ target: { value: '' } });
    }
  };

  const hasValue = value !== undefined && value !== null && value !== '';
  const forceFloating = type === 'date' || type === 'time' || placeholder;

  return (
    <div className={`digi-input-wrapper ${wrapperClassName}`}>
      <div 
        className={`digi-input-container digi-input-size-${size} ${isFocused ? 'focused' : ''} ${hasValue ? 'has-value' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${IconLeft ? 'digi-input-has-left-icon' : ''} ${prefix ? 'digi-input-has-prefix' : ''} ${forceFloating ? 'force-floating' : ''} ${className}`}
      >
        {IconLeft && (
          <div className="digi-input-icon left">
            <IconLeft size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
          </div>
        )}

        {prefix && (
          <div className="digi-input-prefix">
            {prefix}
          </div>
        )}

        {label && (
          <label className="digi-label-floating">
            {label}
          </label>
        )}

        <input
          ref={ref}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder || (label ? ' ' : '')}
          className={`digi-input ${!label ? 'no-floating-label' : ''}`}
          {...props}
        />

        <div className="flex items-center">
          {clearable && hasValue && !disabled && (
            <button 
              type="button" 
              className="digi-input-icon-btn right" 
              onClick={handleClear}
              aria-label="Clear input"
            >
              <X size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            </button>
          )}

          {IconRight && (!clearable || !hasValue) && (
            onIconRightClick ? (
              <button 
                type="button" 
                className="digi-input-icon-btn right" 
                onClick={onIconRightClick}
              >
                <IconRight size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
              </button>
            ) : (
              <div className="digi-input-icon right">
                <IconRight size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
              </div>
            )
          )}

          {error && !IconRight && (!clearable || !hasValue) && (
            <div className="digi-input-icon right text-danger">
              <AlertCircle size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="digi-input-message error">
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

Input.displayName = 'Input';

export default Input;
