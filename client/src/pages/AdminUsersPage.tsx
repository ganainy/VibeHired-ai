import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAllUsers, AdminUser } from '../services/adminApi';
import Spinner from '../components/common/Spinner';
import UserUsageModal from '../components/usage/UserUsageModal';
import { TableOrCards } from '../components/common/TableOrCards';

const PAGE_SIZE = 20;

const AdminUsersPage: React.FC = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchUsers = useCallback(async (currentPage: number, search: string) => {
        setIsLoading(true);
        try {
            const data = await getAllUsers(search, currentPage, PAGE_SIZE);
            setUsers(data.users);
            setTotal(data.total);
            setError(null);
        } catch (err) {
            setError('Failed to load users. Please try again.');
        } finally {
            setIsLoading(false);
            setIsInitialLoad(false);
        }
    }, []);

    // Debounce search with useRef + useEffect
    useEffect(() => {
        searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [searchTerm]);

    // Reset to page 1 when debounced search changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        fetchUsers(page, debouncedSearch);
    }, [page, debouncedSearch, fetchUsers]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const startItem = (page - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(page * PAGE_SIZE, total);

    return (
        <div className="space-y-8">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-primary-color font-display">User Management</h1>
                    <p className="text-zinc-500 mt-1">View and manage all registered users.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Search email or username..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Search users by email or username"
                        className="w-full pl-10 pr-4 py-3 bg-surface rounded-2xl border border-theme text-sm focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                        <SearchIcon />
                    </span>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => { setError(null); fetchUsers(page, debouncedSearch); }} className="ml-3 text-xs font-bold underline hover:no-underline">Retry</button>
                </div>
            )}

            {/* Users Table/Cards */}
            {isInitialLoad && isLoading ? (
                <div className="bg-surface rounded-3xl border border-theme shadow-sm min-h-[400px] flex items-center justify-center">
                    <Spinner size="lg" />
                </div>
            ) : (
                <div className={isLoading ? 'opacity-50 pointer-events-none transition-opacity duration-200' : ''}>
                    <TableOrCards
                    data={users}
                    columns={[
                        {
                            key: 'user',
                            label: 'User',
                            render: (u: AdminUser) => (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-secondary-color border border-zinc-200 dark:border-zinc-700">
                                        {u.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-primary-color truncate">{u.username}</p>
                                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'planRole',
                            label: 'Plan & Role',
                            render: (u: AdminUser) => (
                                <div className="flex flex-col gap-1">
                                    <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${u.plan === 'pro' || u.plan === 'premium' ? 'bg-gold-500 text-gold-950' : 'bg-zinc-200 dark:bg-zinc-800 text-secondary-color'}`}>
                                        {u.plan}
                                    </span>
                                    {u.role && u.role !== 'user' && (
                                        <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${u.role === 'owner' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'}`}>
                                            {u.role}
                                        </span>
                                    )}
                                </div>
                            )
                        },
                        {
                            key: 'credits',
                            label: 'Credits',
                            render: (u: AdminUser) => (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold">{u.credits}</span>
                                    <span className="text-[10px] text-zinc-400">/ {u.totalConsumed} used</span>
                                </div>
                            )
                        },
                        {
                            key: 'verified',
                            label: 'Verified',
                            render: (u: AdminUser) =>
                                u.emailVerified ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        Verified
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        Unverified
                                    </span>
                                ),
                            mobileHidden: true
                        },
                        {
                            key: 'lastActive',
                            label: 'Last Active',
                            render: (u: AdminUser) => u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never',
                            mobileHidden: true
                        },
                        {
                            key: 'actions',
                            label: '',
                            align: 'right',
                            render: (u: AdminUser) => (
                                <button
                                    onClick={() => setSelectedUserId(u.id)}
                                    aria-label={"Manage user " + u.username}
                                    className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                                >
                                    Manage
                                </button>
                            )
                        },
                    ]}
                    cardConfig={{
                        title: (u: AdminUser) => u.username,
                        subtitle: (u: AdminUser) => u.email,
                        avatar: (u: AdminUser) => ({ letter: u.email.charAt(0).toUpperCase() }),
                        badge: (u: AdminUser) => ({
                            text: u.plan,
                            className: u.plan === 'pro' || u.plan === 'premium'
                                ? 'bg-gold-500 text-gold-950'
                                : 'bg-zinc-200 dark:bg-zinc-800 text-secondary-color'
                        }),
                        fields: [
                            {
                                label: 'Credits',
                                value: (u: AdminUser) => `${u.credits} / ${u.totalConsumed} used`
                            },
                            {
                                label: 'Verified',
                                value: (u: AdminUser) =>
                                    u.emailVerified ? 'Verified' : 'Unverified'
                            },
                            {
                                label: 'Last Active',
                                value: (u: AdminUser) => u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never'
                            },
                        ],
                        actions: (u: AdminUser) => (
                            <button
                                onClick={() => setSelectedUserId(u.id)}
                                aria-label={"Manage user " + u.username}
                                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                            >
                                Manage
                            </button>
                        ),
                    }}
                    emptyMessage="No users found."
                />
                </div>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm">
                    <p className="text-zinc-500">
                        Showing <span className="font-semibold text-primary-color">{startItem}{endItem}</span> of <span className="font-semibold text-primary-color">{total}</span> users
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            aria-label="Previous page"
                            className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-2 text-zinc-500 font-mono text-xs">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            aria-label="Next page"
                            className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Management Modal */}
            {selectedUserId && (
                <UserUsageModal
                    userId={selectedUserId}
                    onClose={() => setSelectedUserId(null)}
                    onUpdate={() => fetchUsers(page, debouncedSearch)}
                />
            )}
        </div>
    );
};

// --- Icons ---
const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

export default AdminUsersPage;

