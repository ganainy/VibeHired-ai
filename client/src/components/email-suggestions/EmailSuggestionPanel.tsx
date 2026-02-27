// client/src/components/email-suggestions/EmailSuggestionPanel.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    listPendingSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    pollNow,
    getGmailScopeStatus,
    type EmailSuggestion,
} from '../../services/emailSuggestionsApi';
import { getGoogleConnectUrl } from '../../services/googleCalendarApi';

// ── Icons ────────────────────────────────────────────────────────────────────

const InboxIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
);

const CheckIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const XIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={spinning ? { animation: 'spin 1s linear infinite' } : undefined}
    >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
);

const LinkIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    Interview: '#3b82f6',
    Assessment: '#a855f7',
    Rejected: '#ef4444',
    Offer: '#22c55e',
};

const CONFIDENCE_LABELS: Record<string, string> = {
    high: '● High confidence',
    medium: '◑ Medium confidence',
    low: '○ Low confidence',
};

function StatusPill({ status }: { status: string | null }) {
    if (!status) return null;
    const color = STATUS_COLORS[status] ?? 'var(--text-muted)';
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                color, backgroundColor: `${color}18`, border: `1px solid ${color}38`,
            }}
        >
            {status}
        </span>
    );
}

// ── Main Panel Component ──────────────────────────────────────────────────────

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onJobUpdated?: () => void;
}

const EmailSuggestionPanel: React.FC<Props> = ({ isOpen, onClose, onJobUpdated }) => {
    const [suggestions, setSuggestions] = useState<EmailSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [polling, setPolling] = useState(false);
    const [actionIds, setActionIds] = useState<Set<string>>(new Set());
    const [hasScope, setHasScope] = useState<boolean | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [data, scopeResult] = await Promise.all([
                listPendingSuggestions(),
                getGmailScopeStatus(),
            ]);
            setSuggestions(data);
            setHasScope(scopeResult.hasScope);
        } catch {
            // swallow — panel might open before auth is confirmed
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen, load]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleAccept = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(s._id));
        try {
            await acceptSuggestion(s._id);
            setSuggestions((prev) => prev.filter((x) => x._id !== s._id));
            showToast(`Status updated to "${s.suggestedStatus}" for ${s.matchedCompanyName ?? 'job'}`);
            onJobUpdated?.();
        } catch {
            showToast('Failed to apply suggestion. Please try again.');
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        }
    };

    const handleReject = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(s._id));
        try {
            await rejectSuggestion(s._id);
            setSuggestions((prev) => prev.filter((x) => x._id !== s._id));
        } catch {
            showToast('Failed to dismiss. Please try again.');
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        }
    };

    const handlePoll = async () => {
        setPolling(true);
        try {
            const result = await pollNow(14);
            await load();
            showToast(result.count > 0 ? `Found ${result.count} new suggestion(s)!` : 'No new emails found.');
        } catch {
            showToast('Poll failed. Check your Gmail connection.');
        } finally {
            setPolling(false);
        }
    };

    const handleConnectGmail = async () => {
        try {
            const url = await getGoogleConnectUrl();
            window.location.href = url;
        } catch {
            showToast('Failed to start Gmail connection.');
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                style={{ animation: 'fadeIn 150ms ease' }}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
                style={{
                    width: 'min(420px, 100vw)',
                    backgroundColor: 'var(--bg-surface)',
                    borderLeft: '1px solid var(--border)',
                    boxShadow: '-12px 0 40px rgba(0,0,0,0.25)',
                    animation: 'slideInRight 200ms ease',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <span style={{ color: 'var(--accent)' }}><InboxIcon /></span>
                        <div>
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Email Suggestions
                            </h2>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                AI-detected status changes from your inbox
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePoll}
                            disabled={polling}
                            title="Check Gmail now"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{
                                backgroundColor: 'var(--bg-elevated)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                opacity: polling ? 0.6 : 1,
                            }}
                        >
                            <RefreshIcon spinning={polling} />
                            {polling ? 'Checking…' : 'Check now'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <XIcon />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {/* No Gmail scope — prompt to reconnect */}
                    {hasScope === false && (
                        <div
                            className="rounded-xl p-4 text-sm"
                            style={{
                                backgroundColor: 'rgba(251,191,36,0.08)',
                                border: '1px solid rgba(251,191,36,0.25)',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                                Gmail access not granted
                            </p>
                            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                Reconnect your Google account to allow reading your inbox. Your existing Calendar connection will be preserved.
                            </p>
                            <button
                                onClick={handleConnectGmail}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{
                                    backgroundColor: 'var(--accent)',
                                    color: '#000',
                                }}
                            >
                                <LinkIcon />
                                Connect Gmail
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div
                                className="w-6 h-6 rounded-full border-2 border-t-transparent"
                                style={{
                                    borderColor: 'var(--border)',
                                    borderTopColor: 'var(--accent)',
                                    animation: 'spin 0.8s linear infinite',
                                }}
                            />
                        </div>
                    )}

                    {!loading && suggestions.length === 0 && hasScope !== false && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                            >
                                <InboxIcon />
                            </div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                No pending suggestions
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Click "Check now" to scan for new emails
                            </p>
                        </div>
                    )}

                    {!loading && suggestions.map((s) => {
                        const busy = actionIds.has(s._id);
                        const job = s.jobApplicationId as any;
                        return (
                            <div
                                key={s._id}
                                className="rounded-xl p-4"
                                style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)',
                                    opacity: busy ? 0.55 : 1,
                                    transition: 'opacity 150ms',
                                }}
                            >
                                {/* Company / status row */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                            {s.matchedCompanyName || s.senderName || 'Unknown sender'}
                                        </p>
                                        {s.matchedJobTitle && (
                                            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {s.matchedJobTitle}
                                            </p>
                                        )}
                                    </div>
                                    {s.suggestedStatus && <StatusPill status={s.suggestedStatus} />}
                                </div>

                                {/* Subject */}
                                <p className="text-[12px] mb-2 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Subject: </span>{s.emailSubject}
                                </p>

                                {/* Snippet */}
                                <p
                                    className="text-[11.5px] leading-relaxed line-clamp-3 mb-3"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    {s.emailSnippet}
                                </p>

                                {/* Note preview */}
                                {s.suggestedNote && (
                                    <p
                                        className="text-[11px] mb-3 px-2.5 py-1.5 rounded-lg"
                                        style={{
                                            backgroundColor: 'rgba(232,184,68,0.07)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid rgba(232,184,68,0.15)',
                                        }}
                                    >
                                        Note: {s.suggestedNote}
                                    </p>
                                )}

                                {/* Job match indicator */}
                                {!job && (
                                    <p className="text-[11px] mb-2" style={{ color: 'rgba(251,191,36,0.8)' }}>
                                        ⚠ No matching job found — status won't be applied
                                    </p>
                                )}
                                {job && (
                                    <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                                        → Matched: <span style={{ color: 'var(--text-secondary)' }}>{job.companyName} — {job.jobTitle}</span>
                                        {' '}({job.status})
                                    </p>
                                )}

                                {/* Confidence + actions */}
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                                        {CONFIDENCE_LABELS[s.confidence]}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReject(s)}
                                            disabled={busy}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                                            style={{
                                                backgroundColor: 'rgba(244,100,100,0.07)',
                                                color: 'var(--rose, #f46464)',
                                                border: '1px solid rgba(244,100,100,0.18)',
                                            }}
                                        >
                                            <XIcon /> Dismiss
                                        </button>
                                        {s.suggestedStatus && (
                                            <button
                                                onClick={() => handleAccept(s)}
                                                disabled={busy}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    backgroundColor: 'var(--accent)',
                                                    color: '#000',
                                                }}
                                            >
                                                <CheckIcon /> Apply
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div
                    className="fixed bottom-5 right-5 z-[60] px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 200ms ease',
                    }}
                >
                    {toast}
                </div>
            )}

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to   { transform: translateX(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

export default EmailSuggestionPanel;
