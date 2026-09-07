import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, MessageSquare, Check, Copy, CheckCircle2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitContactMessage } from '../lib/accountStore';
import './ContactPage.css';

const DISCORD_INVITE_URL = null; // null triggers the 'Coming soon' disabled state

// TODO: replace with real contact email before launch
const CONTACT_EMAIL = 'contact@nothi.io';

export default function ContactPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ name: '', email: '', reason: 'general', message: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(CONTACT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t('contact.errorRequired', 'This field is required');
    if (!formData.email.trim()) {
      newErrors.email = t('contact.errorRequired', 'This field is required');
    } else if (!validateEmail(formData.email)) {
      newErrors.email = t('contact.errorEmail', 'Please enter a valid email');
    }
    if (!formData.message.trim()) newErrors.message = t('contact.errorRequired', 'This field is required');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    submitContactMessage({
      name: formData.name,
      email: formData.email,
      reason: formData.reason,
      message: formData.message
    });

    setIsSubmitting(false);
    setShowSuccess(true);
    setFormData({ name: '', email: '', reason: 'general', message: '' });

    setTimeout(() => setShowSuccess(false), 5000);
  };

  const reasons = [
    { id: 'general', label: t('contact.reasonGeneral', 'General question') },
    { id: 'partnership', label: t('contact.reasonPartnership', 'Partnership') },
    { id: 'bug', label: t('contact.reasonBug', 'Bug report') },
    { id: 'other', label: t('contact.reasonOther', 'Other') }
  ];

  return (
    <div className="static-page">
      <div className="static-header">
        <motion.h1 
          className="static-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {t('contact.title', 'Contact Us')}
        </motion.h1>
        <motion.p 
          className="static-intro"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {t('contact.intro', "Have a question or want to partner with us? Here's how to reach us.")}
        </motion.p>
      </div>

      <div className="contact-grid">
        {/* Email Block */}
        <motion.div 
          className="contact-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="contact-icon-wrapper">
            <Mail size={24} />
          </div>
          <h2 className="contact-card-title">{t('contact.emailTitle', 'General Inquiries & Partnerships')}</h2>
          <div className="contact-card-desc">
            <div className="contact-email-display">{CONTACT_EMAIL}</div>
          </div>
          <div className="contact-actions mt-auto">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary flex-1 text-center justify-center">
              {t('contact.title', 'Contact Us')}
            </a>
            <button onClick={handleCopyEmail} className="btn btn-outline flex-1 text-center justify-center gap-xs">
              {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              {copied ? t('contact.copied', 'Copied!') : t('contact.copyEmail', 'Copy email')}
            </button>
          </div>
        </motion.div>

        {/* Discord Block */}
        <motion.div 
          className={`contact-card ${!DISCORD_INVITE_URL ? 'disabled' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {!DISCORD_INVITE_URL && (
            <div className="badge-coming-soon">{t('contact.comingSoon', 'Coming soon')}</div>
          )}
          <div className="contact-icon-wrapper" style={DISCORD_INVITE_URL ? { background: '#5865F220', color: '#5865F2' } : {}}>
            <MessageSquare size={24} />
          </div>
          <h2 className="contact-card-title">{t('contact.discordTitle', 'Quick Questions & Community')}</h2>
          <p className="contact-card-desc">
            {t('contact.discordDesc', 'The future place for quick questions and connecting with other editors on the platform.')}
          </p>
          <div className="contact-actions mt-auto">
            <a 
              href={DISCORD_INVITE_URL || '#'} 
              className={`btn btn-lg w-full text-center justify-center ${DISCORD_INVITE_URL ? 'btn-discord' : 'btn-outline'}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => !DISCORD_INVITE_URL && e.preventDefault()}
            >
              {t('contact.joinDiscord', 'Join our Discord')}
            </a>
          </div>
        </motion.div>
      </div>

      {/* Form Section */}
      <motion.div 
        className="contact-form-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <h2 className="contact-form-title">{t('contact.formTitle', 'Send us a Message')}</h2>

        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              className="form-success-toast"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            >
              <CheckCircle2 size={20} />
              {t('contact.successMessage', "Message sent successfully! We'll get back to you soon.")}
            </motion.div>
          )}
        </AnimatePresence>

        <form className="contact-form" onSubmit={handleFormSubmit}>
          <div className="form-row">
            <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
              <label htmlFor="name">{t('contact.nameLabel', 'Name')}</label>
              <input 
                type="text" 
                id="name" 
                placeholder={t('contact.namePlaceholder', 'Your name')}
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={isSubmitting}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div className={`form-group ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="email">{t('contact.emailLabel', 'Email address')}</label>
              <input 
                type="email" 
                id="email" 
                placeholder={t('contact.emailPlaceholder', 'you@example.com')}
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                disabled={isSubmitting}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
          </div>

          <div className="form-group">
            <label>{t('contact.reasonLabel', 'How can we help?')}</label>
            <div className="reasons-grid">
              {reasons.map((reason) => (
                <label 
                  key={reason.id} 
                  className={`reason-card ${formData.reason === reason.id ? 'selected' : ''}`}
                >
                  <input 
                    type="radio" 
                    name="reason" 
                    value={reason.id}
                    checked={formData.reason === reason.id}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    disabled={isSubmitting}
                  />
                  <span>{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={`form-group ${errors.message ? 'has-error' : ''}`}>
            <label htmlFor="message">{t('contact.messageLabel', 'Message')}</label>
            <textarea 
              id="message" 
              placeholder={t('contact.messagePlaceholder', 'How can we help you today?')}
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              disabled={isSubmitting}
            />
            {errors.message && <span className="form-error">{errors.message}</span>}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg mt-md w-full justify-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-sm">
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                {t('contact.submittingBtn', 'Sending...')}
              </span>
            ) : (
              <span className="flex items-center gap-sm">
                <Send size={18} />
                {t('contact.submitBtn', 'Send Message')}
              </span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
