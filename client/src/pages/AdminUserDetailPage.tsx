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
import InPlaceCvEditor from '../components/cv-editor/InPlaceCvEditor';
import { TableOrCards } from '../components/common/TableOrCards';
import ConfirmModal from '../components/common/ConfirmModal';

const USAGE_PAGE_SIZE = 10;
const CV_PAGE_SIZE = 5;

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
                if (!isMounted) return;
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

    if (!userId) {
        return (
            <div className="space-y-6">
                <Link to="/admin/users" className="text-sm font-semibold text-primary-color">
                    Back to users
                </Link>
                <div className="rounded-2xl border border-theme bg-surface p-8">
                    <p className="text-sm text-zinc-500">No user selected.</p>
                </div>
            </div>
        );
    }

    const selectStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '0.625rem',
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
        fontWeight: 600,
        padding: '0.55rem 0.875rem',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a1a1aa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        paddingRight: '2.25rem',
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link to="/admin/users" className="text-sm font-semibold text-primary-color">
                        Back to users
                    </Link>
                    <h1 className="text-3xl font-bold text-primary-color font-display mt-2">User Details</h1>
                    <p className="text-zinc-500 mt-1">Manage access, usage, and CV previews.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-surface rounded-3xl border border-theme shadow-sm min-h-[400px] flex items-center justify-center">
                    <Spinner size="lg" />
                </div>
            ) : data ? (
                <div className="rounded-3xl border border-theme bg-surface shadow-sm overflow-hidden">
                    <div
                        className="px-6 py-5 flex items-start justify-between gap-4"
                        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-base)' }}
                    >
                        <div className="min-w-0">
                            <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Fraunces, Georgia, serif' }}>
                                {data.username && <span className="mr-2">{data.username}</span>}
                                <span className="font-normal text-sm" style={{ color: 'var(--text-secondary)' }}>{data.email}</span>
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>ID: {data.id}</p>
                                {data.isBlocked && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Blocked
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {actionError && (
                        <div className="px-6 py-2.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" style={{ borderBottom: '1px solid var(--border)' }}>
                            {actionError}
                            <button onClick={() => setActionError(null)} className="ml-2 underline hover:no-underline">Dismiss</button>
                        </div>
                    )}

                    <div
                        className="px-6 py-3 flex items-center justify-between gap-4"
                        style={{ borderBottom: '1px solid var(--border)', backgroundColor: data.isBlocked ? 'rgba(220,38,38,0.06)' : 'transparent' }}
                    >
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {data.isBlocked
                                ? 'This user is currently blocked and cannot log in.'
                                : 'Block this user to prevent them from logging in.'}
                        </p>
                        <button
                            onClick={handleToggleBlock}
                            disabled={isBlocking}
                            aria-label={data.isBlocked ? "Unblock user" : "Block user"}
                            className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                            style={data.isBlocked
                                ? { backgroundColor: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }
                                : { backgroundColor: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }
                            }
                        >
                            {isBlocking ? '...' : data.isBlocked ? 'Unblock User' : 'Block User'}
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Plan</p>
                                <div className="relative">
                                    <select
                                        value={data.plan}
                                        onChange={(e) => handlePlanChange(e.target.value)}
                                        aria-label="Change user plan"
                                        style={selectStyle}
                                    >
                                        <option value="free">Free</option>
                                        <option value="starter">Starter</option>
                                        <option value="pro">Pro</option>
                                        <option value="premium">Premium</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Role</p>
                                <div className="relative">
                                    <select
                                        value={data.role}
                                        onChange={(e) => handleRoleChange(e.target.value)}
                                        aria-label="Change user role"
                                        style={selectStyle}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Email</p>
                                <div
                                    className="rounded-[0.625rem] px-3 py-[0.55rem] text-sm font-semibold flex items-center gap-1.5"
                                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                                >
                                    <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: data.emailVerified ? 'var(--jade, #2dd4a0)' : 'var(--accent)' }}
                                    />
                                    <span style={{ color: data.emailVerified ? 'var(--jade, #2dd4a0)' : 'var(--accent)' }}>
                                        {data.emailVerified ? 'Verified' : 'Unverified'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {(data.stripeCustomerId || data.stripeSubscriptionId) && (
                            <div
                                className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
                                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                            >
                                <StripeIcon />
                                {data.stripeCustomerId && (
                                    <a
                                        href={`https://dashboard.stripe.com/customers/${data.stripeCustomerId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-mono hover:underline"
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
                                        className="ml-auto px-3 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                        style={{ color: 'var(--rose, #f46464)', border: '1px solid rgba(244,100,100,0.25)', backgroundColor: 'transparent' }}
                                    >
                                        {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <CreditCardIcon /> Manage Credits
                            </h3>
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="rounded-xl px-4 py-3 shrink-0" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                                    <p className="text-[10px] uppercase font-black tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Remaining</p>
                                    <p className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{data.usage.usage.remaining}</p>
                                </div>
                                <div className="flex-1 space-y-1.5 min-w-[200px]">
                                    <label className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>Amount to grant</label>
                                    <input
                                        type="number"
                                        value={grantAmount}
                                        onChange={(e) => setGrantAmount(parseInt(e.target.value))}
                                        className="w-full rounded-[0.625rem] px-3 py-[0.55rem] text-sm outline-none transition-all"
                                        style={{
                                            backgroundColor: 'var(--bg-base)',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    />
                                </div>
                                <button
                                    onClick={handleGrantCredits}
                                    disabled={isSubmitting}
                                    aria-label="Grant credits"
                                    className="px-5 py-[0.55rem] rounded-[0.625rem] text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
                                    style={{ backgroundColor: 'var(--accent)', color: '#0e0e17' }}
                                >
                                    {isSubmitting ? 'Granting...' : 'Grant Credits'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <ActivityIcon /> Usage History
                            </h3>
                            <TableOrCards
                                data={pagedUsage}
                                columns={[
                                    {
                                        key: 'type',
                                        label: 'Action Type',
                                        render: (action: any) => (
                                            <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{action.type}</span>
                                        )
                                    },
                                    {
                                        key: 'consumed',
                                        label: 'Consumed',
                                        render: (action: any) => (
                                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{action.consumed}</span>
                                        )
                                    },
                                    {
                                        key: 'timestamp',
                                        label: 'Time',
                                        render: (action: any) => (
                                            <span style={{ color: 'var(--text-muted)' }}>{new Date(action.timestamp).toLocaleString()}</span>
                                        )
                                    }
                                ]}
                                cardConfig={
                                    {
                                        title: (action: any) => action.type,
                                        subtitle: (action: any) => new Date(action.timestamp).toLocaleString(),
                                        fields: [
                                            {
                                                label: 'Consumed',
                                                value: (action: any) => action.consumed
                                            }
                                        ]
                                    }
                                }
                                emptyMessage="No usage history found."
                            />
                            {usageActions.length > USAGE_PAGE_SIZE && (
                                <div className="flex flex-wrap items-center justify-between text-sm">
                                    <p className="text-zinc-500">
                                        Showing <span className="font-semibold text-primary-color">{usageStartItem}-{usageEndItem}</span> of <span className="font-semibold text-primary-color">{usageActions.length}</span> actions
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setUsagePage(p => Math.max(1, p - 1))}
                                            disabled={usagePage === 1}
                                            aria-label="Previous usage page"
                                            className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-3 py-2 text-zinc-500 font-mono text-xs">{usagePage} / {usageTotalPages}</span>
                                        <button
                                            onClick={() => setUsagePage(p => Math.min(usageTotalPages, p + 1))}
                                            disabled={usagePage === usageTotalPages}
                                            aria-label="Next usage page"
                                            className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <span className="material-symbols-outlined text-base">description</span>
                                CV Library
                            </h3>
                            {isLoadingCvLibrary ? (
                                <div className="p-6 flex items-center justify-center">
                                    <Spinner size="md" />
                                </div>
                            ) : (
                                <TableOrCards
                                    data={pagedCvLibrary}
                                    columns={[
                                        {
                                            key: 'displayName',
                                            label: 'CV',
                                            render: (cv: UserCvSummary) => (
                                                <div className="flex flex-col">
                                                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cv.displayName || 'Untitled CV'}</span>
                                                    {cv.filename && (
                                                        <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{cv.filename}</span>
                                                    )}
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'category',
                                            label: 'Category',
                                            render: (cv: UserCvSummary) => (
                                                <span style={{ color: 'var(--text-secondary)' }}>{cv.category || 'General'}</span>
                                            )
                                        },
                                        {
                                            key: 'createdAt',
                                            label: 'Created',
                                            render: (cv: UserCvSummary) => (
                                                <span style={{ color: 'var(--text-muted)' }}>{new Date(cv.createdAt).toLocaleDateString()}</span>
                                            ),
                                            mobileHidden: true
                                        },
                                        {
                                            key: 'updatedAt',
                                            label: 'Updated',
                                            render: (cv: UserCvSummary) => (
                                                <span style={{ color: 'var(--text-muted)' }}>{new Date(cv.updatedAt).toLocaleDateString()}</span>
                                            ),
                                            mobileHidden: true
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
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                                    >
                                                        Preview Original
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePreviewCurrentTemplate(cv.id)}
                                                        disabled={isTemplatePreviewLoading}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                        style={{ backgroundColor: 'var(--accent)', color: '#0e0e17' }}
                                                    >
                                                        Preview Current
                                                    </button>
                                                </div>
                                            )
                                        }
                                    ]}
                                    cardConfig={{
                                        title: (cv: UserCvSummary) => cv.displayName || 'Untitled CV',
                                        subtitle: (cv: UserCvSummary) => cv.filename || 'No filename',
                                        badge: (cv: UserCvSummary) => cv.isPrimary
                                            ? { text: 'Primary', className: 'bg-blue-100 text-blue-700' }
                                            : null,
                                        fields: [
                                            {
                                                label: 'Category',
                                                value: (cv: UserCvSummary) => cv.category || 'General'
                                            },
                                            {
                                                label: 'Created',
                                                value: (cv: UserCvSummary) => new Date(cv.createdAt).toLocaleDateString()
                                            },
                                            {
                                                label: 'Updated',
                                                value: (cv: UserCvSummary) => new Date(cv.updatedAt).toLocaleDateString()
                                            }
                                        ],
                                        actions: (cv: UserCvSummary) => (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handlePreviewCv(cv.id, 'original')}
                                                    disabled={!cv.hasOriginalSnapshot || isPreviewLoading}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                                >
                                                    Preview Original
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePreviewCurrentTemplate(cv.id)}
                                                    disabled={isTemplatePreviewLoading}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                    style={{ backgroundColor: 'var(--accent)', color: '#0e0e17' }}
                                                >
                                                    Preview Current
                                                </button>
                                            </div>
                                        )
                                    }}
                                    emptyMessage="No base CVs found for this user."
                                />
                            )}
                            {cvLibrary.length > CV_PAGE_SIZE && (
                                <div className="flex flex-wrap items-center justify-between text-sm">
                                    <p className="text-zinc-500">
                                        Showing <span className="font-semibold text-primary-color">{cvStartItem}-{cvEndItem}</span> of <span className="font-semibold text-primary-color">{cvLibrary.length}</span> CVs
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCvPage(p => Math.max(1, p - 1))}
                                            disabled={cvPage === 1}
                                            aria-label="Previous CV page"
                                            className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-3 py-2 text-zinc-500 font-mono text-xs">{cvPage} / {cvTotalPages}</span>
                                        <button
                                            onClick={() => setCvPage(p => Math.min(cvTotalPages, p + 1))}
                                            disabled={cvPage === cvTotalPages}
                                            aria-label="Next CV page"
                                            className="px-4 py-2 bg-surface border border-theme rounded-xl font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-theme bg-surface p-8">
                    <p className="text-sm text-zinc-500">User not found.</p>
                </div>
            )}

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
                        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                    Current CV Preview
                                </h2>
                                {templatePreviewCv?.displayName && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {templatePreviewCv.displayName}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setIsTemplatePreviewOpen(false)}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
                            <div className="flex-1 overflow-y-auto border dark:border-gray-700 rounded-lg">
                                <InPlaceCvEditor
                                    value={templatePreviewCv.cvJson}
                                    readonly={true}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-gray-600 dark:text-gray-400">No preview available</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 mt-4">
                            <button
                                onClick={() => setIsTemplatePreviewOpen(false)}
                                className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700"
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

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const CreditCardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const ActivityIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const StripeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="6" fill="#635BFF"/>
        <path d="M13.0 10.5c0-.9.7-1.2 1.8-1.2 1.6 0 3.6.5 5.2 1.4V6.4C18.4 5.5 16.7 5 14.8 5 10.5 5 7.5 7.2 7.5 10.8c0 5.6 7.7 4.7 7.7 7.1 0 1-.9 1.4-2.1 1.4-1.8 0-4.1-.7-5.9-1.8v4.3C8.9 22.6 10.8 23 12.7 23c4.4 0 7.5-2.1 7.5-5.8C20.2 11.5 13.0 12.6 13.0 10.5z" fill="white"/>
    </svg>
);

export default AdminUserDetailPage;
