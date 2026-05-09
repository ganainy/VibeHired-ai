import React, { useState, useEffect, useMemo } from 'react';
import { getErrorStats, getErrorLogs, resolveError, bulkResolveErrors, deleteErrorLog, ErrorStats, ErrorLogEntry } from '../services/errorApi';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';

const AdminErrorsPage: React.FC = () => {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [limit, setLimit] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
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
  }, [page, filters, limit]);

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
      const params: any = { page, limit };
      if (filters.errorType) params.errorType = filters.errorType;
      if (filters.severity) params.severity = filters.severity;
      if (filters.resolved) params.resolved = filters.resolved;

      const data = await getErrorLogs(params);
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotalLogs(data.total);
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

  const unresolvedErrorIds = logs.filter(l => !l.resolved).map(l => l._id);
  const areAllUnresolvedSelected = unresolvedErrorIds.length > 0 && unresolvedErrorIds.every(id => selectedErrors.includes(id));

  const toggleSelectAll = () => {
    if (areAllUnresolvedSelected) {
      setSelectedErrors([]);
    } else {
      setSelectedErrors(unresolvedErrorIds);
    }
  };

  const toggleSelect = (errorId: string) => {
    setSelectedErrors(prev =>
      prev.includes(errorId)
        ? prev.filter(id => id !== errorId)
        : [...prev, errorId]
    );
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="bg-error-bg text-error px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tighter flex items-center gap-1 w-fit">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
            Critical
          </span>
        );
      case 'error':
        return (
          <span className="bg-error-bg text-error px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tighter flex items-center gap-1 w-fit border border-error/20">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
            Error
          </span>
        );
      case 'warning':
        return (
          <span className="bg-gold-lightest text-gold px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tighter flex items-center gap-1 w-fit border border-gold/20">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            Warning
          </span>
        );
      case 'info':
        return (
          <span className="bg-green-light text-green px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tighter flex items-center gap-1 w-fit">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            Info
          </span>
        );
      default:
        return (
          <span className="bg-elevated text-secondary-color px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tighter flex items-center gap-1 w-fit border border-theme">
            {severity}
          </span>
        );
    }
  };

  const getServiceName = (type: string) => {
    switch (type) {
      case 'frontend': return 'client-app';
      case 'backend': return 'api-gateway';
      case 'network': return 'network-proxy';
      default: return type;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    const secs = d.getSeconds().toString().padStart(2, '0');
    return `${month} ${day}, ${hours}:${mins}:${secs}`;
  };

  const generateTraceId = (id: string) => {
    const tail = id.slice(-6).toUpperCase();
    return `TR-${tail.slice(0, 2)}${tail.slice(2, 4)}-${tail.slice(4)}`;
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(log =>
      log.message.toLowerCase().includes(q) ||
      (log.stack && log.stack.toLowerCase().includes(q)) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(q)) ||
      (log.endpoint && log.endpoint.toLowerCase().includes(q)) ||
      log._id.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  const severityOptions: { label: string; value: '' | 'info' | 'warning' | 'error' | 'critical' }[] = [
    { label: 'All Severities', value: '' },
    { label: 'Critical', value: 'critical' },
    { label: 'Error', value: 'error' },
    { label: 'Warning', value: 'warning' },
    { label: 'Info', value: 'info' },
  ];

  const statusOptions: { label: string; value: '' | 'true' | 'false' }[] = [
    { label: 'All Status', value: '' },
    { label: 'Unresolved', value: 'false' },
    { label: 'Resolved', value: 'true' },
  ];

  return (
    <div className="space-y-6" style={{ letterSpacing: '-0.01em' }}>
      {/* Header Section */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="font-manrope text-5xl md:text-6xl font-bold text-green tracking-tight leading-none">
            Error Logs
          </h1>
          <p className="text-base text-secondary-color max-w-2xl mt-2">
            Real-time system health monitoring and diagnostic trace history for the LogMonitor architecture.
          </p>
        </div>
        {selectedErrors.length > 0 && (
          <button
            onClick={handleBulkResolve}
            className="btn-primary text-sm"
          >
            Resolve Selected ({selectedErrors.length})
          </button>
        )}
      </header>

      {/* Metrics Row */}
      {stats && (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-surface p-6 rounded-xl whisper-shadow border border-white/50">
            <p className="text-xs font-semibold text-muted-color uppercase tracking-widest mb-1">Total Errors</p>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-3xl md:text-4xl font-bold text-primary-color">{stats.total.toLocaleString()}</span>
              <span className="text-error text-sm font-semibold pb-1 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-base">trending_up</span>
                {Math.round((stats.unresolved / (stats.total || 1)) * 100)}%
              </span>
            </div>
          </div>
          <div className="bg-surface p-6 rounded-xl whisper-shadow border border-white/50">
            <p className="text-xs font-semibold text-muted-color uppercase tracking-widest mb-1">Unresolved</p>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-3xl md:text-4xl font-bold text-primary-color">{stats.unresolved}</span>
              <span className="material-symbols-outlined text-gold">pending</span>
            </div>
          </div>
          <div className="bg-error-bg p-6 rounded-xl whisper-shadow border border-error/10">
            <p className="text-xs font-semibold text-error uppercase tracking-widest mb-1">Critical</p>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-3xl md:text-4xl font-bold text-error">{String(stats.critical).padStart(2, '0')}</span>
              <div className="w-2 h-2 rounded-full bg-error animate-pulse mb-2" />
            </div>
          </div>
          <div className="bg-surface p-6 rounded-xl whisper-shadow border border-white/50">
            <p className="text-xs font-semibold text-muted-color uppercase tracking-widest mb-1">Frontend</p>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-3xl md:text-4xl font-bold text-primary-color">{stats.byType.frontend}</span>
              <span className="material-symbols-outlined text-green">laptop_mac</span>
            </div>
          </div>
          <div className="bg-surface p-6 rounded-xl whisper-shadow border border-white/50">
            <p className="text-xs font-semibold text-muted-color uppercase tracking-widest mb-1">Backend</p>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-3xl md:text-4xl font-bold text-primary-color">{stats.byType.backend}</span>
              <span className="material-symbols-outlined text-green-house">dns</span>
            </div>
          </div>
        </section>
      )}

      {/* Log List Controls */}
      <div className="bg-white/40 backdrop-blur-sm rounded-t-3xl p-4 border-x border-t border-theme/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary-color">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trace IDs, messages..."
              className="bg-surface border border-theme h-11 pl-12 pr-6 rounded-full w-full max-w-xs focus:ring-2 focus:ring-green-accent focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filters.severity}
              onChange={(e) => { setFilters(f => ({ ...f, severity: e.target.value as any })); setPage(1); }}
              className={`appearance-none cursor-pointer px-4 py-2 rounded-full text-sm font-semibold transition-colors outline-none ${
                filters.severity
                  ? 'bg-green-light text-green'
                  : 'bg-surface border border-theme text-secondary-color'
              }`}
            >
              {severityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={filters.resolved}
              onChange={(e) => { setFilters(f => ({ ...f, resolved: e.target.value as any })); setPage(1); }}
              className={`appearance-none cursor-pointer px-4 py-2 rounded-full text-sm font-semibold transition-colors outline-none ${
                filters.resolved
                  ? 'bg-green-light text-green'
                  : 'bg-surface border border-theme text-secondary-color'
              }`}
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-secondary-color font-medium uppercase tracking-wide">
          Showing {filteredLogs.length} of {totalLogs.toLocaleString()} logs
        </p>
      </div>

      {/* Log Table */}
      <div className="bg-surface rounded-b-3xl border border-theme/30 whisper-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[rgba(237,235,233,0.5)] border-b border-theme/20">
              <tr>
                <th className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={areAllUnresolvedSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all unresolved errors"
                    className="rounded border-theme"
                  />
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-color uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-color uppercase tracking-widest">Severity</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-color uppercase tracking-widest">Service</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-color uppercase tracking-widest">Message</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-color uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/10">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Spinner size="md" />
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-secondary-color">
                    No errors found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((error) => (
                  <React.Fragment key={error._id}>
                    <tr className={`hover:bg-[rgba(242,240,235,0.3)] transition-colors group ${error.resolved ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 align-top">
                        {!error.resolved && (
                          <input
                            type="checkbox"
                            checked={selectedErrors.includes(error._id)}
                            onChange={() => toggleSelect(error._id)}
                            aria-label={`Select error ${error._id}`}
                            className="rounded border-theme"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <p className="text-sm font-semibold text-primary-color">{formatTimestamp(error.createdAt)}</p>
                        <p className="text-xs text-secondary-color">Trace: {generateTraceId(error._id)}</p>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {getSeverityBadge(error.severity)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <p className="text-sm font-semibold text-green">{getServiceName(error.errorType)}</p>
                      </td>
                      <td className="px-6 py-4 align-top max-w-md">
                        <button
                          onClick={() => setExpandedError(expandedError === error._id ? null : error._id)}
                          className="text-left hover:text-green transition-colors truncate block w-full"
                        >
                          <p className="font-bold text-primary-color truncate">{error.message.slice(0, 80)}{error.message.length > 80 ? '...' : ''}</p>
                        </button>
                        {error.stack && (
                          <p className="text-xs text-secondary-color line-clamp-2 mt-1">
                            {error.stack.split('\n')[0]}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!error.resolved && (
                            <button
                              onClick={() => handleResolve(error._id)}
                              className="h-9 px-4 rounded-full border border-green text-green text-sm font-semibold hover:bg-green hover:text-white transition-all squish"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(error._id)}
                            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-error-bg hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedError === error._id && (
                      <tr>
                        <td colSpan={6} className="p-6 bg-base">
                          <div className="space-y-4">
                            <div>
                              <strong className="text-xs uppercase text-secondary-color">Full Message:</strong>
                              <pre className="mt-2 text-sm whitespace-pre-wrap break-words bg-surface p-4 rounded-xl border border-theme max-h-40 overflow-auto">
                                {error.message}
                              </pre>
                            </div>
                            {error.stack && (
                              <div>
                                <strong className="text-xs uppercase text-secondary-color">Stack Trace:</strong>
                                <pre className="mt-2 text-xs whitespace-pre-wrap break-words bg-surface p-4 rounded-xl border border-theme max-h-60 overflow-auto font-mono">
                                  {error.stack}
                                </pre>
                              </div>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {error.url && (
                                <div>
                                  <strong className="text-secondary-color">URL:</strong>
                                  <p className="truncate">{error.url}</p>
                                </div>
                              )}
                              {error.method && (
                                <div>
                                  <strong className="text-secondary-color">Method:</strong>
                                  <p>{error.method}</p>
                                </div>
                              )}
                              {error.endpoint && (
                                <div>
                                  <strong className="text-secondary-color">Endpoint:</strong>
                                  <p>{error.endpoint}</p>
                                </div>
                              )}
                              {error.statusCode && (
                                <div>
                                  <strong className="text-secondary-color">Status:</strong>
                                  <p>{error.statusCode}</p>
                                </div>
                              )}
                              {error.userEmail && (
                                <div>
                                  <strong className="text-secondary-color">User:</strong>
                                  <p className="truncate">{error.userEmail}</p>
                                </div>
                              )}
                              {error.userAgent && (
                                <div className="col-span-2 md:col-span-4">
                                  <strong className="text-secondary-color">User Agent:</strong>
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

        {/* Table Footer */}
        {totalPages > 1 && (
          <div className="p-6 bg-[rgba(237,235,233,0.3)] border-t border-theme/20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-10 h-10 rounded-full border border-theme flex items-center justify-center squish bg-white disabled:opacity-40"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold squish transition-colors ${
                      page === pageNum
                        ? 'bg-green text-white'
                        : 'border border-theme hover:bg-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="mx-1 text-secondary-color">...</span>
                  <button
                    onClick={() => setPage(totalPages)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold squish transition-colors ${
                      page === totalPages
                        ? 'bg-green text-white'
                        : 'border border-theme hover:bg-white'
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-10 h-10 rounded-full border border-theme flex items-center justify-center squish bg-white disabled:opacity-40"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-transparent border-none text-sm text-secondary-color outline-none focus:ring-0 cursor-pointer"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
              </select>
              <p className="text-sm text-secondary-color">Page {page} of {totalPages}</p>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminErrorsPage;
