import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import appLogo from '../../assets/app-logo.png';
import { VibeHiredLogo } from '../VibeHiredLogo';

// ── Email inbox icon ──────────────────────────────────────────────────────────
const InboxIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
);

// ── Icons ────────────────────────────────────────────────────────────────────

const Logo = () => (
    <img src={appLogo} alt="VibeHired" width="28" height="28" style={{ borderRadius: '7px', display: 'block', objectFit: 'contain' }} />
);

const DashboardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const WorkIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const AutoJobsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const AnalyticsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8V6m-4 6V8M8 16v-4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
);

const PortfolioIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M5 21v-1a7 7 0 0114 0v1" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
);

const CreditCardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const PrepLibraryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
);

const TimeTrackerIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const SunIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
);

const MoonIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
);

const LogoutIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4m7 14l5-5m0 0l-5-5m5 5H9" />
    </svg>
);

const ChevronLeftIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
    </svg>
);

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
    </svg>
);

const InterviewBuddyIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
        <path d="M19 10a7 7 0 01-14 0" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const AlertIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

interface SidebarProps {
    pendingEmailCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ pendingEmailCount = 0 }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActiveRoute = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard';
        if (path === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(path);
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
        { path: '/manage-cv', label: 'Manage CV', icon: WorkIcon },
        { path: '/email-suggestions', label: 'Inbox', icon: InboxIcon, badge: pendingEmailCount > 0 ? pendingEmailCount : undefined },
        { path: '/auto-jobs', label: 'Auto Jobs', icon: AutoJobsIcon, disabled: true },
        { path: '/interview-materials', label: 'Prep Library', icon: PrepLibraryIcon },
        { path: '/work-tracker', label: 'Time Tracker', icon: TimeTrackerIcon },
        { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
        { path: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
        { path: '/portfolio-setup', label: 'Portfolio', icon: PortfolioIcon },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
        { path: '/subscriptions', label: 'Subscription', icon: CreditCardIcon },
    ];

    const onboardingNavByPath: Record<string, string> = {
        '/dashboard': 'nav-dashboard',
        '/manage-cv': 'nav-manage-cv',
        '/email-suggestions': 'nav-email-suggestions',
        '/interview-materials': 'nav-interview-materials',
        '/work-tracker': 'nav-work-tracker',
        '/calendar': 'nav-calendar',
        '/analytics': 'nav-analytics',
        '/portfolio-setup': 'nav-portfolio-setup',
        '/settings': 'nav-settings',
        '/subscriptions': 'nav-subscriptions',
    };

    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
    const userLabel = user?.email?.split('@')[0] || 'User';

    return (
        <aside
            data-onboarding="sidebar"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            className={`hidden md:flex flex-col h-screen flex-shrink-0 transition-all duration-300 relative border-r
                ${isCollapsed ? 'w-[72px]' : 'w-[230px]'}`}
        >
            {/* Collapse toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                className="absolute -right-3.5 top-[52px] w-7 h-7 rounded-full border flex items-center justify-center z-50 transition-all hover:border-gold-400 group shadow-ink-sm"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <span style={{ color: 'var(--text-muted)' }} className="group-hover:text-accent transition-colors">
                    {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                </span>
            </button>

            {/* ── Brand ── */}
            <Link
                to="/dashboard"
                className="flex items-center h-[64px] border-b transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border)', paddingLeft: isCollapsed ? '0' : '20px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
            >
                {!isCollapsed && (
                    <VibeHiredLogo size={36} />
                )}
            </Link>

            {/* ── Navigation ── */}
            <nav className="flex-1 py-5 overflow-y-auto overflow-x-hidden">
                <div className={`space-y-0.5 ${isCollapsed ? 'px-2.5' : 'px-3'}`}>
                    {navItems.map((item) => {
                        const isActive = isActiveRoute(item.path);
                        const isDisabled = !!(item as any).disabled;

                        if (isDisabled) {
                            return (
                                <div
                                    key={item.path}
                                    title={isCollapsed ? `${item.label} (coming soon)` : undefined}
                                    className="flex items-center rounded-lg relative cursor-not-allowed select-none"
                                    style={{
                                        padding: isCollapsed ? '10px' : '9px 12px',
                                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                                        gap: isCollapsed ? '0' : '10px',
                                        opacity: 0.45,
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    <item.icon />
                                    {!isCollapsed && (
                                        <>
                                            <span className="text-[0.875rem] font-medium tracking-[-0.01em]">{item.label}</span>
                                            <span
                                                className="ml-auto text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                                            >
                                                Soon
                                            </span>
                                        </>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                title={isCollapsed ? item.label : undefined}
                                data-onboarding={onboardingNavByPath[item.path]}
                                className="flex items-center rounded-lg transition-all duration-150 group relative"
                                style={{
                                    padding: isCollapsed ? '10px' : '9px 12px',
                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                                    gap: isCollapsed ? '0' : '10px',
                                    backgroundColor: isActive ? 'var(--accent-bg, rgba(232,184,68,0.09))' : 'transparent',
                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
                                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                    }
                                }}
                            >
                                {/* Active indicator pill */}
                                {isActive && (
                                    <span
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                                        style={{ backgroundColor: 'var(--accent)' }}
                                    />
                                )}
                                <item.icon />
                                {!isCollapsed && (
                                    <span className="text-[0.875rem] font-medium tracking-[-0.01em]">{item.label}</span>
                                )}
                                {/* Pending badge */}
                                {!isCollapsed && (item as any).badge && (
                                    <span
                                        className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold px-1"
                                        style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                                    >
                                        {(item as any).badge > 9 ? '9+' : (item as any).badge}
                                    </span>
                                )}
                                {isCollapsed && (item as any).badge && (
                                    <span
                                        className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold px-0.5"
                                        style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                                    >
                                        {(item as any).badge > 9 ? '9+' : (item as any).badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                    {/* Admin Section */}
                    {(user?.role === 'admin' || user?.role === 'owner') && (
                        <div className="mt-8 space-y-0.5">
                            {!isCollapsed && (
                                <p className="px-4 mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Admin</p>
                            )}
                            {[
                                { path: '/admin', label: 'Admin Dashboard', icon: AnalyticsIcon },
                                { path: '/admin/users', label: 'User Management', icon: PortfolioIcon },
                                { path: '/admin/errors', label: 'Error Logs', icon: AlertIcon },
                                { path: '/interview-buddy', label: 'Interview Buddy', icon: InterviewBuddyIcon },
                            ].map((item) => {
                                const isActive = isActiveRoute(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        title={isCollapsed ? item.label : undefined}
                                        className="flex items-center rounded-lg transition-all duration-150 group relative"
                                        style={{
                                            padding: isCollapsed ? '10px' : '9px 12px',
                                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                                            gap: isCollapsed ? '0' : '10px',
                                            backgroundColor: isActive ? 'var(--accent-bg, rgba(232,184,68,0.09))' : 'transparent',
                                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
                                                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                            }
                                        }}
                                    >
                                        {isActive && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                                                style={{ backgroundColor: 'var(--accent)' }}
                                            />
                                        )}
                                        <item.icon />
                                        {!isCollapsed && (
                                            <span className="text-[0.875rem] font-medium tracking-[-0.01em]">{item.label}</span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </nav>

            {/* ── Footer ── */}
            <div
                className="border-t px-3 py-4 space-y-2"
                style={{ borderColor: 'var(--border)' }}
            >
                {/* Remaining Credits Badge */}
                {user && (
                    <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${(user.credits ?? 0) < 10 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-gold-500/10 text-gold-600 border border-gold-500/20'
                            }`}
                        title="Remaining AI Credits"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                        {!isCollapsed && <span>{user.credits ?? 0} Credits</span>}
                        {isCollapsed && <span>{user.credits ?? 0}</span>}
                    </div>
                )}

                {/* User chip */}
                <div
                    className="flex items-center rounded-lg overflow-hidden"
                    style={{
                        padding: isCollapsed ? '8px' : '8px 10px',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: isCollapsed ? '0' : '10px',
                        backgroundColor: 'var(--bg-elevated)',
                    }}
                >
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 font-mono"
                        style={{ backgroundColor: 'var(--accent-bg, rgba(232,184,68,0.15))', color: 'var(--accent)', border: '1px solid rgba(232,184,68,0.25)' }}
                    >
                        {userInitial}
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {userLabel}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions row */}
                <div className={`flex gap-1.5 ${isCollapsed ? 'flex-col items-center' : ''}`}>
                    <button
                        onClick={toggleTheme}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2.5 text-xs font-medium transition-all duration-150"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright, var(--border))';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                        }}
                        aria-label="Toggle theme"
                        title={isCollapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
                    >
                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                        {!isCollapsed && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center rounded-lg p-2 transition-all duration-150"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--rose-bg, rgba(244,100,100,0.08))';
                            (e.currentTarget as HTMLElement).style.color = 'var(--rose, #f46464)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,100,100,0.25)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                        }}
                        aria-label="Sign out"
                        title="Sign out"
                    >
                        <LogoutIcon />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
