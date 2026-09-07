import React, { useState } from 'react';
import ColorPicker from './ColorPicker';
import './BackgroundCustomizer.css';
import { Check } from 'lucide-react';

const GRADIENT_PRESETS = [
  { name: 'Ocean', colorA: '#0284C7', colorB: '#0369A1', angle: 135 },
  { name: 'Sunset', colorA: '#F59E0B', colorB: '#E11D48', angle: 135 },
  { name: 'Aurora', colorA: '#10B981', colorB: '#3B82F6', angle: 135 },
  { name: 'Purple Dream', colorA: '#8B5CF6', colorB: '#D946EF', angle: 135 },
  { name: 'Midnight', colorA: '#1E1B4B', colorB: '#312E81', angle: 135 },
  { name: 'Emerald', colorA: '#059669', colorB: '#10B981', angle: 135 },
  { name: 'Sky', colorA: '#38BDF8', colorB: '#818CF8', angle: 135 },
  { name: 'Royal', colorA: '#4338CA', colorB: '#7E22CE', angle: 135 },
  { name: 'Fire', colorA: '#EA580C', colorB: '#DC2626', angle: 135 },
  { name: 'Graphite', colorA: '#3F3F46', colorB: '#18181B', angle: 135 }
];

export default function BackgroundCustomizer({ value, onChange }) {
  const currentType = value?.type || 'solid';
  const solidColor = value?.solid?.color || '#ffffff';
  const gradient = value?.gradient || { colorA: '#6366f1', colorB: '#a855f7', angle: 135 };

  const [activeTab, setActiveTab] = useState(currentType);
  const [activePicker, setActivePicker] = useState(null); // 'solid', 'gradientA', 'gradientB', null

  const handleTypeChange = (type) => {
    setActiveTab(type);
    onChange({
      type,
      solid: value?.solid || { color: '#ffffff' },
      gradient: value?.gradient || { colorA: '#6366f1', colorB: '#a855f7', angle: 135 }
    });
  };

  const handleSolidChange = (hex) => {
    onChange({ ...value, type: 'solid', solid: { color: hex } });
  };

  const handleGradientChange = (updates) => {
    const newGradient = { ...gradient, ...updates };
    onChange({ ...value, type: 'gradient', gradient: newGradient });
  };

  const isPresetActive = (preset) => {
    return (
      activeTab === 'gradient' &&
      preset.colorA.toUpperCase() === gradient.colorA.toUpperCase() &&
      preset.colorB.toUpperCase() === gradient.colorB.toUpperCase() &&
      preset.angle === gradient.angle
    );
  };

  return (
    <div className="bg-customizer">
      <div className="bg-type-selector mb-md">
        <button 
          className={`bg-type-btn ${activeTab === 'solid' ? 'active' : ''}`}
          onClick={() => handleTypeChange('solid')}
        >
          Solid Color
        </button>
        <button 
          className={`bg-type-btn ${activeTab === 'gradient' ? 'active' : ''}`}
          onClick={() => handleTypeChange('gradient')}
        >
          Gradient
        </button>
      </div>

      {activeTab === 'solid' && (
        <div className="bg-solid-editor">
          <div className="flex items-center justify-between p-lg border border-border rounded-xl bg-bg-secondary mb-md">
            <span className="text-base font-semibold">Current Color</span>
            <button 
              className={`w-12 h-12 rounded-xl border border-border shadow-sm flex items-center justify-center transition-all cursor-pointer ${activePicker === 'solid' ? 'ring-2 ring-accent scale-105' : 'hover:scale-105'}`}
              style={{ backgroundColor: solidColor }}
              onClick={() => setActivePicker(activePicker === 'solid' ? null : 'solid')}
              title="Click to edit color"
            />
          </div>
          {activePicker === 'solid' && (
            <div className="p-md border border-border rounded-xl bg-bg-card shadow-sm animation-fade-in mt-sm">
              <ColorPicker color={solidColor} onChange={handleSolidChange} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'gradient' && (
        <div className="bg-gradient-editor">
          <div className="preset-grid mb-lg">
            {GRADIENT_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                className={`preset-btn ${isPresetActive(preset) ? 'active' : ''}`}
                style={{ background: `linear-gradient(${preset.angle}deg, ${preset.colorA}, ${preset.colorB})` }}
                onClick={() => handleGradientChange({ colorA: preset.colorA, colorB: preset.colorB, angle: preset.angle })}
                title={preset.name}
              >
                {isPresetActive(preset) && <Check size={16} color="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />}
              </button>
            ))}
          </div>

          <div className="gradient-controls mb-md p-lg border border-border rounded-xl bg-bg-secondary">
            <div className="flex gap-md mb-lg">
              <button 
                className={`stop-btn ${activePicker === 'gradientA' ? 'active' : ''}`}
                onClick={() => setActivePicker(activePicker === 'gradientA' ? null : 'gradientA')}
              >
                <div className="stop-color" style={{ backgroundColor: gradient.colorA }}></div>
                <span className="text-sm font-semibold">Color A</span>
              </button>
              <button 
                className={`stop-btn ${activePicker === 'gradientB' ? 'active' : ''}`}
                onClick={() => setActivePicker(activePicker === 'gradientB' ? null : 'gradientB')}
              >
                <div className="stop-color" style={{ backgroundColor: gradient.colorB }}></div>
                <span className="text-sm font-semibold">Color B</span>
              </button>
            </div>
            
            <div className="angle-selector">
              <div className="flex justify-between items-center mb-xs">
                <span className="text-sm font-semibold text-secondary">Gradient Angle</span>
                <span className="text-sm font-mono">{gradient.angle}°</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="360" 
                value={gradient.angle}
                onChange={(e) => handleGradientChange({ angle: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer mt-xs"
              />
            </div>
          </div>
          
          {(activePicker === 'gradientA' || activePicker === 'gradientB') && (
            <div className="p-md border border-border rounded-xl bg-bg-card shadow-sm animation-fade-in">
              <ColorPicker 
                color={activePicker === 'gradientA' ? gradient.colorA : gradient.colorB}
                onChange={(hex) => handleGradientChange({ [activePicker === 'gradientA' ? 'colorA' : 'colorB']: hex })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
