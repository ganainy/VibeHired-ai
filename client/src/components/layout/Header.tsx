import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import appLogo from '../../assets/app-logo.png';
// ── Inbox icon (email suggestions) ───────────────────────────────────────────────────────
const InboxIconMobile = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
);
// ── Icons ─────────────────────────────────────────────────────────────────────

const Logo = () => (
    <img src={appLogo} alt="VibeHired" width="24" height="24" style={{ borderRadius: '6px', display: 'block', objectFit: 'contain' }} />
);

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
        { path: '/manage-cv', label: 'Manage CV', icon: WorkIcon },
        { path: '/email-suggestions', label: 'Inbox', icon: InboxIconMobile, badge: pendingEmailCount > 0 ? pendingEmailCount : undefined },
        { path: '/auto-jobs', label: 'Auto Jobs', icon: AutoJobsIcon, disabled: true },
        { path: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
        { path: '/portfolio-setup', label: 'Portfolio', icon: PortfolioIcon },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
        { path: '/work-tracker', label: 'Time Tracker', icon: TimeTrackerIcon },
    ];

    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
    const userLabel = user?.email?.split('@')[0] || 'User';

    return (
        <>
            {/* ── Mobile Top Bar (md:hidden) ── */}
            <header
                className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 border-b"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
                {/* Brand */}
                <Link to="/dashboard" className="flex items-center gap-2">
                    <span style={{ color: 'var(--accent)' }}>
                        <Logo />
                    </span>
                    <span
                        className="font-semibold text-[1rem] tracking-tight"
                        style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
                    >
                        VibeHired
                    </span>
                </Link>

                {/* Right actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    </button>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
                    </button>
                </div>
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
                        {/* User chip */}
                        <div
                            className="flex items-center gap-3 px-5 py-4 border-b"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-mono shrink-0"
                                style={{
                                    backgroundColor: 'var(--accent-bg, rgba(232,184,68,0.12))',
                                    color: 'var(--accent)',
                                    border: '1px solid rgba(232,184,68,0.25)'
                                }}
                            >
                                {userInitial}
                            </div>
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{userLabel}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                            </div>
                        </div>

                        {/* Nav items */}
                        <nav className="flex-1 px-3 py-4 space-y-1">
                            {navItems.map((item, i) => {
                                const isActive = isActiveRoute(item.path);
                                const isDisabled = !!(item as any).disabled;

                                if (isDisabled) {
                                    return (
                                        <div
                                            key={item.path}
                                            className="flex items-center gap-3.5 px-4 py-3.5 rounded-lg text-[0.9375rem] font-medium cursor-not-allowed select-none"
                                            style={{ opacity: 0.45, color: 'var(--text-muted)' }}
                                        >
                                            <item.icon />
                                            {item.label}
                                            <span
                                                className="ml-auto text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                                            >
                                                Soon
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className="flex items-center gap-3.5 px-4 py-3.5 rounded-lg text-[0.9375rem] font-medium transition-all"
                                        style={{
                                            backgroundColor: isActive ? 'var(--accent-bg, rgba(232,184,68,0.09))' : 'transparent',
                                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                            animationDelay: `${i * 40}ms`,
                                        }}
                                    >
                                        <item.icon />
                                        {item.label}
                                        {(item as any).badge ? (
                                            <span
                                                className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold px-1"
                                                style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                                            >
                                                {(item as any).badge > 9 ? '9+' : (item as any).badge}
                                            </span>
                                        ) : isActive ? (
                                            <span
                                                className="ml-auto w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: 'var(--accent)' }}
                                            />
                                        ) : null}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Footer */}
                        <div
                            className="px-5 py-5 border-t flex items-center justify-between"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <button
                                onClick={toggleTheme}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                            >
                                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                style={{ backgroundColor: 'rgba(244,100,100,0.08)', color: 'var(--rose, #f46464)', border: '1px solid rgba(244,100,100,0.2)' }}
                            >
                                <LogoutIcon />
                                <span>Sign out</span>
                            </button>
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
