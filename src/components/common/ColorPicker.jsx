import React, { useState, useEffect, useRef } from 'react';
import './ColorPicker.css';

function hsvToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h / 60);
  let f = h / 60 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r, g, b) {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
  let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  let d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

export default function ColorPicker({ color = '#FFFFFF', onChange }) {
  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 1 });
  const [hexInput, setHexInput] = useState(color);
  
  const boardRef = useRef(null);
  const hueRef = useRef(null);
  const isDraggingBoard = useRef(false);
  const isDraggingHue = useRef(false);

  // Sync from props
  useEffect(() => {
    const currentHex = rgbToHex(...hsvToRgb(hsv.h, hsv.s, hsv.v));
    if (color !== currentHex) {
      const rgb = hexToRgb(color);
      const [h, s, v] = rgbToHsv(...rgb);
      setHsv(prev => ({ h: s === 0 ? prev.h : h, s, v }));
      setHexInput(color);
    }
  }, [color]);

  const updateColor = (newHsv) => {
    setHsv(newHsv);
    const hex = rgbToHex(...hsvToRgb(newHsv.h, newHsv.s, newHsv.v));
    setHexInput(hex);
    if (onChange) onChange(hex);
  };

  const handleBoardPointer = (e) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    const s = x / rect.width;
    const v = 1 - (y / rect.height);
    updateColor({ ...hsv, s, v });
  };

  const handleHuePointer = (e) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const h = (x / rect.width) * 360;
    updateColor({ ...hsv, h });
  };

  useEffect(() => {
    const onPointerMove = (e) => {
      if (isDraggingBoard.current) handleBoardPointer(e);
      if (isDraggingHue.current) handleHuePointer(e);
    };
    const onPointerUp = () => {
      isDraggingBoard.current = false;
      isDraggingHue.current = false;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [hsv]);

  const handleHexChange = (e) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#?[0-9A-Fa-f]{6}$/.test(val)) {
      const rgb = hexToRgb(val);
      const [h, s, v] = rgbToHsv(...rgb);
      setHsv(prev => ({ h: s === 0 ? prev.h : h, s, v }));
      if (onChange) {
        const hexStr = val.startsWith('#') ? val.toUpperCase() : '#' + val.toUpperCase();
        onChange(hexStr);
      }
    }
  };

  const baseHueColor = rgbToHex(...hsvToRgb(hsv.h, 1, 1));

  return (
    <div className="custom-color-picker">
      <div 
        className="cp-board" 
        ref={boardRef}
        onPointerDown={(e) => {
          isDraggingBoard.current = true;
          handleBoardPointer(e);
        }}
        style={{ backgroundColor: baseHueColor }}
      >
        <div className="cp-board-white"></div>
        <div className="cp-board-black"></div>
        <div 
          className="cp-thumb" 
          style={{ 
            left: `${hsv.s * 100}%`, 
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: color
          }}
        ></div>
      </div>
      
      <div className="cp-controls">
        <div 
          className="cp-preview-circle" 
          style={{ backgroundColor: color }}
        ></div>
        <div className="cp-sliders">
          <div 
            className="cp-hue-slider"
            ref={hueRef}
            onPointerDown={(e) => {
              isDraggingHue.current = true;
              handleHuePointer(e);
            }}
          >
            <div 
              className="cp-hue-thumb"
              style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: baseHueColor }}
            ></div>
          </div>
        </div>
      </div>

      <div className="cp-inputs">
        <div className="cp-input-group">
          <span className="cp-input-label">HEX</span>
          <input 
            type="text" 
            className="cp-input" 
            value={hexInput}
            onChange={handleHexChange}
            maxLength={7}
          />
        </div>
      </div>
    </div>
  );
}
