import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import CreditLimitModal from '../usage/CreditLimitModal';
import { listPendingSuggestions } from '../../services/emailSuggestionsApi';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { user, showCreditLimitModal, setShowCreditLimitModal } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const userId = user?.id ?? null;
    const location = useLocation();

    // Fetch pending suggestion count only when user explicitly navigates to Inbox.
    useEffect(() => {
        if (!userId) return;
        if (!location.pathname.startsWith('/email-suggestions')) return;

        let cancelled = false;
        const fetchCount = async () => {
            try {
                const suggestions = await listPendingSuggestions();
                if (!cancelled) setPendingCount(suggestions.length);
            } catch {
                // non-fatal
            }
        };

        fetchCount();
        return () => {
            cancelled = true;
        };
    }, [userId, location.pathname]);

    return (
        <div
            className="flex h-screen overflow-hidden"
            style={{ backgroundColor: 'var(--bg-base)' }}
        >
            {/* Desktop sidebar */}
            <Sidebar pendingEmailCount={pendingCount} />

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Page content */}
                <main
                    className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar"
                    style={{ backgroundColor: 'var(--bg-base)' }}
                >
                    <div className="max-w-7xl mx-auto w-full px-6 lg:px-8 py-6">
                        {children}
                    </div>
                </main>
            </div>

            {/* Global Modals */}
            <CreditLimitModal
                isOpen={showCreditLimitModal}
                onClose={() => setShowCreditLimitModal(false)}
            />
        </div>
    );
};

export default MainLayout;
