import React, { forwardRef } from 'react';
import './Toggle.css';

const Toggle = forwardRef(({
  label,
  checked,
  onChange,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  return (
    <label className={`digi-toggle-wrapper ${disabled ? 'disabled' : ''} ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="digi-toggle-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <div className="digi-toggle-track">
        <div className="digi-toggle-thumb"></div>
      </div>
      {label && <div className="digi-toggle-label">{label}</div>}
    </label>
  );
});

Toggle.displayName = 'Toggle';

export default Toggle;
