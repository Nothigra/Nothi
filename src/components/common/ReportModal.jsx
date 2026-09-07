import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Flag, CheckCircle2 } from 'lucide-react';
import { supabase, withTimeoutSafety } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Textarea from '../ui/Textarea';

const PRODUCT_REASONS = [
  "Misleading content",
  "Adult/+18 content",
  "Copyright infringement",
  "Spam or scam",
  "Broken/doesn't work as described",
  "Other"
];

const CREATOR_REASONS = [
  "Impersonation",
  "Harassment/abusive behavior",
  "Spam or scam",
  "Inappropriate profile content",
  "Other"
];

export default function ReportModal({ isOpen, onClose, type, targetId }) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    console.log('[DEBUG] ReportModal useEffect [isOpen] fired, isOpen:', isOpen);
    if (isOpen) {
      setSelectedReason(null);
      setComment('');
      setIsSubmitting(false);
      setIsSuccess(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    console.log('[DEBUG] ReportModal MOUNTED');
    return () => console.log('[DEBUG] ReportModal UNMOUNTED');
  }, []);

  console.log('[DEBUG] ReportModal RENDERED, comment:', comment);

  if (!isOpen) return null;

  const reasons = type === 'product' ? PRODUCT_REASONS : CREATOR_REASONS;
  const title = type === 'product' ? 'Report Product' : 'Report Creator Profile';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const trimmedComment = comment.trim();
    if (!selectedReason && !trimmedComment) {
      setError('Please select a reason or describe the issue');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        reporter_id: user.id,
        reason: selectedReason || 'Other',
        details: trimmedComment || null
      };

      if (type === 'product') {
        payload.reported_product_id = targetId;
      } else {
        payload.reported_user_id = targetId;
      }

      await withTimeoutSafety(() => supabase
        .from('reports')
        .insert([payload])
      );

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isSubmitting && !isSuccess ? onClose : undefined} />
      
      <div className="relative w-full max-w-md bg-bg border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style={{ animationDuration: '200ms' }}>
        {isSuccess ? (
          <div className="p-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-success-subtle text-success flex items-center justify-center mb-md">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold mb-sm">Report Submitted</h3>
            <p className="text-secondary mb-xl">
              Thank you for bringing this to our attention. Our team will review the report shortly.
            </p>
            <button className="btn btn-primary w-full" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-lg border-b border-border">
              <div className="flex items-center gap-sm font-bold text-lg">
                <Flag size={20} className="text-red-500" />
                {title}
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-secondary text-secondary transition-colors"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-lg flex flex-col gap-lg overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-bold mb-md">Why are you reporting this?</label>
                <div className="flex flex-col gap-sm">
                  {reasons.map(reason => (
                    <label 
                      key={reason}
                      className={`flex items-center gap-md p-md rounded-xl cursor-pointer transition-all ${
                        selectedReason === reason 
                          ? '' 
                          : 'border border-border hover:border-border-strong bg-bg-secondary'
                      }`}
                      style={
                        selectedReason === reason 
                          ? { border: '2px solid var(--color-accent)', backgroundColor: 'var(--color-accent-subtle)' } 
                          : {}
                      }
                    >
                      <input 
                        type="radio" 
                        name="reportReason"
                        className="hidden" 
                        checked={selectedReason === reason} 
                        onChange={() => {
                          setSelectedReason(reason);
                          if (error) setError('');
                        }} 
                      />
                      {selectedReason === reason ? (
                        <CheckCircle2 className="text-accent" size={20} />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-secondary" />
                      )}
                      <span className="font-medium text-sm select-none">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Textarea
                  label="Additional Comments (Optional)"
                  placeholder="Provide more details about your report..."
                  value={comment}
                  onChange={(e) => {
                    console.log('Textarea onChange fired, new value:', e.target.value);
                    setComment(e.target.value);
                    if (error) setError('');
                  }}
                  minRows={3}
                />
              </div>

              <div className="pt-md mt-sm border-t border-border flex flex-col gap-sm">
                {error && (
                  <div className="text-red-500 text-sm font-medium text-right animate-in fade-in slide-in-from-top-1">
                    {error}
                  </div>
                )}
                <div className="flex gap-md justify-end">
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
