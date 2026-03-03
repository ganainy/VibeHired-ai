import React, { useState, useEffect, useCallback } from 'react';
import { getAllUsers, AdminUser } from '../services/adminApi';
import Spinner from '../components/common/Spinner';
import UserUsageModal from '../components/usage/UserUsageModal';

const PAGE_SIZE = 20;

const AdminUsersPage: React.FC = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const fetchUsers = useCallback(async (currentPage: number, search: string) => {
        setIsLoading(true);
        try {
            const data = await getAllUsers(search, currentPage, PAGE_SIZE);
            setUsers(data.users);
            setTotal(data.total);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Reset to page 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchUsers(page, searchTerm);
    }, [page, searchTerm, fetchUsers]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const startItem = (page - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(page * PAGE_SIZE, total);

    return (
        <div className="space-y-8">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 font-display">User Management</h1>
                    <p className="text-zinc-500 mt-1">View and manage all registered users.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Search email or username..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm focus:ring-2 focus:ring-gold-500/50 outline-none transition-all"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                        <SearchIcon />
                    </span>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full py-20"><Spinner size="lg" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-[10px] uppercase tracking-[0.1em] font-black border-b border-zinc-100 dark:border-zinc-800">
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Plan & Role</th>
                                    <th className="px-6 py-4">Credits</th>
                                    <th className="px-6 py-4">Verified</th>
                                    <th className="px-6 py-4">Last Active</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {user.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{user.username}</p>
                                                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${user.plan === 'pro' || user.plan === 'premium' ? 'bg-gold-500 text-gold-950' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                                    }`}>
                                                    {user.plan}
                                                </span>
                                                {user.role && user.role !== 'user' && (
                                                    <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${user.role === 'owner' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'}`}>
                                                        {user.role}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-bold">{user.credits}</span>
                                                <span className="text-[10px] text-zinc-400">/ {user.totalConsumed} used</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.emailVerified ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                    Unverified
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-zinc-500">
                                            {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedUserId(user.id)}
                                                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length === 0 && !isLoading && (
                            <div className="py-20 text-center text-zinc-500">No users found.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm">
                    <p className="text-zinc-500">
                        Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{startItem}–{endItem}</span> of <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total}</span> users
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-2 text-zinc-500 font-mono text-xs">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
                    onUpdate={() => fetchUsers(page, searchTerm)}
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
