import React, { forwardRef } from 'react';
import { Check } from 'lucide-react';
import './Checkbox.css';

const Checkbox = forwardRef(({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  return (
    <label className={`digi-checkbox-wrapper ${disabled ? 'disabled' : ''} ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="digi-checkbox-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <div className="digi-checkbox-box">
        <Check size={14} strokeWidth={3} className="digi-checkbox-check" />
      </div>
      {(label || hint) && (
        <div className="digi-checkbox-content">
          {label && <div className="digi-checkbox-label">{label}</div>}
          {hint && <div className="digi-checkbox-hint">{hint}</div>}
        </div>
      )}
    </label>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
