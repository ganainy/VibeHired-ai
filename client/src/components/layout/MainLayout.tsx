import React, { useEffect, useState } from 'react';
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
    const userId = user?.id ?? null;

    // Poll for pending suggestion count every 60 seconds
    useEffect(() => {
        if (!userId) return;

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
        const interval = setInterval(fetchCount, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [userId]);

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
