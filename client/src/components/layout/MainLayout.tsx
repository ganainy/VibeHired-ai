import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CreditLimitModal from '../usage/CreditLimitModal';
import RouteOnboarding from '../onboarding/RouteOnboarding';
import { listPendingSuggestions } from '../../services/emailSuggestionsApi';
import { useAuth } from '../../context/AuthContext';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { user, showCreditLimitModal, setShowCreditLimitModal } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);

    const refreshCount = useCallback(async () => {
        if (!user) return;
        try {
            const suggestions = await listPendingSuggestions();
            setPendingCount(suggestions.length);
        } catch {
            // non-fatal
        }
    }, [user]);

    // Poll for pending suggestion count every 60 seconds
    useEffect(() => {
        refreshCount();
        const interval = setInterval(refreshCount, 60_000);
        return () => clearInterval(interval);
    }, [refreshCount]);

    return (
        <div
            className="flex h-screen overflow-hidden"
            style={{ backgroundColor: 'var(--bg-base)' }}
        >
            {/* Desktop sidebar */}
            <Sidebar pendingEmailCount={pendingCount} />

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Mobile header (hidden on md+) */}
                <Header pendingEmailCount={pendingCount} />

                {/* Page content */}
                <main
                    data-onboarding="main-content"
                    className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar"
                    style={{ backgroundColor: 'var(--bg-base)' }}
                >
                    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
                        {children}
                    </div>
                </main>
            </div>

            <RouteOnboarding />

            {/* Global Modals */}
            <CreditLimitModal
                isOpen={showCreditLimitModal}
                onClose={() => setShowCreditLimitModal(false)}
            />
        </div>
    );
};

export default MainLayout;
