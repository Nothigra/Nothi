import { useState, useRef, useEffect, useCallback } from 'react';
import './CustomColorPicker.css';

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1]+hex[1],16)/255;
    g = parseInt(hex[2]+hex[2],16)/255;
    b = parseInt(hex[3]+hex[3],16)/255;
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1,3),16)/255;
    g = parseInt(hex.substring(3,5),16)/255;
    b = parseInt(hex.substring(5,7),16)/255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0; 
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export default function CustomColorPicker({ color, onChange, onDragStart }) {
  const [hsl, setHsl] = useState(() => hexToHsl(color || '#000000'));
  const areaRef = useRef(null);
  const hueRef = useRef(null);
  const isDraggingArea = useRef(false);
  const isDraggingHue = useRef(false);
  const hslRef = useRef(hsl);
  useEffect(() => { hslRef.current = hsl; }, [hsl]);

  useEffect(() => {
    setHsl(hexToHsl(color || '#000000'));
  }, [color]);

  const triggerChange = useCallback((newHsl) => {
    setHsl(newHsl);
  }, []);

  const handleAreaMove = useCallback((clientX, clientY) => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    let y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const s = Math.round((x / rect.width) * 100);
    // Y axis: 0 is light 100, bottom is light 0. 
    // Actually, typical color pickers: X is Saturation, Y is Value. 
    // HSL is tricky to map to a box. Let's just do S and L.
    const l = Math.round(100 - (y / rect.height) * 100);
    triggerChange({ ...hsl, s, l });
  }, [hsl, triggerChange]);

  const handleHueMove = useCallback((clientX) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const h = Math.round((x / rect.width) * 360);
    triggerChange({ ...hsl, h });
  }, [hsl, triggerChange]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingArea.current) handleAreaMove(e.clientX, e.clientY);
      if (isDraggingHue.current) handleHueMove(e.clientX);
    };
    const handleMouseUp = () => {
      if (isDraggingArea.current || isDraggingHue.current) {
        if (onChange) {
          const curr = hslRef.current;
          onChange(hslToHex(curr.h, curr.s, curr.l));
        }
      }
      isDraggingArea.current = false;
      isDraggingHue.current = false;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleAreaMove, handleHueMove, onChange]);

  return (
    <div className="custom-color-picker">
      <div 
        className="sl-area" 
        ref={areaRef}
        onMouseDown={(e) => { 
          isDraggingArea.current = true; 
          if (onDragStart) onDragStart();
          handleAreaMove(e.clientX, e.clientY); 
        }}
        style={{ background: `hsl(${hsl.h}, 100%, 50%)` }}
      >
        <div className="sl-gradient-white"></div>
        <div className="sl-gradient-black"></div>
        <div 
          className="sl-thumb" 
          style={{ 
            left: `${hsl.s}%`, 
            top: `${100 - hsl.l}%`,
            background: hslToHex(hsl.h, hsl.s, hsl.l)
          }}
        />
      </div>
      
      <div 
        className="hue-slider" 
        ref={hueRef}
        onMouseDown={(e) => { 
          isDraggingHue.current = true; 
          if (onDragStart) onDragStart();
          handleHueMove(e.clientX); 
        }}
      >
        <div 
          className="hue-thumb"
          style={{ 
            left: `${(hsl.h / 360) * 100}%`,
            background: `hsl(${hsl.h}, 100%, 50%)`
          }}
        />
      </div>
    </div>
  );
}
