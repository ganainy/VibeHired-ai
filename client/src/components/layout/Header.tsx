import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { VibeHiredLogo } from '../VibeHiredLogo';
// ── Inbox icon (email suggestions) ───────────────────────────────────────────────────────
const InboxIconMobile = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
);
// ── Icons ─────────────────────────────────────────────────────────────────────

const HamburgerIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CloseIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const DashboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const WorkIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const AutoJobsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const AnalyticsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8V6m-4 6V8M8 16v-4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
);

const PortfolioIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M5 21v-1a7 7 0 0114 0v1" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.41-1.41M18.36 5.64l1.41-1.41" />
    </svg>
);

const TimeTrackerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
    </svg>
);

const PrepLibraryIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const CreditCardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const InterviewBuddyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
        <path d="M19 10a7 7 0 01-14 0" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const SunIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
);

const MoonIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
);

const LogoutIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4m7 14l5-5m0 0l-5-5m5 5H9" />
    </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

interface HeaderProps {
    pendingEmailCount?: number;
}

const Header: React.FC<HeaderProps> = ({ pendingEmailCount = 0 }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Close menu on route change
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when menu open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMenuOpen]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActiveRoute = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
        { path: '/manage-cv', label: 'CV Library', icon: WorkIcon },
        { path: '/email-suggestions', label: 'Inbox', icon: InboxIconMobile, badge: pendingEmailCount > 0 ? pendingEmailCount : undefined },
        { path: '/auto-jobs', label: 'Auto Jobs', icon: AutoJobsIcon, disabled: true },
        { path: '/interview-materials', label: 'Prep Library', icon: PrepLibraryIcon },
        { path: '/work-tracker', label: 'Time Tracker', icon: TimeTrackerIcon },
        { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
        { path: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
        { path: '/portfolio-setup', label: 'Portfolio', icon: PortfolioIcon },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
        { path: '/subscriptions', label: 'Subscription', icon: CreditCardIcon },
    ];

    const adminNavItems = [
        { path: '/admin', label: 'Admin Dashboard', icon: AnalyticsIcon },
        { path: '/admin/users', label: 'User Management', icon: PortfolioIcon },
        { path: '/interview-buddy', label: 'Interview Buddy', icon: InterviewBuddyIcon },
    ];

    const mobileOnboardingNavByPath: Record<string, string> = {
        '/dashboard': 'mobile-nav-dashboard',
        '/manage-cv': 'mobile-nav-manage-cv',
        '/email-suggestions': 'mobile-nav-email-suggestions',
        '/interview-materials': 'mobile-nav-interview-materials',
        '/work-tracker': 'mobile-nav-work-tracker',
        '/calendar': 'mobile-nav-calendar',
        '/analytics': 'mobile-nav-analytics',
        '/portfolio-setup': 'mobile-nav-portfolio-setup',
        '/settings': 'mobile-nav-settings',
        '/subscriptions': 'mobile-nav-subscriptions',
    };

    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
    const userLabel = user?.email?.split('@')[0] || 'User';

    return (
        <>
            {/* ── Mobile Top Bar (md:hidden) ── */}
            <header
                className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 border-b"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
                {/* Left: Menu button */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    data-onboarding="mobile-menu-button"
                    className="p-2 rounded-lg transition-colors -ml-2"
                    style={{ color: 'var(--text-primary)' }}
                    aria-label="Toggle menu"
                >
                    {isMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
                </button>

                {/* Center: Brand logo only (no image) */}
                <Link to="/dashboard" className="flex-1 flex justify-center">
                    <VibeHiredLogo size={24} className="px-0" />
                </Link>

                {/* Right: Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg transition-colors -mr-2"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
            </header>

            {/* ── Mobile Drawer Menu ── */}
            {isMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    {/* Drawer */}
                    <div
                        className="md:hidden fixed top-14 left-0 right-0 bottom-0 z-50 overflow-y-auto flex flex-col"
                        style={{ backgroundColor: 'var(--bg-surface)' }}
                    >
                        {/* User Profile Header */}
                        <div
                            className="flex items-center gap-4 px-6 py-6 border-b"
                            style={{ borderColor: 'var(--border)', background: 'linear-gradient(to bottom, var(--bg-surface), var(--bg-elevated))' }}
                        >
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold font-mono shrink-0 shadow-sm"
                                style={{
                                    backgroundColor: 'var(--accent-bg, rgba(232,184,68,0.12))',
                                    color: 'var(--accent)',
                                    border: '1px solid rgba(232,184,68,0.3)'
                                }}
                            >
                                {userInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{userLabel}</p>
                                <p className="text-xs opacity-70 truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                            </div>
                        </div>

                        {/* Nav items */}
                        <nav className="flex-1 px-4 py-6 space-y-1.5">
                            {navItems.map((item) => {
                                const isActive = isActiveRoute(item.path);
                                const isDisabled = !!(item as any).disabled;

                                if (isDisabled) {
                                    return (
                                        <div
                                            key={item.path}
                                            className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-[0.9375rem] font-medium cursor-not-allowed select-none opacity-40"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            <div className="w-5 h-5 flex items-center justify-center">
                                                <item.icon />
                                            </div>
                                            {item.label}
                                            <span
                                                className="ml-auto text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                Coming Soon
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        data-onboarding={mobileOnboardingNavByPath[item.path]}
                                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-[0.9375rem] font-semibold transition-all duration-200 active:scale-95"
                                        style={{
                                            backgroundColor: isActive ? 'var(--accent-bg, rgba(232,184,68,0.12))' : 'transparent',
                                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                        }}
                                    >
                                        <div className={`w-5 h-5 flex items-center justify-center transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                                            <item.icon />
                                        </div>
                                        {item.label}
                                        {(item as any).badge ? (
                                            <span
                                                className="ml-auto min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-black px-1.5 shadow-sm"
                                                style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                                            >
                                                {(item as any).badge > 9 ? '9+' : (item as any).badge}
                                            </span>
                                        ) : isActive ? (
                                            <span
                                                className="ml-auto w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(232,184,68,0.6)]"
                                                style={{ backgroundColor: 'var(--accent)' }}
                                            />
                                        ) : null}
                                    </Link>
                                );
                            })}

                            {/* Admin Section */}
                            {(user?.role === 'admin' || user?.role === 'owner') && (
                                <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                                    <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.15em] opacity-50" style={{ color: 'var(--text-muted)' }}>Admin Controls</p>
                                    <div className="space-y-1">
                                        {adminNavItems.map((item) => {
                                            const isActive = isActiveRoute(item.path);
                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-[0.9375rem] font-semibold transition-all duration-200 active:scale-95"
                                                    style={{
                                                        backgroundColor: isActive ? 'var(--accent-bg, rgba(232,184,68,0.12))' : 'transparent',
                                                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                                    }}
                                                >
                                                    <div className={`w-5 h-5 flex items-center justify-center transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                                                        <item.icon />
                                                    </div>
                                                    {item.label}
                                                    {isActive && (
                                                        <span
                                                            className="ml-auto w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(232,184,68,0.6)]"
                                                            style={{ backgroundColor: 'var(--accent)' }}
                                                        />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </nav>

                        {/* Bottom Actions Area */}
                        <div
                            className="px-6 py-6 border-t flex flex-col gap-3"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                        >
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleTheme}
                                    className="flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                >
                                    <div className="text-accent">
                                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                                    </div>
                                    <span>{theme === 'dark' ? 'Light Appearance' : 'Dark Appearance'}</span>
                                </button>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm"
                                style={{ backgroundColor: 'rgba(244,100,100,0.1)', color: 'var(--rose, #f46464)', border: '1px solid rgba(244,100,100,0.2)' }}
                            >
                                <LogoutIcon />
                                <span>Sign Out</span>
                            </button>
                            
                            <p className="text-[10px] text-center mt-2 opacity-40 font-medium" style={{ color: 'var(--text-muted)' }}>
                                VibeHired Assistant v1.2.0
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* ── Mobile spacer so content isn't behind fixed header ── */}
            <div className="md:hidden h-14 flex-shrink-0" />
        </>
    );
};

export default Header;
