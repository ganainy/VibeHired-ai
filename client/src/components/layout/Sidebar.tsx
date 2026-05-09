import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── Material Symbols icon wrapper ─────────────────────────────────────────────
const Icon = ({ name, className = '' }: { name: string; className?: string }) => (
    <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

// ── Component ─────────────────────────────────────────────────────────────────

interface SidebarProps {
    pendingEmailCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ pendingEmailCount = 0 }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActiveRoute = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard';
        if (path === '/admin') return location.pathname === '/admin' || location.pathname.startsWith('/admin/users');
        return location.pathname.startsWith(path);
    };

    const navSections = [
        {
            label: 'Start Here',
            items: [
                { path: '/manage-cv', label: 'CV Library', icon: 'work' },
                { path: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
                { path: '/email-suggestions', label: 'Inbox', icon: 'mail', badge: pendingEmailCount > 0 ? pendingEmailCount : undefined },
            ],
        },
        {
            label: 'Interview',
            items: [
                { path: '/interview-materials', label: 'Prep Library', icon: 'description' },
                { path: '/interview-buddy', label: 'Interview Buddy', icon: 'mic' },
            ],
        },
        {
            label: 'Productivity',
            items: [
                { path: '/auto-jobs', label: 'Auto Jobs', icon: 'bolt', disabled: true },
                { path: '/work-tracker', label: 'Time Tracker', icon: 'schedule' },
                { path: '/calendar', label: 'Calendar', icon: 'calendar_today' },
                { path: '/analytics', label: 'Analytics', icon: 'bar_chart' },
            ],
        },
        {
            label: 'Account',
            items: [
                { path: '/portfolio-setup', label: 'Portfolio', icon: 'person' },
                { path: '/settings', label: 'Settings', icon: 'settings' },
                { path: '/subscriptions', label: 'Subscription', icon: 'credit_card' },
            ],
        },
    ];

    const adminItems = [
        { path: '/admin', label: 'Admin Dashboard', icon: 'dashboard_customize' },
        { path: '/admin/errors', label: 'Error Logs', icon: 'report_problem' },
    ];

    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
    const userLabel = user?.email?.split('@')[0] || 'User';

    return (
        <aside
            className={`flex flex-col h-screen flex-shrink-0 transition-all duration-300 relative border-r border-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${
                isCollapsed ? 'w-[72px]' : 'w-72'
            }`}
            style={{ backgroundColor: '#ffffff' }}
        >
            {/* Collapse toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-4 top-10 w-8 h-8 bg-white border border-[var(--border)] rounded-full flex items-center justify-center z-50 transition-all hover:border-[var(--accent)] group shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <Icon
                    name={isCollapsed ? 'chevron_right' : 'chevron_left'}
                    className="text-sm text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors"
                />
            </button>

            {/* ── Brand ── */}
            <div
                className={`flex items-center h-[64px] ${isCollapsed ? 'justify-center px-2' : 'px-8'}`}
            >
                {!isCollapsed ? (
                    <Link to="/dashboard" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                        <span
                            className="text-2xl font-extrabold tracking-tight"
                            style={{ color: 'var(--accent)' }}
                        >
                            VibeHired
                        </span>
                        <Icon
                            name="auto_awesome"
                            className="text-lg text-amber-400 translate-y-[-8px]"
                        />
                    </Link>
                ) : (
                    <Link to="/dashboard" className="hover:opacity-80 transition-opacity">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            V
                        </div>
                    </Link>
                )}
            </div>

            {/* ── Navigation ── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4">
                {navSections.map((section, sectionIndex) => (
                    <div key={section.label} className={sectionIndex === 0 ? 'mb-6' : 'mb-6'}>
                        {!isCollapsed && (
                            <h3
                                className="px-4 text-[11px] font-bold uppercase tracking-widest mb-2"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {section.label}
                            </h3>
                        )}
                        <ul className="space-y-1">
                            {section.items.map((item) => {
                                const isActive = isActiveRoute(item.path);
                                const isDisabled = !!(item as any).disabled;

                                if (isDisabled) {
                                    return (
                                        <li key={item.path}>
                                            <div
                                                title={isCollapsed ? `${item.label} (coming soon)` : undefined}
                                                className={`flex items-center rounded-lg cursor-not-allowed select-none ${
                                                    isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-4 py-2.5'
                                                }`}
                                                style={{ color: 'var(--text-muted)', opacity: 0.45 }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Icon name={item.icon} className="text-[20px]" />
                                                    {!isCollapsed && (
                                                        <span className="text-sm font-semibold">{item.label}</span>
                                                    )}
                                                </div>
                                                {!isCollapsed && (
                                                    <span
                                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: 'var(--bg-raised)',
                                                            color: 'var(--text-muted)',
                                                        }}
                                                    >
                                                        SOON
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                }

                                return (
                                    <li key={item.path} className="relative">
                                        {isActive && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full z-10"
                                                style={{ backgroundColor: 'var(--accent)' }}
                                            />
                                        )}
                                        <Link
                                            to={item.path}
                                            title={isCollapsed ? item.label : undefined}
                                            className={`flex items-center rounded-lg transition-colors group ${
                                                isCollapsed
                                                    ? 'justify-center px-2 py-2.5'
                                                    : 'gap-3 px-4 py-2.5'
                                            } ${
                                                isActive
                                                    ? 'ml-1'
                                                    : 'hover:bg-black/5'
                                            }`}
                                            style={{
                                                backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                                                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <Icon
                                                name={item.icon}
                                                className={`text-[20px] ${isActive ? 'text-white' : ''}`}
                                            />
                                            {!isCollapsed && (
                                                <span className="text-sm font-semibold">{item.label}</span>
                                            )}
                                            {!isCollapsed && (item as any).badge && (
                                                <span
                                                    className="ml-auto min-w-[20px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                                    style={{ backgroundColor: 'var(--accent)' }}
                                                >
                                                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                                                </span>
                                            )}
                                            {isCollapsed && (item as any).badge && (
                                                <span
                                                    className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold px-0.5 text-white"
                                                    style={{ backgroundColor: 'var(--accent)' }}
                                                >
                                                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}

                {/* Admin Section */}
                {(user?.role === 'admin' || user?.role === 'owner') && (
                    <div className="mb-6">
                        {!isCollapsed && (
                            <h3
                                className="px-4 text-[11px] font-bold uppercase tracking-widest mb-2"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                Admin
                            </h3>
                        )}
                        <ul className="space-y-1">
                            {adminItems.map((item) => {
                                const isActive = isActiveRoute(item.path);
                                return (
                                    <li key={item.path} className="relative">
                                        {isActive && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full z-10"
                                                style={{ backgroundColor: 'var(--accent)' }}
                                            />
                                        )}
                                        <Link
                                            to={item.path}
                                            title={isCollapsed ? item.label : undefined}
                                            className={`flex items-center rounded-lg transition-colors group ${
                                                isCollapsed
                                                    ? 'justify-center px-2 py-2.5'
                                                    : 'gap-3 px-4 py-2.5'
                                            } ${isActive ? 'ml-1' : 'hover:bg-black/5'}`}
                                            style={{
                                                backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                                                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <Icon
                                                name={item.icon}
                                                className={`text-[20px] ${isActive ? 'text-white' : ''}`}
                                            />
                                            {!isCollapsed && (
                                                <span className="text-sm font-semibold">{item.label}</span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </nav>

            {/* ── Footer ── */}
            <div
                className="p-4 space-y-3 border-t border-[var(--border)]"
            >
                {/* Remaining Credits Pill */}
                {user && (
                    <div
                        className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4 py-2 border-2 rounded-full`}
                        style={{
                            borderColor: 'var(--accent-hover)',
                            backgroundColor: 'rgba(255,255,255,0.5)',
                        }}
                    >
                        <div className={`flex items-center gap-2 ${isCollapsed ? '' : 'text-[var(--accent)]'}`}>
                            <Icon
                                name="layers"
                                className={`text-[18px] ${isCollapsed ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}`}
                            />
                            {!isCollapsed && (
                                <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--accent)]">
                                    {user.credits ?? 0} Credits
                                </span>
                            )}
                        </div>

                    </div>
                )}

                {/* User row + logout */}
                <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                    <div
                        className={`flex items-center rounded-xl flex-1 min-w-0 ${
                            isCollapsed ? 'justify-center p-2' : 'gap-3 p-2'
                        }`}
                        style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
                    >
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            {userInitial}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p
                                    className="text-xs font-bold truncate"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {userLabel}
                                </p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:bg-red-50 hover:text-red-600"
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.04)',
                            color: 'var(--text-muted)',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(200,32,20,0.08)';
                            (e.currentTarget as HTMLElement).style.color = '#c82014';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                        aria-label="Sign out"
                        title="Sign out"
                    >
                        <Icon name="logout" className="text-[20px]" />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
