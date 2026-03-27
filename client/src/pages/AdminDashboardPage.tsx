import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats, AdminStats } from '../services/adminApi';
import { getErrorStats, ErrorStats } from '../services/errorApi';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';
import { TableOrCards } from '../components/common/TableOrCards';

const AdminDashboardPage: React.FC = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [adminData, errorData] = await Promise.all([
                    getAdminStats(),
                    getErrorStats(),
                ]);
                setStats(adminData);
                setErrorStats(errorData);
            } catch (err: any) {
                setToast({ message: err.message || 'Failed to load admin stats', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <p className="text-zinc-500">Failed to load statistics.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 font-display">Admin Dashboard</h1>
                <p className="text-zinc-500 mt-1 text-sm md:text-base">System-wide overview and performance metrics.</p>
            </div>

            {/* Error Stats Banner */}
            {errorStats && errorStats.unresolved > 0 && (
                <Link
                    to="/admin/errors"
                    className="flex items-center justify-between p-3 md:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                            <AlertIcon />
                        </div>
                        <div>
                            <p className="font-semibold text-red-900 dark:text-red-200">
                                {errorStats.unresolved} unresolved error{errorStats.unresolved !== 1 ? 's' : ''}
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {errorStats.critical > 0 && `${errorStats.critical} critical • `}
                                Click to view details
                            </p>
                        </div>
                    </div>
                    <ChevronRightIcon />
                </Link>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatCard
                    label="Total Users"
                    value={stats.totalUsers}
                    icon={<UsersIcon />}
                    color="blue"
                />
                <StatCard
                    label="Monthly Revenue"
                    value={`$${stats.mrr.toFixed(2)}`}
                    icon={<DollarIcon />}
                    color="emerald"
                />
                <StatCard
                    label="Active Users (30d)"
                    value={stats.activeUsers}
                    icon={<ActivityIcon />}
                    color="gold"
                />
                <StatCard
                    label="Total Revenue"
                    value={`$${stats.totalRevenue.toFixed(2)}`}
                    icon={<TrendingUpIcon />}
                    color="purple"
                />
            </div>

            {stats.externalCalls && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                        <StatCard
                            label="AI Calls (Total)"
                            value={stats.externalCalls.totals.ai}
                            icon={<SparkIcon />}
                            color="blue"
                        />
                        <StatCard
                            label="Apify Calls (Total)"
                            value={stats.externalCalls.totals.apify}
                            icon={<DatabaseIcon />}
                            color="gold"
                        />
                        <StatCard
                            label="Calls (Last 24h)"
                            value={stats.externalCalls.last24h.all}
                            icon={<ClockIcon />}
                            color="emerald"
                        />
                        <StatCard
                            label="Failed Calls"
                            value={stats.externalCalls.failed}
                            icon={<AlertIcon />}
                            color="purple"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm">
                            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-6 flex items-center gap-2">
                                <ActivityIcon /> Calls by Provider
                            </h3>
                            <div className="space-y-3">
                                {stats.externalCalls.byProvider.length === 0 && (
                                    <p className="text-sm text-zinc-500 italic">No provider calls recorded yet.</p>
                                )}
                                {stats.externalCalls.byProvider.map((item) => (
                                    <div key={item.provider} className="flex items-center justify-between text-sm">
                                        <span className="font-medium capitalize">{item.provider}</span>
                                        <span className="text-zinc-500">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm">
                            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-6 flex items-center gap-2">
                                <PieChartIcon /> Top AI Models
                            </h3>
                            <div className="space-y-3">
                                {stats.externalCalls.topModels.length === 0 && (
                                    <p className="text-sm text-zinc-500 italic">No model data recorded yet.</p>
                                )}
                                {stats.externalCalls.topModels.map((item) => (
                                    <div key={item.modelName} className="flex items-center justify-between text-sm">
                                        <span className="font-medium truncate">{item.modelName}</span>
                                        <span className="text-zinc-500">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm">
                            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-6 flex items-center gap-2">
                                <TrendingUpIcon /> Call Health
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Successful</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">{stats.externalCalls.successful}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Failed</span>
                                    <span className="text-rose-600 dark:text-rose-400">{stats.externalCalls.failed}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Success Rate</span>
                                    <span className="text-zinc-500">
                                        {stats.externalCalls.totals.all > 0
                                            ? `${((stats.externalCalls.successful / stats.externalCalls.totals.all) * 100).toFixed(1)}%`
                                            : '0%'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm">
                        <h3 className="text-base md:text-lg font-bold mb-3 md:mb-6 flex items-center gap-2">
                            <ClockIcon /> Recent AI & Apify Calls
                        </h3>
                        <TableOrCards
                            data={stats.externalCalls.recentCalls}
                            columns={[
                                { key: 'provider', label: 'Provider', className: 'capitalize' },
                                {
                                    key: 'service',
                                    label: 'Service',
                                    render: (c: any) => {
                                        // Generate friendly service names from provider and request path
                                        if (!c.requestPath) return '-';

                                        const path = c.requestPath.toLowerCase();
                                        const provider = (c.provider || '').toLowerCase();

                                        // Gemini services
                                        if (provider === 'gemini' || path.includes('gemini')) {
                                            if (path.includes('generatecontent')) return 'Gemini Generate Content';
                                            if (path.includes('streamgeneratecontent')) return 'Gemini Stream Generate';
                                            if (path.includes('embedcontent')) return 'Gemini Embed Content';
                                            if (path.includes('counttokens')) return 'Gemini Count Tokens';
                                            return 'Gemini API';
                                        }

                                        // Apify services
                                        if (provider === 'apify' || path.includes('apify')) {
                                            return 'Apify Service';
                                        }

                                        // Fallback: extract action from path
                                        const parts = path.split('/').filter(Boolean);
                                        if (parts.length > 1) {
                                            const action = parts[parts.length - 1];
                                            // Convert camelCase to Title Case
                                            return action.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                        }

                                        return provider.charAt(0).toUpperCase() + provider.slice(1) + ' Service';
                                    }
                                },
                                { key: 'modelName', label: 'Model', render: (c: any) => c.modelName || '-', mobileHidden: true },
                                { key: 'userEmail', label: 'User', render: (c: any) => c.userEmail || '-', mobileHidden: true },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (c: any) => (
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${c.success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'}`}>
                                            {c.statusCode || (c.success ? 'OK' : 'ERR')}
                                        </span>
                                    )
                                },
                                { key: 'durationMs', label: 'Latency', render: (c: any) => `${c.durationMs} ms` },
                                { key: 'createdAt', label: 'Time', render: (c: any) => new Date(c.createdAt).toLocaleString(), mobileHidden: true },
                            ]}
                            cardConfig={{
                                title: (c: any) => c.provider,
                                subtitle: (c: any) => {
                                    if (!c.requestPath) return c.modelName || 'No model';
                                    const parts = c.requestPath.split('/').filter(Boolean);
                                    return parts.length > 1 ? parts.slice(1).join(' ') : c.requestPath;
                                },
                                badge: (c: any) => ({
                                    text: c.statusCode || (c.success ? 'OK' : 'ERR'),
                                    className: c.success
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'
                                }),
                                fields: [
                                    { label: 'Model', value: (c: any) => c.modelName || '-' },
                                    { label: 'User', value: (c: any) => c.userEmail || '-' },
                                    { label: 'Latency', value: (c: any) => `${c.durationMs} ms` },
                                    { label: 'Time', value: (c: any) => new Date(c.createdAt).toLocaleString() },
                                ],
                            }}
                            emptyMessage="No AI or Apify calls recorded yet."
                        />
                    </div>
                </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                {/* Tier Distribution */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm">
                    <h3 className="text-base md:text-lg font-bold mb-3 md:mb-6 flex items-center gap-2">
                        <PieChartIcon /> User Tiers
                    </h3>
                    <div className="space-y-4">
                        {Object.entries(stats.tierDistribution).map(([tier, count]) => (
                            <div key={tier} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="capitalize font-medium">{tier}</span>
                                    <span className="text-zinc-500">{count} users ({((count / stats.totalUsers) * 100).toFixed(1)}%)</span>
                                </div>
                                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${tier === 'free' ? 'bg-zinc-400' :
                                                tier === 'starter' ? 'bg-blue-500' :
                                                    tier === 'pro' ? 'bg-gold-500' : 'bg-emerald-500'
                                            }`}
                                        style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Payments */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 shadow-sm">
                    <h3 className="text-base md:text-lg font-bold mb-3 md:mb-6 flex items-center gap-2">
                        <ClockIcon /> Recent Payments
                    </h3>
                    <TableOrCards
                        data={stats.recentPayments}
                        columns={[
                            { key: 'customerEmail', label: 'User' },
                            {
                                key: 'amount',
                                label: 'Amount',
                                render: (p: any) => `${p.currency.toUpperCase()} ${(p.amount / 100).toFixed(2)}`
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (p: any) => (
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${p.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-zinc-100 text-zinc-600'}`}>
                                        {p.status}
                                    </span>
                                )
                            },
                            { key: 'createdAt', label: 'Date', render: (p: any) => new Date(p.createdAt).toLocaleDateString() },
                        ]}
                        cardConfig={{
                            title: (p: any) => p.customerEmail,
                            badge: (p: any) => ({
                                text: p.status,
                                className: p.status === 'succeeded'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                    : 'bg-zinc-100 text-zinc-600'
                            }),
                            fields: [
                                { label: 'Amount', value: (p: any) => `${p.currency.toUpperCase()} ${(p.amount / 100).toFixed(2)}` },
                                { label: 'Date', value: (p: any) => new Date(p.createdAt).toLocaleDateString() },
                            ],
                        }}
                        emptyMessage="No recent payments recorded."
                    />
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => {
    const colors: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        gold: 'bg-gold-100 text-gold-600 dark:bg-gold-900/10 dark:text-gold-500',
        purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 md:gap-4">
                <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${colors[color]}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-zinc-500 text-xs md:text-sm font-medium truncate">{label}</p>
                    <p className="text-lg md:text-2xl font-bold text-zinc-900 dark:text-zinc-100 leading-none mt-0.5 md:mt-1">{value}</p>
                </div>
            </div>
        </div>
    );
};

// --- Icons ---
const UsersIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const DollarIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
);
const ActivityIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);
const TrendingUpIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
);
const PieChartIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
);
const ClockIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);
const SparkIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 3.9L18 9l-4.1 2.1L12 15l-1.9-3.9L6 9l4.1-2.1z" />
    </svg>
);
const DatabaseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
);
const AlertIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);
const ChevronRightIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
    </svg>
);

export default AdminDashboardPage;
