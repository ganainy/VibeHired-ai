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
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600 dark:text-amber-400">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 font-display">
                        Insufficient Credits
                    </h2>

                    <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                        {PAYMENTS_ENABLED
                            ? "You've reached your AI credit limit for this billing period. Upgrade your plan to continue using AI-powered features."
                            : "You've used all your free credits. Paid plans are coming soon — check back shortly to get more credits."}
                    </p>

                    <div className="flex flex-col gap-3">
                        {PAYMENTS_ENABLED ? (
                            <button
                                onClick={handleUpgrade}
                                className="w-full py-3 bg-gold-500 hover:bg-gold-600 text-gold-950 font-bold rounded-xl transition-all shadow-lg shadow-gold-500/20"
                            >
                                View Plans & Upgrade
                            </button>
                        ) : (
                            <div className="w-full py-3 text-center rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 font-semibold text-sm cursor-not-allowed">
                                Paid plans coming soon
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-medium transition-colors"
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
