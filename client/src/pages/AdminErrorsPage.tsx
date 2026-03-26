import React, { useState, useEffect } from 'react';
import { getErrorStats, getErrorLogs, resolveError, bulkResolveErrors, deleteErrorLog, ErrorStats, GetErrorLogsResponse, ErrorLogEntry } from '../services/errorApi';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';

const AdminErrorsPage: React.FC = () => {
    const [stats, setStats] = useState<ErrorStats | null>(null);
    const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        errorType: '' as '' | 'frontend' | 'backend' | 'network',
        severity: '' as '' | 'info' | 'warning' | 'error' | 'critical',
        resolved: '' as '' | 'true' | 'false',
    });
    const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [expandedError, setExpandedError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [page, filters]);

    const fetchStats = async () => {
        try {
            const data = await getErrorStats();
            setStats(data);
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to load error stats', type: 'error' });
        }
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params: any = { page, limit: 50 };
            if (filters.errorType) params.errorType = filters.errorType;
            if (filters.severity) params.severity = filters.severity;
            if (filters.resolved) params.resolved = filters.resolved;
            
            const data = await getErrorLogs(params);
            setLogs(data.logs);
            setTotalPages(data.totalPages);
            setSelectedErrors([]);
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to load error logs', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (errorId: string) => {
        try {
            await resolveError(errorId);
            setToast({ message: 'Error resolved', type: 'success' });
            fetchLogs();
            fetchStats();
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to resolve error', type: 'error' });
        }
    };

    const handleBulkResolve = async () => {
        if (selectedErrors.length === 0) return;
        try {
            await bulkResolveErrors(selectedErrors);
            setToast({ message: `${selectedErrors.length} errors resolved`, type: 'success' });
            fetchLogs();
            fetchStats();
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to resolve errors', type: 'error' });
        }
    };

    const handleDelete = async (errorId: string) => {
        try {
            await deleteErrorLog(errorId);
            setToast({ message: 'Error deleted', type: 'success' });
            fetchLogs();
            fetchStats();
        } catch (err: any) {
            setToast({ message: err.message || 'Failed to delete error', type: 'error' });
        }
    };

    const toggleSelectAll = () => {
        if (selectedErrors.length === logs.length) {
            setSelectedErrors([]);
        } else {
            setSelectedErrors(logs.filter(l => !l.resolved).map(l => l._id));
        }
    };

    const toggleSelect = (errorId: string) => {
        setSelectedErrors(prev => 
            prev.includes(errorId) 
                ? prev.filter(id => id !== errorId)
                : [...prev, errorId]
        );
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'error': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'warning': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'info': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-zinc-100 text-zinc-700';
        }
    };

    const getErrorTypeColor = (type: string) => {
        switch (type) {
            case 'frontend': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'backend': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'network': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
            default: return 'bg-zinc-100 text-zinc-700';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 font-display">Error Logs</h1>
                    <p className="text-zinc-500 mt-1">Track and manage application errors.</p>
                </div>
                {selectedErrors.length > 0 && (
                    <button
                        onClick={handleBulkResolve}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Resolve Selected ({selectedErrors.length})
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard label="Total Errors" value={stats.total} color="blue" />
                    <StatCard label="Unresolved" value={stats.unresolved} color="orange" />
                    <StatCard label="Critical" value={stats.critical} color="red" />
                    <StatCard label="Frontend" value={stats.byType.frontend} color="purple" />
                    <StatCard label="Backend" value={stats.byType.backend} color="indigo" />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <select
                    value={filters.errorType}
                    onChange={(e) => { setFilters(f => ({ ...f, errorType: e.target.value as any })); setPage(1); }}
                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                >
                    <option value="">All Types</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="network">Network</option>
                </select>
                <select
                    value={filters.severity}
                    onChange={(e) => { setFilters(f => ({ ...f, severity: e.target.value as any })); setPage(1); }}
                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                >
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                </select>
                <select
                    value={filters.resolved}
                    onChange={(e) => { setFilters(f => ({ ...f, resolved: e.target.value as any })); setPage(1); }}
                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                >
                    <option value="">All Status</option>
                    <option value="false">Unresolved</option>
                    <option value="true">Resolved</option>
                </select>
            </div>

            {/* Error Logs Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedErrors.length === logs.filter(l => !l.resolved).length && logs.filter(l => !l.resolved).length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded"
                                    />
                                </th>
                                <th className="p-4 font-semibold">Severity</th>
                                <th className="p-4 font-semibold">Type</th>
                                <th className="p-4 font-semibold">Message</th>
                                <th className="p-4 font-semibold">User</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Time</th>
                                <th className="p-4 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center">
                                        <Spinner size="md" />
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-zinc-500">
                                        No errors found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((error) => (
                                    <React.Fragment key={error._id}>
                                        <tr className={`text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${error.resolved ? 'opacity-60' : ''}`}>
                                            <td className="p-4">
                                                {!error.resolved && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedErrors.includes(error._id)}
                                                        onChange={() => toggleSelect(error._id)}
                                                        className="rounded"
                                                    />
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getSeverityColor(error.severity)}`}>
                                                    {error.severity}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getErrorTypeColor(error.errorType)}`}>
                                                    {error.errorType}
                                                </span>
                                            </td>
                                            <td className="p-4 max-w-md">
                                                <button
                                                    onClick={() => setExpandedError(expandedError === error._id ? null : error._id)}
                                                    className="text-left hover:text-blue-600 transition-colors truncate block w-full"
                                                >
                                                    {error.message.slice(0, 80)}{error.message.length > 80 ? '...' : ''}
                                                </button>
                                            </td>
                                            <td className="p-4 text-zinc-500">
                                                {error.userEmail || '-'}
                                            </td>
                                            <td className="p-4">
                                                {error.resolved ? (
                                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        Resolved
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                        Open
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-zinc-500">
                                                {new Date(error.createdAt).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    {!error.resolved && (
                                                        <button
                                                            onClick={() => handleResolve(error._id)}
                                                            className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(error._id)}
                                                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedError === error._id && (
                                            <tr>
                                                <td colSpan={8} className="p-4 bg-zinc-50 dark:bg-zinc-800/30">
                                                    <div className="space-y-3">
                                                        <div>
                                                            <strong className="text-xs uppercase text-zinc-500">Full Message:</strong>
                                                            <pre className="mt-1 text-sm whitespace-pre-wrap break-words bg-white dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-700 max-h-40 overflow-auto">
                                                                {error.message}
                                                            </pre>
                                                        </div>
                                                        {error.stack && (
                                                            <div>
                                                                <strong className="text-xs uppercase text-zinc-500">Stack Trace:</strong>
                                                                <pre className="mt-1 text-xs whitespace-pre-wrap break-words bg-white dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-700 max-h-60 overflow-auto font-mono">
                                                                    {error.stack}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                            {error.url && (
                                                                <div>
                                                                    <strong className="text-zinc-500">URL:</strong>
                                                                    <p className="truncate">{error.url}</p>
                                                                </div>
                                                            )}
                                                            {error.method && (
                                                                <div>
                                                                    <strong className="text-zinc-500">Method:</strong>
                                                                    <p>{error.method}</p>
                                                                </div>
                                                            )}
                                                            {error.endpoint && (
                                                                <div>
                                                                    <strong className="text-zinc-500">Endpoint:</strong>
                                                                    <p>{error.endpoint}</p>
                                                                </div>
                                                            )}
                                                            {error.statusCode && (
                                                                <div>
                                                                    <strong className="text-zinc-500">Status:</strong>
                                                                    <p>{error.statusCode}</p>
                                                                </div>
                                                            )}
                                                            {error.userAgent && (
                                                                <div className="col-span-2">
                                                                    <strong className="text-zinc-500">User Agent:</strong>
                                                                    <p className="truncate">{error.userAgent}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-sm text-zinc-500">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
    const colors: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
        indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-zinc-500 text-sm">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</p>
        </div>
    );
};

export default AdminErrorsPage;
