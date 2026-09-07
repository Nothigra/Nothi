import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, UploadCloud, Link as LinkIcon, Palette } from 'lucide-react';
import Input from '../../components/ui/Input';
import './DashboardStore.css';

const presetColors = [
  '#6366F1', '#3B82F6', '#0EA5E9', '#10B981', 
  '#22C55E', '#EAB308', '#F59E0B', '#EF4444', 
  '#EC4899', '#D946EF', '#8B5CF6', '#141414'
];

export default function DashboardStore() {
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  const [storeData, setStoreData] = useState({
    name: '',
    username: '',
    avatar: null,
    banner: null,
    color: '#6366F1'
  });

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    alert("Store Created! This will connect to backend later.");
  };

  return (
    <div className="store-wizard">
      <div className="wizard-header">
        <div>
          <h2 className="text-xl font-bold mb-xs">Store Setup</h2>
          <p className="text-muted text-sm">Step {step} of {totalSteps}</p>
        </div>
        <div className="wizard-progress">
          {[...Array(totalSteps)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                className={`wizard-step-dot ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'completed' : ''}`}
              />
              {i < totalSteps - 1 && (
                <div className={`wizard-step-line ${step > i + 1 ? 'completed' : ''}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        <div className="wizard-form glass-card">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <h3 className="wizard-step-title">Store Name</h3>
                <p className="wizard-step-desc">What is the name of your creative brand?</p>
                
                <div className="form-group mt-lg">
                  <Input
                    label="Store Name"
                    placeholder="e.g. Acme Studios"
                    value={storeData.name}
                    onChange={(e) => setStoreData({...storeData, name: e.target.value})}
                    autoFocus
                    size="lg"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <h3 className="wizard-step-title">Store URL</h3>
                <p className="wizard-step-desc">Choose a unique username for your store link.</p>
                
                <div className="form-group mt-lg">
                  <Input
                    label="Store URL"
                    prefix="Nothi.store/"
                    placeholder="username"
                    value={storeData.username}
                    onChange={(e) => setStoreData({...storeData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                    autoFocus
                    size="lg"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <h3 className="wizard-step-title">Profile Picture</h3>
                <p className="wizard-step-desc">Upload a logo or photo for your creator profile.</p>
                
                <div className="upload-area mt-lg">
                  <UploadCloud size={32} className="text-muted" />
                  <p className="font-semibold">Click to upload avatar</p>
                  <p className="text-sm text-muted">PNG, JPG up to 2MB</p>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <h3 className="wizard-step-title">Store Banner</h3>
                <p className="wizard-step-desc">Add a cover image to make your store stand out.</p>
                
                <div className="upload-area mt-lg" style={{ aspectRatio: '21/9', padding: 'var(--space-4)', justifyContent: 'center' }}>
                  <UploadCloud size={32} className="text-muted" />
                  <p className="font-semibold">Upload Banner Image</p>
                  <p className="text-sm text-muted">1500x500px recommended</p>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <h3 className="wizard-step-title">Accent Color</h3>
                <p className="wizard-step-desc">Choose a brand color for buttons and highlights.</p>
                
                <div className="color-picker-grid mt-lg">
                  {presetColors.map(color => (
                    <div 
                      key={color}
                      className={`color-swatch ${storeData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setStoreData({...storeData, color})}
                    >
                      {storeData.color === color && <Check size={16} />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div 
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <h3 className="wizard-step-title">Live Preview</h3>
                <p className="wizard-step-desc">Review how your store will look to customers.</p>
                <p className="text-sm text-muted">Check the preview card on the right to see your branding in action. You can go back if you want to make changes.</p>
              </motion.div>
            )}

            {step === 7 && (
              <motion.div 
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
              >
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-6)', color: 'white' }}>
                  <Check size={32} />
                </div>
                <h3 className="wizard-step-title">You're all set!</h3>
                <p className="wizard-step-desc">Your store is ready. You can now start uploading products and selling to thousands of creators.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="wizard-actions">
            {step > 1 && step < totalSteps ? (
              <button className="btn btn-outline" onClick={handlePrev}>Back</button>
            ) : (
              <div></div>
            )}
            
            {step < totalSteps ? (
              <button 
                className="btn btn-primary" 
                onClick={handleNext}
                disabled={(step === 1 && !storeData.name) || (step === 2 && !storeData.username)}
              >
                Continue
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleFinish}>Launch Store</button>
            )}
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="live-preview">
          <div className="preview-banner">
            <div className="preview-avatar">
              {storeData.name ? storeData.name.charAt(0).toUpperCase() : 'S'}
            </div>
          </div>
          <div className="preview-info">
            <h4 className="preview-name">{storeData.name || 'Store Name'}</h4>
            <p className="preview-url">Nothi.store/{storeData.username || 'username'}</p>
            <p className="text-sm text-muted mb-md">Welcome to my store! I create premium assets for video editors.</p>
            <div 
              className="preview-btn"
              style={{ backgroundColor: storeData.color }}
            >
              Follow
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
