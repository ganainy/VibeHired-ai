import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getUserDetail,
  getUserCvLibrary,
  getUserCvPreview,
  getUserCvDetail,
  AdminUser,
  UserUsageDetail,
  UserCvSummary,
  UserCvDetail,
  grantUserCredits,
  updateUserRole,
  updateUserPlan,
  cancelUserSubscription,
  setUserBlocked
} from '../services/adminApi';
import Spinner from '../components/common/Spinner';
import CvPreviewModal from '../components/cv-editor/CvPreviewModal';
import CvDocumentRenderer from '../components/cv-editor/CvDocumentRenderer';
import { DataTable, DataTableColumn } from '../components/common/DataTable';
import ConfirmModal from '../components/common/ConfirmModal';

const USAGE_PAGE_SIZE = 10;
const CV_PAGE_SIZE = 5;

/* ─── Helper: get initials from username or email ─── */
const getInitials = (name?: string, email?: string) => {
  const source = (name || email || 'U').trim();
  const parts = source.split(/[\s._@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

/* ─── Helper: format relative time ─── */
const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/* ─── Helper: action type badge color ─── */
const getActionTypeStyle = (type: string) => {
  switch (type) {
    case 'cvParsing': return { bg: 'var(--accent-bg)', color: 'var(--accent)', label: 'CV Parse' };
    case 'emailScan': return { bg: 'var(--jade-bg)', color: 'var(--jade)', label: 'Email Scan' };
    case 'coverLetter': return { bg: 'rgba(200,32,20,0.08)', color: 'var(--rose)', label: 'Cover Letter' };
    case 'interviewPrep': return { bg: 'rgba(217,119,6,0.08)', color: '#d97706', label: 'Interview' };
    default: return { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)', label: type };
  }
};

const AdminUserDetailPage: React.FC = () => {
  const { userId } = useParams();
  const [data, setData] = useState<(AdminUser & { usage: UserUsageDetail }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [grantAmount, setGrantAmount] = useState(10);
  const [grantReason] = useState('Bonus credits');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cvLibrary, setCvLibrary] = useState<UserCvSummary[]>([]);
  const [isLoadingCvLibrary, setIsLoadingCvLibrary] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [templatePreviewCv, setTemplatePreviewCv] = useState<UserCvDetail | null>(null);
  const [isTemplatePreviewLoading, setIsTemplatePreviewLoading] = useState(false);
  const [usagePage, setUsagePage] = useState(1);
  const [cvPage, setCvPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
    confirmLabel?: string;
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setIsLoadingCvLibrary(true);
      try {
        const [detail, cvLibraryResponse] = await Promise.all([
          getUserDetail(userId),
          getUserCvLibrary(userId)
        ]);
        if (!isMounted) return;
        setData(detail);
        setCvLibrary(cvLibraryResponse.cvs || []);
      } catch (err) {
        console.error('Failed to load user detail:', err);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
        setIsLoadingCvLibrary(false);
      }
    };
    fetchDetail();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    setUsagePage(1);
  }, [data?.usage?.actions?.length]);

  useEffect(() => {
    setCvPage(1);
  }, [cvLibrary.length]);

  const handlePreviewCv = async (cvId: string, mode: 'original' | 'current') => {
    if (!userId) return;
    setIsPreviewLoading(true);
    setPreviewPdfBase64(null);
    setActionError(null);
    try {
      const response = await getUserCvPreview(userId, cvId, mode);
      if (response.source === 'originalPdf' && mode === 'current') {
        setActionError('Current CV preview is not available yet. Showing original PDF instead.');
      }
      setPreviewPdfBase64(response.pdfBase64);
      setIsPreviewOpen(true);
    } catch (err) {
      setActionError('Failed to load CV preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewCurrentTemplate = async (cvId: string) => {
    if (!userId) return;
    setIsTemplatePreviewLoading(true);
    setTemplatePreviewCv(null);
    setActionError(null);
    try {
      const detail = await getUserCvDetail(userId, cvId);
      const hasTemplatePayload =
        detail.cvJson || (detail.cvDescriptor && detail.cvData);
      if (!hasTemplatePayload) {
        setActionError('No CV data available for template preview.');
        return;
      }
      setTemplatePreviewCv(detail);
      setIsTemplatePreviewOpen(true);
    } catch (err) {
      setActionError('Failed to load current CV preview');
    } finally {
      setIsTemplatePreviewLoading(false);
    }
  };

  const dynamicPayload = useMemo(() => {
    if (!templatePreviewCv?.cvDescriptor || !templatePreviewCv?.cvData) return null;
    return { descriptor: templatePreviewCv.cvDescriptor, data: templatePreviewCv.cvData };
  }, [templatePreviewCv]);

  const usageActions = useMemo(() => data?.usage.actions || [], [data?.usage.actions]);
  const usageTotalPages = Math.max(1, Math.ceil(usageActions.length / USAGE_PAGE_SIZE));
  const usageStartItem = usageActions.length === 0 ? 0 : (usagePage - 1) * USAGE_PAGE_SIZE + 1;
  const usageEndItem = Math.min(usagePage * USAGE_PAGE_SIZE, usageActions.length);
  const pagedUsage = useMemo(
    () => usageActions.slice((usagePage - 1) * USAGE_PAGE_SIZE, usagePage * USAGE_PAGE_SIZE),
    [usageActions, usagePage]
  );

  const cvTotalPages = Math.max(1, Math.ceil(cvLibrary.length / CV_PAGE_SIZE));
  const cvStartItem = cvLibrary.length === 0 ? 0 : (cvPage - 1) * CV_PAGE_SIZE + 1;
  const cvEndItem = Math.min(cvPage * CV_PAGE_SIZE, cvLibrary.length);
  const pagedCvLibrary = useMemo(
    () => cvLibrary.slice((cvPage - 1) * CV_PAGE_SIZE, cvPage * CV_PAGE_SIZE),
    [cvLibrary, cvPage]
  );

  const handleGrantCredits = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await grantUserCredits(userId, grantAmount, grantReason);
      const updated = await getUserDetail(userId);
      setData(updated);
    } catch (err) {
      setActionError('Failed to grant credits');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!userId) return;
    setActionError(null);
    try {
      await updateUserRole(userId, newRole);
      const updated = await getUserDetail(userId);
      setData(updated);
    } catch (err) {
      setActionError('Failed to update role');
    }
  };

  const handlePlanChange = async (newPlan: string) => {
    if (!userId) return;
    setActionError(null);
    try {
      await updateUserPlan(userId, newPlan);
      const updated = await getUserDetail(userId);
      setData(updated);
    } catch (err) {
      setActionError('Failed to update plan');
    }
  };

  const handleCancelSubscription = async () => {
    if (!userId || !data) return;
    setConfirmModal({
      show: true,
      title: 'Cancel Subscription',
      message: `Cancel ${data.email}'s subscription? They will be moved to the free plan immediately.`,
      confirmLabel: 'Cancel Subscription',
      danger: true,
      onConfirm: async () => {
        setIsCancelling(true);
        setActionError(null);
        try {
          await cancelUserSubscription(userId!);
          const updated = await getUserDetail(userId!);
          setData(updated);
        } catch (err) {
          setActionError('Failed to cancel subscription');
        } finally {
          setIsCancelling(false);
        }
      }
    });
  };

  const handleToggleBlock = async () => {
    if (!userId || !data) return;
    const action = data.isBlocked ? 'unblock' : 'block';
    setConfirmModal({
      show: true,
      title: data.isBlocked ? 'Unblock User' : 'Block User',
      message: `Are you sure you want to ${action} ${data.email}?`,
      confirmLabel: data.isBlocked ? 'Unblock User' : 'Block User',
      danger: !data.isBlocked,
      onConfirm: async () => {
        setIsBlocking(true);
        setActionError(null);
        try {
          await setUserBlocked(userId!, !data!.isBlocked);
          const updated = await getUserDetail(userId!);
          setData(updated);
        } catch (err) {
          setActionError(`Failed to ${action} user`);
        } finally {
          setIsBlocking(false);
        }
      }
    });
  };

  /* ─── Derived stats ─── */
  const totalConsumed = data?.usage?.usage?.consumed ?? 0;
  const creditLimit = data?.usage?.usage?.total ?? 0;
  const creditRemaining = data?.usage?.usage?.remaining ?? 0;

  const planLabel = (plan?: string) => {
    if (!plan) return 'Free';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const roleLabel = (role?: string) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  /* ─── DataTable column definitions ─── */
  const usageColumns: DataTableColumn<any>[] = useMemo(() => [
    {
      key: 'type',
      label: 'Action',
      render: (action: any) => {
        const style = getActionTypeStyle(action.type);
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border"
            style={{ backgroundColor: style.bg, color: style.color, borderColor: style.color + '20' }}
          >
            {style.label}
          </span>
        );
      }
    },
    {
      key: 'consumed',
      label: 'Consumed',
      render: (action: any) => (
        <span className="font-bold text-[var(--text-primary)] tabular-nums">
          {action.consumed}
        </span>
      )
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (action: any) => (
        <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
          {new Date(action.timestamp).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )
    }
  ], []);

  const cvColumns: DataTableColumn<UserCvSummary>[] = useMemo(() => [
    {
      key: 'displayName',
      label: 'CV',
      render: (cv: UserCvSummary) => (
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-[var(--text-primary)] truncate">
            {cv.displayName || 'Untitled CV'}
          </span>
          {cv.filename && (
            <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              {cv.filename}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (cv: UserCvSummary) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)]">
          {cv.category || 'General'}
        </span>
      )
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (cv: UserCvSummary) => (
        <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
          {new Date(cv.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (cv: UserCvSummary) => (
        <span className="text-[13px] text-[var(--text-muted)] tabular-nums">
          {formatRelativeTime(cv.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (cv: UserCvSummary) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handlePreviewCv(cv.id, 'original')}
            disabled={!cv.hasOriginalSnapshot || isPreviewLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 active:scale-[0.97] bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--border-subtle)]"
          >
            <EyeIcon className="w-3.5 h-3.5" />
            Original
          </button>
          <button
            type="button"
            onClick={() => handlePreviewCurrentTemplate(cv.id)}
            disabled={isTemplatePreviewLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 active:scale-[0.97] bg-[var(--accent)] text-white hover:brightness-110"
          >
            <EyeIcon className="w-3.5 h-3.5" />
            Current
          </button>
        </div>
      )
    }
  ], [isPreviewLoading, isTemplatePreviewLoading]);

  /* ─── Shared select style ─── */
  const selectCls =
    "w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none transition-all " +
    "bg-white border border-[var(--border)] text-[var(--text-primary)] " +
    "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-bg)] cursor-pointer appearance-none";

  if (!userId) {
    return (
      <div className="space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to users
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8">
          <p className="text-sm text-[var(--text-secondary)]">No user selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to users
          </Link>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] font-display tracking-tight">
            User Details
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage access, usage, and CV previews.
          </p>
        </div>
        {data && (
          <span className="text-xs text-[var(--text-muted)] font-mono">
            Updated {formatRelativeTime(new Date().toISOString())}
          </span>
        )}
      </div>

      {/* ═══ Loading State ═══ */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-[var(--border)] shadow-sm min-h-[400px] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : data ? (
        <div className="space-y-6">

          {/* ─── Error Banner ─── */}
          {actionError && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--rose-bg)] border border-[var(--rose)]/20 text-sm">
              <AlertIcon className="w-4 h-4 text-[var(--rose)] shrink-0" />
              <span className="font-medium text-[var(--rose)]">{actionError}</span>
              <button
                onClick={() => setActionError(null)}
                className="ml-auto text-[var(--rose)] hover:opacity-70 underline text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ═══ Profile Hero Card ═══ */}
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
            {/* Subtle top accent bar */}
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)' }} />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                {/* Avatar + Info */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black tracking-tight"
                      style={{
                        backgroundColor: data.isBlocked ? 'var(--rose-bg)' : 'var(--accent-bg)',
                        color: data.isBlocked ? 'var(--rose)' : 'var(--accent)',
                      }}
                    >
                      {getInitials(data.username, data.email)}
                    </div>
                    {/* Online / status dot */}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                      style={{ backgroundColor: data.isBlocked ? 'var(--rose)' : 'var(--jade)' }}
                      title={data.isBlocked ? 'Blocked' : 'Active'}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">
                        {data.username || data.email.split('@')[0]}
                      </h2>
                      {data.isBlocked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[var(--rose-bg)] text-[var(--rose)] border border-[var(--rose)]/15">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--rose)]" />
                          Blocked
                        </span>
                      )}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border"
                        style={{
                          backgroundColor: data.plan === 'free' ? 'var(--bg-base)' : 'var(--accent-bg)',
                          color: data.plan === 'free' ? 'var(--text-muted)' : 'var(--accent)',
                          borderColor: data.plan === 'free' ? 'var(--border)' : 'var(--accent)',
                        }}
                      >
                        {planLabel(data.plan)}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border)]">
                        {roleLabel(data.role)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">{data.email}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-base)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                        ID: {data.id.slice(-12)}
                      </span>
                      {data.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--jade)]">
                          <CheckIcon className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--rose)]">
                          <AlertIcon className="w-3.5 h-3.5" />
                          Unverified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Block / Unblock Action */}
                <button
                  onClick={handleToggleBlock}
                  disabled={isBlocking}
                  aria-label={data.isBlocked ? 'Unblock user' : 'Block user'}
                  className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-50"
                  style={data.isBlocked
                    ? { backgroundColor: 'var(--jade-bg)', color: 'var(--jade)', border: '1px solid var(--jade)' }
                    : { backgroundColor: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)' }
                  }
                >
                  {data.isBlocked ? <UnlockIcon className="w-4 h-4" /> : <LockIcon className="w-4 h-4" />}
                  {isBlocking ? 'Processing...' : data.isBlocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>
            </div>
          </div>

          {/* ═══ Quick Stats ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<ActivityIcon className="w-5 h-5" />}
              label="Total Usage"
              value={totalConsumed.toString()}
              accent="var(--accent)"
            />
            <StatCard
              icon={<CreditCardIcon className="w-5 h-5" />}
              label="Credits Left"
              value={creditRemaining.toString()}
              accent="var(--jade)"
            />
            <StatCard
              icon={<FileIcon className="w-5 h-5" />}
              label="CVs Stored"
              value={cvLibrary.length.toString()}
              accent="#d97706"
            />
            <StatCard
              icon={<CalendarIcon className="w-5 h-5" />}
              label="Member Since"
              value={new Date(data.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              accent="var(--text-secondary)"
            />
          </div>

          {/* ═══ Account Settings + Credits Grid ═══ */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Account Settings */}
            <div className="xl:col-span-2 rounded-3xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-base)]/50">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-[var(--accent)]" />
                  Account Settings
                </h3>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {/* Plan */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Plan
                    </label>
                    <div className="relative">
                      <select
                        value={data.plan}
                        onChange={(e) => handlePlanChange(e.target.value)}
                        aria-label="Change user plan"
                        className={selectCls}
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                      <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        value={data.role}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        aria-label="Change user role"
                        className={selectCls}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                      <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Email Status */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Email Status
                    </label>
                    <div
                      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold border"
                      style={{
                        backgroundColor: data.emailVerified ? 'var(--jade-bg)' : 'var(--rose-bg)',
                        borderColor: data.emailVerified ? 'var(--jade)' : 'var(--rose)',
                        color: data.emailVerified ? 'var(--jade)' : 'var(--rose)',
                      }}
                    >
                      {data.emailVerified ? <CheckIcon className="w-4 h-4" /> : <AlertIcon className="w-4 h-4" />}
                      {data.emailVerified ? 'Verified' : 'Unverified'}
                    </div>
                  </div>
                </div>

                {/* Stripe Info */}
                {(data.stripeCustomerId || data.stripeSubscriptionId) && (
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                    <StripeIcon />
                    {data.stripeCustomerId && (
                      <a
                        href={`https://dashboard.stripe.com/customers/${data.stripeCustomerId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono hover:underline transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        {data.stripeCustomerId}
                      </a>
                    )}
                    {data.stripeSubscriptionId && (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={isCancelling}
                        aria-label="Cancel subscription"
                        className="ml-auto px-4 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50 active:scale-[0.97]"
                        style={{ color: 'var(--rose)', border: '1px solid var(--rose)', backgroundColor: 'transparent' }}
                      >
                        {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Credits Card */}
            <div className="rounded-3xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-base)]/50">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <CreditCardIcon className="w-4 h-4 text-[var(--accent)]" />
                  Manage Credits
                </h3>
              </div>
              <div className="p-6 space-y-5">
                {/* Big credit display */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      Remaining Credits
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black text-[var(--accent)]">{creditRemaining}</span>
                      <span className="text-sm text-[var(--text-muted)] font-medium">/ {creditLimit}</span>
                    </div>
                  </div>
                  {/* Circular progress visual */}
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, Math.max(0, (creditRemaining / Math.max(1, creditLimit)) * 97.4))} 97.4`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--accent)]">
                      {creditLimit > 0 ? Math.round((creditRemaining / creditLimit) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Usage bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                    <span>Used {totalConsumed}</span>
                    <span>Limit {creditLimit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-base)] border border-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (totalConsumed / Math.max(1, creditLimit)) * 100)}%`,
                        backgroundColor: totalConsumed > creditLimit * 0.9 ? 'var(--rose)' : 'var(--accent)',
                      }}
                    />
                  </div>
                </div>

                {/* Grant form */}
                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    Grant Additional Credits
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={grantAmount}
                      onChange={(e) => setGrantAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none transition-all bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-bg)]"
                    />
                    <button
                      onClick={handleGrantCredits}
                      disabled={isSubmitting}
                      aria-label="Grant credits"
                      className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-50 bg-[var(--accent)] text-white hover:brightness-110"
                    >
                      <PlusIcon className="w-4 h-4" />
                      {isSubmitting ? 'Granting...' : 'Grant'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Usage History ═══ */}
          <div className="rounded-3xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-base)]/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-[var(--accent)]" />
                Usage History
              </h3>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg-base)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                {usageActions.length} actions
              </span>
            </div>
            <div className="px-6 py-2 bg-white">
              <DataTable
                data={pagedUsage}
                columns={usageColumns}
                emptyState={
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ActivityIcon className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-3" />
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">No usage history yet</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">This user has not performed any actions.</p>
                  </div>
                }
              />
            </div>

            {/* Pagination */}
            {usageActions.length > USAGE_PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/30 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Showing <span className="font-semibold text-[var(--text-primary)]">{usageStartItem}-{usageEndItem}</span>{' '}
                  of <span className="font-semibold text-[var(--text-primary)]">{usageActions.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <PaginationButton
                    onClick={() => setUsagePage(p => Math.max(1, p - 1))}
                    disabled={usagePage === 1}
                    aria-label="Previous page"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                  </PaginationButton>
                  <span className="px-3 py-1.5 text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
                    {usagePage} / {usageTotalPages}
                  </span>
                  <PaginationButton
                    onClick={() => setUsagePage(p => Math.min(usageTotalPages, p + 1))}
                    disabled={usagePage === usageTotalPages}
                    aria-label="Next page"
                  >
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </PaginationButton>
                </div>
              </div>
            )}
          </div>

          {/* ═══ CV Library ═══ */}
          <div className="rounded-3xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-base)]/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-[var(--accent)]" />
                CV Library
              </h3>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg-base)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                {cvLibrary.length} CVs
              </span>
            </div>
            <div className="p-0">
              {isLoadingCvLibrary ? (
                <div className="p-12 flex items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : (
                <div className="px-6 py-2 bg-white">
                  <DataTable
                    data={pagedCvLibrary}
                    columns={cvColumns}
                    emptyState={
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileIcon className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-3" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">No CVs found</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">This user has not uploaded any CVs yet.</p>
                      </div>
                    }
                  />
                </div>
              )}
            </div>

            {/* Pagination */}
            {cvLibrary.length > CV_PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/30 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Showing <span className="font-semibold text-[var(--text-primary)]">{cvStartItem}-{cvEndItem}</span>{' '}
                  of <span className="font-semibold text-[var(--text-primary)]">{cvLibrary.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <PaginationButton
                    onClick={() => setCvPage(p => Math.max(1, p - 1))}
                    disabled={cvPage === 1}
                    aria-label="Previous page"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                  </PaginationButton>
                  <span className="px-3 py-1.5 text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
                    {cvPage} / {cvTotalPages}
                  </span>
                  <PaginationButton
                    onClick={() => setCvPage(p => Math.min(cvTotalPages, p + 1))}
                    disabled={cvPage === cvTotalPages}
                    aria-label="Next page"
                  >
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </PaginationButton>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8">
          <p className="text-sm text-[var(--text-secondary)]">User not found.</p>
        </div>
      )}

      {/* ═══ Modals ═══ */}
      <CvPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewPdfBase64(null);
        }}
        pdfBase64={previewPdfBase64}
        isLoading={isPreviewLoading}
      />

      <ConfirmModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />

      {isTemplatePreviewOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[120] p-4" onClick={() => setIsTemplatePreviewOpen(false)}>
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-primary-color">
                  Current CV Preview
                </h2>
                {templatePreviewCv?.displayName && (
                  <p className="text-xs text-secondary-color mt-1">
                    {templatePreviewCv.displayName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsTemplatePreviewOpen(false)}
                className="text-muted-color hover:text-secondary-color"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            {isTemplatePreviewLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : templatePreviewCv ? (
              <div className="flex-1 overflow-y-auto border rounded-lg">
                <CvDocumentRenderer
                  data={templatePreviewCv.cvJson}
                  onChange={() => {}}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-secondary-color">No preview available</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <button
                onClick={() => setIsTemplatePreviewOpen(false)}
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                className="px-4 py-2 rounded hover:bg-[var(--accent-hover)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════ */

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}> = ({ icon, label, value, accent }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: accent + '15', color: accent }}
      >
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </span>
    </div>
    <p className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{value}</p>
  </div>
);

const PaginationButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button
    {...props}
    className={
      "w-9 h-9 flex items-center justify-center rounded-lg border transition-all active:scale-[0.95] " +
      "bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)] " +
      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--bg-base)]"
    }
  />
);

/* ═══════════════════════════════════════════════════════
   Icons (inline SVG)
   ═══════════════════════════════════════════════════════ */

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UnlockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const StripeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="6" fill="#635BFF" />
    <path d="M13.0 10.5c0-.9.7-1.2 1.8-1.2 1.6 0 3.6.5 5.2 1.4V6.4C18.4 5.5 16.7 5 14.8 5 10.5 5 7.5 7.2 7.5 10.8c0 5.6 7.7 4.7 7.7 7.1 0 1-.9 1.4-2.1 1.4-1.8 0-4.1-.7-5.9-1.8v4.3C8.9 22.6 10.8 23 12.7 23c4.4 0 7.5-2.1 7.5-5.8C20.2 11.5 13.0 12.6 13.0 10.5z" fill="white" />
  </svg>
);

export default AdminUserDetailPage;
