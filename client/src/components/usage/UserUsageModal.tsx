import React, { useState, useEffect, useMemo } from 'react';
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
} from '../../services/adminApi';
import Spinner from '../common/Spinner';
import CvPreviewModal from '../cv-editor/CvPreviewModal';
import CvDocumentRenderer from '../cv-editor/CvDocumentRenderer';
import ConfirmModal from '../common/ConfirmModal';

interface UserUsageModalProps {
 userId: string;
 onClose: () => void;
 onUpdate: () => void;
}

const UserUsageModal: React.FC<UserUsageModalProps> = ({ userId, onClose, onUpdate }) => {
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
 const [confirmModal, setConfirmModal] = useState<{
 show: boolean;
 title: string;
 message: string;
 onConfirm: () => void;
 danger?: boolean;
 confirmLabel?: string;
 }>({ show: false, title: '', message: '', onConfirm: () => {} });

 // Escape key handler
 useEffect(() => {
 const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
 document.addEventListener('keydown', handleEsc);
 return () => document.removeEventListener('keydown', handleEsc);
 }, [onClose]);

 useEffect(() => {
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

 const handlePreviewCv = async (cvId: string, mode: 'original' | 'current') => {
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

 const handleGrantCredits = async () => {
 setIsSubmitting(true);
 setActionError(null);
 try {
 await grantUserCredits(userId, grantAmount, grantReason);
 const updated = await getUserDetail(userId);
 setData(updated);
 onUpdate();
 } catch (err) {
 setActionError('Failed to grant credits');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleRoleChange = async (newRole: string) => {
 setActionError(null);
 try {
 await updateUserRole(userId, newRole);
 const updated = await getUserDetail(userId);
 setData(updated);
 onUpdate();
 } catch (err) {
 setActionError('Failed to update role');
 }
 };

 const handlePlanChange = async (newPlan: string) => {
 setActionError(null);
 try {
 await updateUserPlan(userId, newPlan);
 const updated = await getUserDetail(userId);
 setData(updated);
 onUpdate();
 } catch (err) {
 setActionError('Failed to update plan');
 }
 };

 const handleCancelSubscription = async () => {
 if (!data) return;
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
 await cancelUserSubscription(userId);
 const updated = await getUserDetail(userId);
 setData(updated);
 onUpdate();
 } catch (err) {
 setActionError('Failed to cancel subscription');
 } finally {
 setIsCancelling(false);
 }
 }
 });
 };

 const handleToggleBlock = async () => {
 if (!data) return;
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
 await setUserBlocked(userId, !data!.isBlocked);
 const updated = await getUserDetail(userId);
 setData(updated);
 onUpdate();
 } catch (err) {
 setActionError(`Failed to ${action} user`);
 } finally {
 setIsBlocking(false);
 }
 }
 });
 };

 if (!userId) return null;

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
 backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a1a1aa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
 backgroundRepeat: 'no-repeat',
 backgroundPosition: 'right 0.75rem center',
 paddingRight: '2.25rem',
 };

 return (
 <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
 <div
 className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
 style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
 role="dialog"
 aria-modal="true"
 aria-labelledby="modal-title"
 onClick={(e) => e.stopPropagation()}
 >
 {isLoading ? (
 <div className="p-20 text-center"><Spinner size="lg" /></div>
 ) : data ? (
 <>
 {/* Header */}
 <div
 className="px-6 py-5 flex items-start justify-between gap-4"
 style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-base)' }}
 >
 <div className="min-w-0">
 <h2 id="modal-title" className="text-base font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
 {data.username && <span className="mr-2">{data.username}</span>}
 <span className="font-normal text-sm" style={{ color: 'var(--text-secondary)' }}>{data.email}</span>
 </h2>
 <div className="flex items-center gap-2 mt-0.5">
 <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>ID: {data.id}</p>
 {data.isBlocked && (
 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-600">
 <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Blocked
 </span>
 )}
 </div>
 </div>
 <button
 onClick={onClose}
 aria-label="Close modal"
 className="shrink-0 p-1.5 rounded-lg transition-colors"
 style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
 >
 <CloseIcon />
 </button>
 </div>

 {/* Error Banner */}
 {actionError && (
 <div className="px-6 py-2.5 text-xs font-medium text-red-600 bg-red-50" style={{ borderBottom: '1px solid var(--border)' }}>
 {actionError}
 <button onClick={() => setActionError(null)} className="ml-2 underline hover:no-underline">Dismiss</button>
 </div>
 )}

 {/* Block / Unblock danger bar */}
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
? { backgroundColor: 'var(--jade-bg)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }
  : { backgroundColor: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }
 }
 >
 {isBlocking ? '…' : data.isBlocked ? 'Unblock User' : 'Block User'}
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 {/* Plan / Role / Verified row */}
 <div className="grid grid-cols-3 gap-4">
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
                        style={{ backgroundColor: data.emailVerified ? 'var(--jade)' : 'var(--accent)' }}
                      />
                      <span style={{ color: data.emailVerified ? 'var(--jade)' : 'var(--accent)' }}>
 {data.emailVerified ? 'Verified' : 'Unverified'}
 </span>
 </div>
 </div>
 </div>

 {/* Stripe Info */}
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
 style={{ color: 'var(--rose)', border: '1px solid rgba(200,32,20,0.25)', backgroundColor: 'transparent' }}
 >
 {isCancelling ? 'Cancelling…' : 'Cancel Subscription'}
 </button>
 )}
 </div>
 )}

 {/* Credit Management */}
 <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
 <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
 <CreditCardIcon /> Manage Credits
 </h3>
 <div className="flex items-end gap-3">
 <div className="rounded-xl px-4 py-3 shrink-0" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
 <p className="text-[10px] uppercase font-black tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Remaining</p>
 <p className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{data.usage.usage.remaining}</p>
 </div>
 <div className="flex-1 space-y-1.5">
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
 {isSubmitting ? 'Granting…' : 'Grant Credits'}
 </button>
 </div>
 </div>

 {/* Usage History */}
 <div className="space-y-3">
 <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
 <ActivityIcon /> Usage History
 </h3>
 <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
 <table className="w-full text-left text-xs">
 <thead style={{ backgroundColor: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
 <tr>
 <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Action Type</th>
 <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Consumed</th>
 <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Time</th>
 </tr>
 </thead>
 <tbody>
 {data.usage.actions.map((action: any, idx: number) => (
 <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
 <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{action.type}</td>
 <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{action.consumed}</td>
 <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{new Date(action.timestamp).toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 {data.usage.actions.length === 0 && (
 <p className="text-center py-10 text-sm italic" style={{ color: 'var(--text-muted)' }}>No usage history found.</p>
 )}
 </div>
 </div>

 {/* CV Library */}
 <div className="space-y-3">
 <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
 <span className="material-symbols-outlined text-base">description</span>
 CV Library
 </h3>
 <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
 {isLoadingCvLibrary ? (
 <div className="p-6 flex items-center justify-center">
 <Spinner size="md" />
 </div>
 ) : cvLibrary.length === 0 ? (
 <p className="text-center py-10 text-sm italic" style={{ color: 'var(--text-muted)' }}>
 No base CVs found for this user.
 </p>
 ) : (
 <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
 {cvLibrary.map((cv) => (
 <div key={cv.id} className="px-4 py-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--bg-base)' }}>
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
 {cv.displayName || 'Untitled CV'}
 </span>
 {cv.isDefault && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
 Default
 </span>
 )}
 {cv.category && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
 {cv.category}
 </span>
 )}
 </div>
 <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
 {cv.filename && <span>{cv.filename}</span>}
 <span>Created: {new Date(cv.createdAt).toLocaleDateString()}</span>
 <span>Updated: {new Date(cv.updatedAt).toLocaleDateString()}</span>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => handlePreviewCv(cv.id, 'original')}
 disabled={!cv.hasOriginalSnapshot || isPreviewLoading}
 className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
 style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
 >
 {isPreviewLoading ? 'Loading...' : 'Preview Original'}
 </button>
 <button
 type="button"
 onClick={() => handlePreviewCurrentTemplate(cv.id)}
 disabled={isTemplatePreviewLoading}
 className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
 style={{ backgroundColor: 'var(--accent)', color: '#0e0e17' }}
 >
 {isTemplatePreviewLoading ? 'Loading...' : 'Preview Current'}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </>
 ) : (
 <div className="p-20 text-center" style={{ color: 'var(--text-muted)' }}>User not found.</div>
 )}
 </div>
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
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }} className="px-4 py-2 rounded hover:bg-[var(--accent-hover)]"
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

// --- Icons ---
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

export default UserUsageModal;
