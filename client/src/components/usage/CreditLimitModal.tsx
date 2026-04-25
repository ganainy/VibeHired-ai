import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PAYMENTS_ENABLED } from '../../utils/featureFlags';

interface CreditLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreditLimitModal: React.FC<CreditLimitModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    navigate('/subscriptions');
  };

  return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
  <div className="rounded-2xl shadow-warm-lg max-w-md w-full mx-4 overflow-hidden border border-theme" style={{ backgroundColor: 'var(--bg-surface)' }}>
  <div className="p-8 text-center">
  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--ember-bg)', color: 'var(--ember)' }}>
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
  </div>

  <h2 className="text-2xl font-bold mb-2 font-display text-primary-color">
  Insufficient Credits
  </h2>

  <p className="text-secondary-color mb-8">
  {PAYMENTS_ENABLED
  ? "You've reached your AI credit limit for this billing period. Upgrade your plan to continue using AI-powered features."
  : "You've used all your free credits. Paid plans are coming soon — check back shortly to get more credits."}
  </p>

  <div className="flex flex-col gap-3">
  {PAYMENTS_ENABLED ? (
  <button
  onClick={handleUpgrade}
  className="btn-primary w-full py-3 font-bold shadow-lg"
  >
  View Plans & Upgrade
  </button>
  ) : (
  <div className="w-full py-3 text-center rounded-xl text-sm cursor-not-allowed font-semibold" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
  Paid plans coming soon
  </div>
  )}
  <button
  onClick={onClose}
  className="w-full py-3 font-medium transition-colors text-secondary-color hover:text-primary-color"
  >
  Maybe Later
  </button>
  </div>
  </div>
  </div>
  </div>
  );
};

export default CreditLimitModal;