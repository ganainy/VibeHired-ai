import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats, getAllUsers, AdminStats, AdminUser } from '../services/adminApi';
import { getErrorStats, ErrorStats } from '../services/errorApi';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';

const EXTERNAL_CALLS_PAGE_SIZE = 20;
const USERS_PAGE_SIZE = 20;

const getCreditUsedFromCall = (call: any): number | null => {
  const direct = Number(call?.creditUsed);
  if (Number.isFinite(direct) && direct >= 0) return direct;

  const metadata = call?.metadata;
  const fallback = Number(metadata?.creditUsed ?? metadata?.creditsUsed ?? metadata?.credits);
  if (Number.isFinite(fallback) && fallback >= 0) return fallback;

  return null;
};

const formatCreditUsed = (call: any): string => {
  const value = getCreditUsedFromCall(call);
  if (value === null) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const toTitleCase = (value: string): string =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeCallPath = (rawPath: string): string => {
  if (!rawPath) return '';

  try {
    if (/^https?:\/\//i.test(rawPath)) {
      return new URL(rawPath).pathname.toLowerCase();
    }
  } catch {
    // Ignore URL parsing errors and fallback to string normalization.
  }

  const cleaned = rawPath.split('?')[0].split('#')[0].trim().toLowerCase();
  if (!cleaned) return '';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
};

const getCallRequestPath = (call: any): string =>
  call?.requestPath || call?.path || call?.metadata?.requestPath || call?.metadata?.path || '';

const getServiceLabelFromPath = (rawPath: string): string => {
  const normalized = normalizeCallPath(rawPath);
  if (!normalized) return '-';

  const path = normalized.replace(/^\/api(?=\/)/, '');

  const exactMap: Record<string, string> = {
    '/generate-cv': 'Generate CV',
    '/create-from-text': 'Create From Text',
    '/create-from-url': 'Create From URL',
    '/recommendations/regenerate': 'Recommendation',
    '/upload': 'Upload',
    '/upload-branch': 'Upload Branch',
    '/stream-interview-buddy-answer': 'Interview Buddy',
    '/stream-answer': 'Interview Buddy',
    '/questions': 'Questions',
    '/evaluate': 'Evaluate',
    '/ai/generate': 'AI Generate',
    '/ai/chat': 'AI Chat',
    '/ai/embed': 'AI Embed',
    '/apify/fetch': 'Apify Fetch',
    '/apify/actors': 'Apify Actors',
    '/cvs/upload': 'CV Upload',
    '/cvs/parse': 'CV Parse',
    '/jobs': 'Jobs List',
  };

  if (exactMap[path]) return exactMap[path];

  if (path.startsWith('/job-applications/recommendations')) return 'Recommendation';
  if (/^\/job-applications\/[^/]+\/generate-cv$/.test(path)) return 'Generate CV';
  if (/^\/generator\/[^/]+\/generate-cv$/.test(path)) return 'Generate CV';
  if (/^\/cover-letter\/[^/]+$/.test(path)) return 'Generate Cover Letter';
  if (/^\/generator\/[^/]+\/render-cover-letter-pdf$/.test(path)) return 'Cover Letter PDF';
  if (/^\/generator\/[^/]+\/render-cv-pdf$/.test(path)) return 'CV PDF';
  if (/^\/generator\/[^/]+\/render-pdf$/.test(path)) return 'Final PDFs';
  if (/^\/interview\/[^/]+\/(questions|evaluate)$/.test(path)) return 'Questions';
  if (/^\/chat\/[^/]+$/.test(path)) return 'AI Chat';
  if (path.startsWith('/chat/')) return 'Questions';
  if (path.startsWith('/ai/')) return 'AI Service';
  if (path.startsWith('/apify/')) return 'Apify Service';
  if (path.startsWith('/cvs/')) return 'CV Service';
  if (path.startsWith('/jobs/')) return 'Jobs Service';

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return normalized;
  return toTitleCase(parts[parts.length - 1]);
};

const getServiceLabelForCall = (call: any): string => getServiceLabelFromPath(getCallRequestPath(call));

const Icon = ({ name, className = '' }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const AdminDashboardPage: React.FC = () => {
  // --- Stats state ---
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- External calls pagination ---
  const [externalCallsPage, setExternalCallsPage] = useState(1);
  const [externalCallsUserSearch, setExternalCallsUserSearch] = useState('');

  // --- Users state ---
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersSearchTerm, setUsersSearchTerm] = useState('');
  const [usersDebouncedSearch, setUsersDebouncedSearch] = useState('');
  const [usersError, setUsersError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch stats ---
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
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // --- Fetch users ---
  const fetchUsers = useCallback(async (currentPage: number, search: string) => {
    setIsLoadingUsers(true);
    try {
      const data = await getAllUsers(search, currentPage, USERS_PAGE_SIZE);
      setUsers(data.users);
      setUsersTotal(data.total);
      setUsersError(null);
    } catch (err) {
      setUsersError('Failed to load users. Please try again.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    searchTimeoutRef.current = setTimeout(() => setUsersDebouncedSearch(usersSearchTerm), 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [usersSearchTerm]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersDebouncedSearch]);

  useEffect(() => {
    fetchUsers(usersPage, usersDebouncedSearch);
  }, [usersPage, usersDebouncedSearch, fetchUsers]);

  // --- External calls pagination effects ---
  useEffect(() => {
    if (!stats?.externalCalls?.recentCalls?.length) {
      setExternalCallsPage(1);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(stats.externalCalls.recentCalls.length / EXTERNAL_CALLS_PAGE_SIZE));
    setExternalCallsPage((prev) => Math.min(prev, totalPages));
  }, [stats?.externalCalls?.recentCalls?.length]);

  useEffect(() => {
    setExternalCallsPage(1);
  }, [externalCallsUserSearch]);

  // --- Pagination calculations ---
  const externalCalls = stats?.externalCalls?.recentCalls || [];
  const externalCallsSearchTerm = externalCallsUserSearch.trim().toLowerCase();
  const filteredExternalCalls = externalCalls.filter((call: any) => {
    if (!externalCallsSearchTerm) return true;
    const userEmail = (call.userEmail || '').toString().toLowerCase();
    const userId = (call.userId || '').toString().toLowerCase();
    return userEmail.includes(externalCallsSearchTerm) || userId.includes(externalCallsSearchTerm);
  });
  const externalCallsTotalPages = Math.max(1, Math.ceil(filteredExternalCalls.length / EXTERNAL_CALLS_PAGE_SIZE));
  const safeExternalCallsPage = Math.min(externalCallsPage, externalCallsTotalPages);
  const externalCallsStartIndex = (safeExternalCallsPage - 1) * EXTERNAL_CALLS_PAGE_SIZE;
  const externalCallsEndIndex = Math.min(externalCallsStartIndex + EXTERNAL_CALLS_PAGE_SIZE, filteredExternalCalls.length);
  const paginatedExternalCalls = filteredExternalCalls.slice(externalCallsStartIndex, externalCallsEndIndex);

  const usersTotalPages = Math.ceil(usersTotal / USERS_PAGE_SIZE);
  const usersStartItem = (usersPage - 1) * USERS_PAGE_SIZE + 1;
  const usersEndItem = Math.min(usersPage * USERS_PAGE_SIZE, usersTotal);

  const isLoading = isLoadingStats || (isLoadingUsers && users.length === 0);

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
        <p className="text-secondary-color">Failed to load statistics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-primary font-display">Admin Dashboard</h1>
        <p className="text-secondary-color mt-1 text-sm md:text-base">System-wide overview and performance metrics.</p>
      </div>

      {/* Error Stats Banner */}
      {errorStats && errorStats.unresolved > 0 && (
        <Link
          to="/admin/errors"
          className="flex items-center justify-between p-3 md:p-4 bg-[var(--rose-bg)] border border-red-200 rounded-xl hover:bg-[var(--rose-bg)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--rose-bg)] rounded-lg">
              <Icon name="error" className="text-red-600 text-xl" />
            </div>
            <div>
              <p className="font-semibold text-error">
                {errorStats.unresolved} unresolved error{errorStats.unresolved !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-error">
                {errorStats.critical > 0 && `${errorStats.critical} critical `}
                Click to view details
              </p>
            </div>
          </div>
          <Icon name="chevron_right" className="text-red-400" />
        </Link>
      )}

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Users" value={stats.totalUsers} icon="group" color="blue" />
        <StatCard label="Monthly Revenue" value={`$${stats.mrr.toFixed(2)}`} icon="attach_money" color="green" />
        <StatCard label="AI Calls (Total)" value={stats.externalCalls?.totals.ai ?? 0} icon="bolt" color="amber" />
        <StatCard label="Failed Calls" value={stats.externalCalls?.failed ?? 0} icon="error_outline" color="red" />
      </section>

      {/* Call Health + Top Models */}
      {stats.externalCalls && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface rounded-[12px] shadow-sm border border-theme p-6">
            <h3 className="font-bold text-primary flex items-center gap-2 mb-6 uppercase text-sm tracking-widest">
              <Icon name="monitor_heart" className="text-lg" /> Call Health
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-theme">
                <span className="text-sm font-medium">Successful</span>
                <span className="text-sm font-bold text-green">{stats.externalCalls.successful}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-theme">
                <span className="text-sm font-medium">Failed</span>
                <span className="text-sm font-bold text-error">{stats.externalCalls.failed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Success Rate</span>
                <span className="text-sm font-bold text-primary-color">
                  {stats.externalCalls.totals.all > 0
                    ? `${((stats.externalCalls.successful / stats.externalCalls.totals.all) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-[12px] shadow-sm border border-theme p-6">
            <h3 className="font-bold text-primary flex items-center gap-2 mb-6 uppercase text-sm tracking-widest">
              <Icon name="psychology" className="text-lg" /> Top AI Models
            </h3>
            <div className="space-y-4">
              {stats.externalCalls.topModels.length === 0 && (
                <p className="text-sm text-secondary-color italic">No model data recorded yet.</p>
              )}
              {stats.externalCalls.topModels.map((item) => (
                <div key={item.modelName} className="flex justify-between items-center pb-2 border-b border-theme last:border-0 last:pb-0">
                  <span className="text-sm font-medium truncate">{item.modelName}</span>
                  <span className="text-sm font-bold text-primary-color">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI & Apify Calls */}
      {stats.externalCalls && (
        <section className="bg-surface rounded-2xl shadow-sm border border-theme overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-lg text-primary flex items-center gap-2">
                <Icon name="analytics" /> AI & Apify Calls
              </h2>
            </div>
            <div className="mb-4">
              <label htmlFor="external-calls-user-search" className="sr-only">Search by user email or ID</label>
              <div className="relative w-full sm:max-w-sm">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-color text-lg" />
                <input
                  id="external-calls-user-search"
                  type="text"
                  value={externalCallsUserSearch}
                  onChange={(e) => setExternalCallsUserSearch(e.target.value)}
                  placeholder="Search by user email or ID"
                  className="w-full pl-10 pr-4 py-2 bg-[var(--bg-elevated)] border border-theme rounded-full text-sm focus:ring-2 focus:ring-gold/50 outline-none text-primary-color placeholder:text-muted-color"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[var(--bg-elevated)]">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-muted-color tracking-widest">Provider</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-muted-color tracking-widest">Service</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-muted-color tracking-widest">Model</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-muted-color tracking-widest text-center">Status</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-muted-color tracking-widest text-right">Latency</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-muted-color tracking-widest text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {paginatedExternalCalls.map((call: any) => (
                    <tr key={call._id} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium capitalize">{call.provider}</td>
                      <td className="px-4 py-4 text-sm text-secondary-color">{getServiceLabelForCall(call)}</td>
                      <td className="px-4 py-4 text-xs font-mono text-muted-color">{call.modelName || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${call.success ? 'bg-[var(--jade-bg)] text-[var(--jade)]' : 'bg-[var(--rose-bg)] text-[var(--rose)]'}`}>
                          {call.statusCode || (call.success ? 'OK' : 'ERR')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-right text-secondary-color">{call.durationMs} ms</td>
                      <td className="px-4 py-4 text-xs text-right text-muted-color">{new Date(call.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredExternalCalls.length > 0 && (
              <div className="mt-6 flex justify-between items-center text-xs text-muted-color">
                <span>Showing {externalCallsStartIndex + 1}-{externalCallsEndIndex} of {filteredExternalCalls.length} calls</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExternalCallsPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeExternalCallsPage <= 1}
                    className="px-4 py-2 border border-theme rounded-full hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setExternalCallsPage((prev) => Math.min(externalCallsTotalPages, prev + 1))}
                    disabled={safeExternalCallsPage >= externalCallsTotalPages}
                    className="px-4 py-2 border border-theme rounded-full hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            {externalCalls.length > 0 && filteredExternalCalls.length === 0 && (
              <p className="mt-4 text-xs md:text-sm text-secondary-color">No calls match that user search.</p>
            )}
          </div>
        </section>
      )}

      {/* Registered Users */}
      <section className="bg-surface rounded-2xl shadow-sm border border-theme overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="font-bold text-lg text-primary flex items-center gap-2">
              <Icon name="group" /> Registered Users
            </h2>
            <div className="relative w-full md:w-80">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-color text-lg" />
              <input
                type="text"
                placeholder="Search email or username..."
                value={usersSearchTerm}
                onChange={(e) => setUsersSearchTerm(e.target.value)}
                aria-label="Search users by email or username"
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-elevated)] border border-theme rounded-full text-sm focus:ring-2 focus:ring-gold/50 outline-none text-primary-color placeholder:text-muted-color"
              />
            </div>
          </div>

          {usersError && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-error bg-[var(--rose-bg)] border border-red-200 flex items-center justify-between mb-4">
              <span>{usersError}</span>
              <button onClick={() => { setUsersError(null); fetchUsers(usersPage, usersDebouncedSearch); }} className="ml-3 text-xs font-bold underline hover:no-underline">Retry</button>
            </div>
          )}

          <div className={isLoadingUsers ? 'opacity-50 pointer-events-none transition-opacity duration-200' : ''}>
            <div className="space-y-4">
              {users.length === 0 && !isLoadingUsers && (
                <p className="text-sm text-secondary-color italic text-center py-8">No users found.</p>
              )}
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-xl border border-theme hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-raised)] flex items-center justify-center font-bold text-secondary-color text-sm shrink-0">
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary-color truncate">{u.username}</p>
                      <p className="text-xs text-muted-color truncate">{u.email}</p>
                    </div>
                    <div className="hidden md:flex gap-2 ml-4 shrink-0">
                      <span className="px-2 py-0.5 bg-[var(--bg-raised)] rounded text-[9px] font-black uppercase tracking-widest">{u.plan}</span>
                      {u.role && u.role !== 'user' && (
                        <span className="px-2 py-0.5 bg-[var(--accent-bg)] text-[var(--accent)] rounded text-[9px] font-black uppercase tracking-widest">{u.role}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="hidden xl:block">
                      <p className="text-[10px] text-muted-color font-black uppercase">Credits</p>
                      <p className="text-xs font-bold text-primary-color">{u.credits} <span className="text-muted-color font-normal">/ {u.totalConsumed} used</span></p>
                    </div>
                    <div className="hidden lg:block text-right">
                      <p className="text-[10px] text-muted-color font-black uppercase">Last Active</p>
                      <p className="text-xs font-bold text-primary-color">{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {u.emailVerified ? (
                        <span className="px-2 py-1 text-[10px] font-bold text-[var(--jade)] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-[var(--jade)] rounded-full"></span> VERIFIED
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[10px] font-bold text-[var(--ember)] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-[var(--ember)] rounded-full"></span> UNVERIFIED
                        </span>
                      )}
                      <Link
                        to={`/admin/users/${u.id}`}
                        className="bg-[var(--accent)] text-white text-xs font-bold px-4 py-1.5 rounded-full min-w-[80px] hover:bg-[var(--accent-hover)] transition-colors text-center"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Users Pagination */}
          {usersTotal > USERS_PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-between text-sm">
              <p className="text-muted-color">
                Showing <span className="font-semibold text-primary-color">{usersStartItem}-{usersEndItem}</span> of <span className="font-semibold text-primary-color">{usersTotal}</span> users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                  aria-label="Previous page"
                  className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-muted-color font-mono text-xs">{usersPage} / {usersTotalPages}</span>
                <button
                  onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                  disabled={usersPage === usersTotalPages}
                  aria-label="Next page"
                  className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Tier Distribution + Recent Payments */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-12">
        <div className="bg-surface p-6 rounded-[12px] shadow-sm border border-theme">
          <h3 className="font-bold text-primary flex items-center gap-2 mb-6 uppercase text-sm tracking-widest">
            <Icon name="layers" className="text-lg" /> User Tiers
          </h3>
          <div className="space-y-6">
            {Object.entries(stats.tierDistribution).map(([tier, count]) => (
              <div key={tier}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold capitalize text-primary-color">{tier}</span>
                  <span className="text-xs text-muted-color">{count} users ({stats.totalUsers > 0 ? ((count / stats.totalUsers) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      tier === 'free' ? 'bg-[var(--accent)]' :
                      tier === 'starter' ? 'bg-blue-500' :
                      tier === 'pro' ? 'bg-gold' : 'bg-green'
                    }`}
                    style={{ width: `${stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-surface p-6 rounded-[12px] shadow-sm border border-theme">
          <h3 className="font-bold text-primary flex items-center gap-2 mb-6 uppercase text-sm tracking-widest">
            <Icon name="payments" className="text-lg" /> Recent Payments
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--bg-elevated)]">
                  <th className="px-4 py-2 text-[10px] font-black uppercase text-muted-color">User</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase text-muted-color">Amount</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase text-muted-color">Status</th>
                  <th className="px-4 py-2 text-[10px] font-black uppercase text-muted-color text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {stats.recentPayments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-sm text-secondary-color italic text-center">No recent payments recorded.</td>
                  </tr>
                )}
                {stats.recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm text-primary-color">{p.customerEmail}</td>
                    <td className="px-4 py-3 text-sm font-bold text-primary-color">{p.currency.toUpperCase()} {(p.amount / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded ${p.status === 'succeeded' ? 'bg-[var(--jade-bg)] text-[var(--jade)]' : 'bg-[var(--bg-raised)] text-muted-color'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-color text-right">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: string; color: string }> = ({ label, value, icon, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-surface p-5 rounded-[12px] shadow-sm border border-theme flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-xs font-bold text-muted-color uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-primary-color">{value}</p>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
