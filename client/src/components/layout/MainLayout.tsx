import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div
            className="flex h-screen overflow-hidden"
            style={{ backgroundColor: 'var(--bg-base)' }}
        >
            {/* Desktop sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Mobile header (hidden on md+) */}
                <Header />

                {/* Page content */}
                <main
                    className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar"
                    style={{ backgroundColor: 'var(--bg-base)' }}
                >
                    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
