import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronDown, Check, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './Select.css';

const Select = forwardRef(({
  label,
  value,
  onChange,
  options = [],
  multiple = false,
  error,
  hint,
  disabled = false,
  placeholder,
  className = '',
  wrapperClassName = '',
  searchable = false,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const isSelected = (optValue) => {
    if (multiple) return Array.isArray(value) && value.includes(optValue);
    return value === optValue;
  };

  const hasValue = multiple ? (Array.isArray(value) && value.length > 0) : (value !== undefined && value !== null && value !== '');

  const filteredOptions = searchable && searchQuery 
    ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      let idx = 0;
      if (!multiple) {
        idx = filteredOptions.findIndex(opt => opt.value === value);
      }
      setHighlightedIndex(idx >= 0 ? idx : 0);
      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current.focus(), 50);
      }
    }
  }, [isOpen, value, searchable, multiple]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const list = listRef.current;
      const item = list.children[highlightedIndex];
      if (item) {
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        const listTop = list.scrollTop;
        const listBottom = listTop + list.clientHeight;

        if (itemTop < listTop) {
          list.scrollTop = itemTop;
        } else if (itemBottom > listBottom) {
          list.scrollTop = itemBottom - list.clientHeight;
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  const handleSelect = (val) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(val)) {
        onChange(currentValues.filter(v => v !== val));
      } else {
        onChange([...currentValues, val]);
      }
      if (searchInputRef.current) searchInputRef.current.focus();
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  const removeValue = (e, val) => {
    e.stopPropagation();
    const currentValues = Array.isArray(value) ? value : [];
    onChange(currentValues.filter(v => v !== val));
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault();
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        else setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        else setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          if (containerRef.current) containerRef.current.focus();
        }
        break;
      default:
        break;
    }
  };

  const renderDisplay = () => {
    if (multiple && hasValue) {
      return (
        <div className="digi-select-tags">
          {value.map(val => {
            const opt = options.find(o => o.value === val);
            if (!opt) return null;
            return (
              <span key={val} className="digi-select-tag">
                {opt.label}
                <button type="button" onClick={(e) => removeValue(e, val)} className="digi-select-tag-close">
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      );
    }
    
    if (!multiple && hasValue) {
      const selectedOption = options.find(opt => opt.value === value);
      return selectedOption ? selectedOption.label : placeholder;
    }
    
    return placeholder || ' ';
  };

  return (
    <div className={`digi-select-wrapper ${wrapperClassName}`} ref={containerRef}>
      <div 
        className={`digi-select-container ${isOpen ? 'open' : ''} ${hasValue ? 'has-value' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${className}`}
        onClick={handleToggle}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        {...props}
      >
        {label && (
          <label className="digi-select-label">
            {label}
          </label>
        )}

        <div className={`digi-select-display ${!label ? 'no-floating-label' : ''} ${!hasValue ? 'placeholder' : ''}`}>
          {renderDisplay()}
        </div>

        <div className="digi-select-arrow">
          <ChevronDown size={20} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="digi-select-menu"
            initial={{ opacity: 0, scaleY: 0.95 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'top' }}
          >
          {searchable && (
            <div className="digi-select-search" onClick={e => e.stopPropagation()}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
                    handleKeyDown(e);
                  }
                }}
              />
            </div>
          )}
          
          <div className="digi-select-list" ref={listRef} role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="digi-select-empty">No options found</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const selected = isSelected(opt.value);
                return (
                  <div 
                    key={opt.value}
                    className={`digi-select-option ${selected ? 'selected' : ''} ${idx === highlightedIndex ? 'highlighted' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={selected}
                  >
                    <span className="digi-select-option-label">{opt.label}</span>
                    {selected && <Check size={16} className="digi-select-option-check" />}
                  </div>
                );
              })
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="digi-select-message error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="digi-select-message hint">
          {hint}
        </div>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
