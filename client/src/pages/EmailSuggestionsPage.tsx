// client/src/pages/EmailSuggestionsPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import Spinner from '../components/common/Spinner';
import { useAuth } from '../context/AuthContext';
import { parseApiError, parseApiErrorMessage } from '../utils/parseApiError';
import { PAYMENTS_ENABLED } from '../utils/featureFlags';
import {
    listPendingSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    addNoteSuggestion,
    pollNow,
    getGmailScopeStatus,
    getPreferences,
    updatePreferences,
    type EmailSuggestion,
    type PollNowResult,
} from '../services/emailSuggestionsApi';
import { getGoogleConnectUrl } from '../services/googleCalendarApi';
import EditSuggestionModal from '../components/email-suggestions/EditSuggestionModal';

// ── Icons ─────────────────────────────────────────────────────────────────────

const InboxIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
);

const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const XIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={spinning ? { animation: 'spin 0.9s linear infinite' } : undefined}
    >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
);

const SparkleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
);

const LinkIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);

const MailIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const BoltIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const NoteIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);

const GmailLinkIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {/* envelope — offset left/down so the arrow doesn't overlap */}
        <rect x="1" y="9" width="14" height="12" rx="1.5" />
        <polyline points="1 10 8 15 15 10" />
        {/* external-link arrow — top-right corner, clear of the envelope */}
        <polyline points="15 3 21 3 21 9" />
        <line x1="12" y1="11" x2="21" y2="3" />
    </svg>
);

function formatCalEventDate(iso: string | null | undefined): string {
    if (!iso) return 'Date not specified';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Date not specified';
    try {
        return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso;
    }
}

function formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    Interview: '#3b82f6',
    Assessment: '#a855f7',
    Rejected: '#ef4444',
    Offer: '#22c55e',
};

const CONFIDENCE_COLORS: Record<string, string> = {
    high: '#22c55e',
    medium: '#f59e0b',
    low: '#ef4444',
};

function ConfidencePill({ confidence }: { confidence: string }) {
    const color = CONFIDENCE_COLORS[confidence] ?? 'var(--text-muted)';
    const label = confidence ? `AI confidence: ${confidence.charAt(0).toUpperCase() + confidence.slice(1)}` : 'AI confidence: ?';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
            color, backgroundColor: `${color}15`, border: `1px solid ${color}30`,
        }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
            {label}
        </span>
    );
}

function StatusPill({ status }: { status: string | null }) {
    if (!status) return null;
    const color = STATUS_COLORS[status] ?? 'var(--text-muted)';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            color, backgroundColor: `${color}15`, border: `1px solid ${color}35`,
            letterSpacing: '0.02em',
        }}>
            {status}
        </span>
    );
}

// ── How it works steps ────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
    {
        icon: MailIcon,
        title: 'Reads your Gmail',
        description: 'When you trigger a scan, the server reads your inbox for new unread emails that look like job application responses.',
    },
    {
        icon: SparkleIcon,
        title: 'AI classifies intent',
        description: 'Your configured AI model reads each email and determines whether it represents a rejection, interview invitation, assessment, or offer.',
    },
    {
        icon: BoltIcon,
        title: 'Matches to your jobs',
        description: 'The parsed company name and role are fuzzy-matched against your tracked applications to find the right one.',
    },
    {
        icon: ShieldIcon,
        title: 'You confirm each change',
        description: 'Nothing is applied automatically. You review each suggestion and click Apply — or Dismiss if it\'s wrong.',
    },
];

function buildPollToast(r: PollNowResult): string {
    if (r.scanned === 0) return 'No new emails to scan.';
    const scannedPart = `Scanned ${r.scanned} email${r.scanned !== 1 ? 's' : ''}`;
    if ((r.applicationResponses + r.jobLeads) === 0) return `${scannedPart} — no job-related emails found.`;
    const parts: string[] = [];
    if (r.applicationResponses > 0) parts.push(`${r.applicationResponses} application response${r.applicationResponses !== 1 ? 's' : ''}`);
    if (r.jobLeads > 0) parts.push(`${r.jobLeads} job lead${r.jobLeads !== 1 ? 's' : ''}`);
    return `${scannedPart} — found ${parts.join(' and ')}.`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EmailSuggestionsPage: React.FC = () => {
    const { refreshUsage } = useAuth();
    const [suggestions, setSuggestions] = useState<EmailSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [actionIds, setActionIds] = useState<Set<string>>(new Set());
    const [hasScope, setHasScope] = useState<boolean | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [actionError, setActionError] = useState<{ message: string; upgrade?: boolean } | null>(null);
    const [scanLimit, setScanLimit] = useState(25);
    const [autoPollApplications, setAutoPollApplications] = useState(true);
    const [autoPollJobLeads, setAutoPollJobLeads] = useState(true);
    const [calendarUnchecked, setCalendarUnchecked] = useState<Set<string>>(new Set());
    const [noteAddedLocally, setNoteAddedLocally] = useState<Set<string>>(new Set());
    const [editingSuggestion, setEditingSuggestion] = useState<EmailSuggestion | null>(null);
    const [howItWorksOpen, setHowItWorksOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('emailSuggestions.howItWorksOpen') === 'true'; }
        catch { return false; }
    });
    const [activeTab, setActiveTab] = useState<'application_response' | 'job_offer'>(() => {
        try { return (localStorage.getItem('emailSuggestions.activeTab') as any) || 'application_response'; }
        catch { return 'application_response'; }
    });

    const [settingsOpen, setSettingsOpen] = useState(false);

    const switchTab = (tab: 'application_response' | 'job_offer') => {
        setActiveTab(tab);
        try { localStorage.setItem('emailSuggestions.activeTab', tab); } catch { }
    };

    const toggleHowItWorks = () => setHowItWorksOpen((v) => {
        const next = !v;
        try { localStorage.setItem('emailSuggestions.howItWorksOpen', String(next)); } catch { }
        return next;
    });

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [data, scopeResult, prefs] = await Promise.all([
                listPendingSuggestions(),
                getGmailScopeStatus(),
                getPreferences(),
            ]);
            setSuggestions(data);
            setHasScope(scopeResult.hasScope);
            setScanLimit(prefs.scanLimit ?? 25);
            setAutoPollApplications(prefs.autoPollApplications ?? true);
            setAutoPollJobLeads(prefs.autoPollJobLeads ?? true);
            setNoteAddedLocally(new Set(data.filter((s) => s.noteAdded).map((s) => s._id)));
        } catch {
            // non-fatal
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAccept = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(s._id));
        try {
            const includeCalendarEvent = !calendarUnchecked.has(s._id);
            const result = await acceptSuggestion(s._id, { includeCalendarEvent, includeEmailLink: true });
            setSuggestions((prev) => prev.filter((x) => x._id !== s._id));
            if (result.calendarWarning) {
                showToast(result.calendarWarning, 'err');
            } else if (s.suggestedStatus) {
                showToast(
                    `Status updated to "${s.suggestedStatus}" for ${s.matchedCompanyName ?? 'job'}.` +
                    (result.calendarEventCreated ? ' · Calendar event created.' : ''),
                    'ok'
                );
            } else if (result.calendarEventCreated) {
                showToast(`Calendar event created for ${s.matchedCompanyName ?? 'job'}.`);
            } else {
                showToast(`Suggestion accepted for ${s.matchedCompanyName ?? 'job'}.`);
            }
        } catch (err: any) {
            setActionError(parseApiError(err));
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        }
    };

    const handleAddNote = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(`note-${s._id}`));
        try {
            await addNoteSuggestion(s._id, { includeEmailLink: true });
            setNoteAddedLocally((prev) => new Set(prev).add(s._id));
            showToast(`Note added to ${s.matchedCompanyName ?? 'job'}.`);
        } catch (err: any) {
            setActionError(parseApiError(err));
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(`note-${s._id}`); return n; });
        }
    };

    const handleReject = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(s._id));
        try {
            await rejectSuggestion(s._id);
            setSuggestions((prev) => prev.filter((x) => x._id !== s._id));
        } catch (err: any) {
            setActionError(parseApiError(err));
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        }
    };

    const handleEditSave = (updated: EmailSuggestion) => {
        setSuggestions((prev) => prev.map((s) => s._id === updated._id ? updated : s));
        setEditingSuggestion(null);
        showToast('Suggestion updated successfully.');
    };

    const handlePoll = async () => {
        setPolling(true);
        try {
            const result = await pollNow(scanLimit);
            await load();
            showToast(buildPollToast(result));
            try { await refreshUsage(); } catch { /* non-fatal */ }
        } catch (err: any) {
            const parsed = parseApiError(err);
            if (parsed.code === 'GMAIL_AUTH_EXPIRED') {
                setHasScope(false);
                setActionError({ message: parsed.message });
            } else {
                setActionError(parsed);
            }
        } finally {
            setPolling(false);
        }
    };

    const handleScanLimitChange = async (value: number) => {
        setScanLimit(value);
        try {
            await updatePreferences({ scanLimit: value });
        } catch {
            // non-fatal - preference not saved but UI still works
        }
    };

    const handleAutoPollApplicationsChange = async (value: boolean) => {
        setAutoPollApplications(value);
        try {
            await updatePreferences({ autoPollApplications: value });
        } catch {
            setAutoPollApplications(!value); // revert on failure
        }
    };

    const handleAutoPollJobLeadsChange = async (value: boolean) => {
        setAutoPollJobLeads(value);
        try {
            await updatePreferences({ autoPollJobLeads: value });
        } catch {
            setAutoPollJobLeads(!value); // revert on failure
        }
    };


    const handleConnectGmail = async () => {
        try {
            const url = await getGoogleConnectUrl();
            window.location.href = url;
        } catch (err: any) {
            setActionError({ message: parseApiErrorMessage(err) });
        }
    };

    return (
        <div style={{ background: 'var(--bg-base)' }}>
            <div className="max-w-3xl mx-auto px-4 md:px-6">
                <div className="py-6 md:py-8 pb-16 space-y-5">

                    {/* ── Page header ── */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <h1
                                    className="text-2xl font-semibold tracking-tight"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Inbox
                                </h1>
                                {suggestions.length > 0 && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                                        style={{ background: 'var(--accent)', color: '#000' }}
                                    >
                                        {suggestions.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Settings gear */}
                                <button
                                    type="button"
                                    onClick={() => setSettingsOpen((v) => !v)}
                                    title="Scan settings"
                                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                                    style={{
                                        background: settingsOpen ? 'var(--bg-elevated)' : 'transparent',
                                        border: `1px solid ${settingsOpen ? 'var(--border)' : 'var(--border-subtle)'}`,
                                        color: settingsOpen ? 'var(--text-secondary)' : 'var(--text-muted)',
                                    }}
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                                    </svg>
                                </button>
                                {/* Scan button */}
                                <button
                                    onClick={handlePoll}
                                    disabled={polling}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <RefreshIcon spinning={polling} />
                                    {polling ? `Scanning last ${scanLimit} emails…` : 'Scan inbox'}
                                    {!polling && <span className="text-[10px] font-bold ml-0.5 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>1 cr</span>}
                                </button>
                            </div>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            AI-detected status changes from your job application emails. Review before applying.
                        </p>
                    </div>

                    {/* ── Settings panel ── */}
                    {settingsOpen && (
                        <div className="card px-3 py-2 sm:px-4 sm:py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Scan</span>
                                <select
                                    value={scanLimit}
                                    onChange={(e) => handleScanLimitChange(Number(e.target.value))}
                                    className="input-base !w-auto text-sm"
                                >
                                    <option value={25}>Last 25 emails</option>
                                    <option value={50}>Last 50 emails</option>
                                    <option value={100}>Last 100 emails</option>
                                    <option value={200}>Last 200 emails</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <button
                                    role="switch"
                                    aria-checked={autoPollApplications}
                                    onClick={() => handleAutoPollApplicationsChange(!autoPollApplications)}
                                    className="relative shrink-0 transition-colors"
                                    style={{
                                        width: 32, height: 18, borderRadius: 99,
                                        background: autoPollApplications ? 'var(--accent)' : 'var(--bg-elevated)',
                                        border: `1px solid ${autoPollApplications ? 'var(--accent)' : 'var(--border)'}`,
                                    }}
                                >
                                    <span
                                        style={{
                                            position: 'absolute', top: 2,
                                            left: autoPollApplications ? 14 : 2,
                                            width: 12, height: 12, borderRadius: '50%',
                                            background: autoPollApplications ? '#000' : 'var(--text-muted)',
                                            transition: 'left 150ms',
                                        }}
                                    />
                                </button>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Auto-scan applications</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <button
                                    role="switch"
                                    aria-checked={autoPollJobLeads}
                                    onClick={() => handleAutoPollJobLeadsChange(!autoPollJobLeads)}
                                    className="relative shrink-0 transition-colors"
                                    style={{
                                        width: 32, height: 18, borderRadius: 99,
                                        background: autoPollJobLeads ? 'var(--accent)' : 'var(--bg-elevated)',
                                        border: `1px solid ${autoPollJobLeads ? 'var(--accent)' : 'var(--border)'}`,
                                    }}
                                >
                                    <span
                                        style={{
                                            position: 'absolute', top: 2,
                                            left: autoPollJobLeads ? 14 : 2,
                                            width: 12, height: 12, borderRadius: '50%',
                                            background: autoPollJobLeads ? '#000' : 'var(--text-muted)',
                                            transition: 'left 150ms',
                                        }}
                                    />
                                </button>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Auto-scan job leads</span>
                            </label>
                            <p className="text-[11px] ml-auto hidden md:block" style={{ color: 'var(--text-muted)' }}>
                                Processed emails are labelled{' '}
                                <code style={{ fontSize: 10, padding: '0 4px', borderRadius: 3, background: 'var(--bg-elevated)' }}>vibe-hired-processed</code>{' '}
                                in Gmail
                            </p>
                        </div>
                    )}

                    {/* ── How it works (collapsed by default) ── */}
                    <div>
                        <button
                            type="button"
                            onClick={toggleHowItWorks}
                            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                            style={{ color: 'var(--accent)' }}
                        >
                            <svg
                                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                style={{ transform: howItWorksOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms' }}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                            {howItWorksOpen ? 'Hide' : 'How does this work?'}
                        </button>
                        {howItWorksOpen && (
                            <div className="card mt-3 p-3 sm:p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {HOW_IT_WORKS.map((step, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div
                                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                                                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                            >
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="text-[12.5px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                                                <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Gmail not connected ── */}
                    {hasScope === false && (
                        <div
                            className="flex items-center gap-3 px-4 py-3 rounded-xl"
                            style={{
                                background: 'rgba(251,191,36,0.06)',
                                border: '1px solid rgba(251,191,36,0.25)',
                            }}
                        >
                            <span style={{ color: '#fbbf24', flexShrink: 0 }}><MailIcon /></span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Gmail access not granted</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    Connect or re-authorise your Google account to enable inbox scanning. Your calendar data is preserved.
                                </p>
                            </div>
                            <button
                                onClick={handleConnectGmail}
                                className="btn-primary shrink-0 flex items-center gap-1.5"
                                style={{ fontSize: 12, padding: '6px 12px' }}
                            >
                                <LinkIcon /> Connect Google
                            </button>
                        </div>
                    )}

                    {/* ── Action error banner ── */}
                    {actionError && (
                        <div
                            className="rounded-xl px-4 py-3 flex items-start gap-3"
                            style={{
                                background: actionError.upgrade ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.08)',
                                border: `1px solid ${actionError.upgrade ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            }}
                        >
                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
                                    style={{ color: actionError.upgrade ? '#f59e0b' : '#ef4444' }}>
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-[13px] font-medium" style={{ color: actionError.upgrade ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                        {actionError.message}
                                    </p>
                                    {actionError.upgrade && (
                                        PAYMENTS_ENABLED
                                            ? <a href="/subscriptions" className="text-[12px] font-semibold underline mt-0.5 inline-block" style={{ color: 'var(--accent)' }}>
                                                View upgrade options →
                                              </a>
                                            : <span className="text-[12px] mt-0.5 inline-block" style={{ color: 'var(--text-muted)' }}>
                                                Paid plans coming soon
                                              </span>
                                    )}
                                </div>
                                <button onClick={() => setActionError(null)} className="text-xs opacity-50 hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }}>✕</button>
                        </div>
                    )}

                    {/* ── Tabs ── */}
                    {(() => {
                        const appCount = suggestions.filter(s => (s.emailCategory ?? 'application_response') === 'application_response').length;
                        const offerCount = suggestions.filter(s => s.emailCategory === 'job_offer').length;
                        return (
                            <div
                                className="flex items-center gap-1 p-1 rounded-xl"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                            >
                                {([
                                    { key: 'application_response' as const, label: 'Applications', count: appCount },
                                    { key: 'job_offer' as const, label: 'Job Leads', count: offerCount },
                                ]).map(({ key, label, count }) => {
                                    const isActive = activeTab === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => switchTab(key)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                            style={{
                                                background: isActive ? 'var(--bg-raised)' : 'transparent',
                                                border: isActive ? '1px solid var(--border-bright)' : '1px solid transparent',
                                                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                                boxShadow: isActive ? '0 1px 4px rgba(14,14,23,0.4)' : 'none',
                                            }}
                                        >
                                            {label}
                                            {count > 0 && (
                                                <span
                                                    className="px-1.5 py-0.5 rounded-full text-xs font-bold leading-none"
                                                    style={{
                                                        background: isActive ? 'var(--accent)' : 'var(--bg-raised)',
                                                        color: isActive ? '#000' : 'var(--text-muted)',
                                                    }}
                                                >
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* ── Loading skeletons ── */}
                    {loading && (
                        <div className="space-y-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="card p-3 sm:p-4 space-y-3" style={{ opacity: 1 - i * 0.25 }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl shrink-0" style={{ background: 'var(--bg-elevated)' }} />
                                        <div className="space-y-1.5 flex-1">
                                            <div className="h-3.5 w-1/3 rounded" style={{ background: 'var(--bg-elevated)' }} />
                                            <div className="h-3 w-1/4 rounded" style={{ background: 'var(--bg-elevated)' }} />
                                        </div>
                                        <div className="h-5 w-16 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
                                    </div>
                                    <div className="h-12 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
                                    <div className="flex justify-end gap-2">
                                        <div className="h-8 w-14 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
                                        <div className="h-8 w-14 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Empty state (no suggestions at all) ── */}
                    {!loading && suggestions.length === 0 && (
                        <div className="card p-6 sm:p-10 flex flex-col items-center text-center">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                            >
                                <InboxIcon />
                            </div>
                            {hasScope === false ? (
                                <>
                                    <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                        Gmail account not connected
                                    </p>
                                    <p className="text-sm max-w-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                                        Connect your Gmail account to use inbox scanning and get AI-detected application updates.
                                    </p>
                                    <button
                                        onClick={handleConnectGmail}
                                        className="btn-primary shrink-0 flex items-center gap-1.5"
                                        style={{ fontSize: 12, padding: '6px 12px' }}
                                    >
                                        <LinkIcon /> Connect Google
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>All caught up</p>
                                    <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                                        No pending suggestions. Use the <strong>Scan inbox</strong> button above to check for new job emails.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Empty current tab (but other tab has items) ── */}
                    {!loading && suggestions.length > 0 && suggestions.filter(s => (s.emailCategory ?? 'application_response') === activeTab).length === 0 && (
                        <div className="card p-6 sm:p-8 text-center">
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                No {activeTab === 'job_offer' ? 'job lead' : 'application'} emails pending
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Switch tab to see your {activeTab === 'job_offer' ? 'application responses' : 'job leads'}.
                            </p>
                        </div>
                    )}

                    {/* ── Suggestion cards ── */}
                    {!loading && (
                        <div className="space-y-3">
                            {suggestions.filter(s => (s.emailCategory ?? 'application_response') === activeTab).map((s) => {
                                const busy = actionIds.has(s._id);
                                const job = s.jobApplicationId as any;
                                const isCalChecked = !calendarUnchecked.has(s._id);
                                const hasCalEvent = !!(s.suggestedCalendarEvent?.dateTimeISO);
                                const companyInitial = (s.matchedCompanyName || s.senderName || '?')[0].toUpperCase();

                                return (
                                    <div key={s._id} className="card overflow-hidden relative">
                                        {/* Busy overlay */}
                                        {busy && (
                                            <div
                                                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
                                                style={{ background: 'rgba(14,14,23,0.5)', backdropFilter: 'blur(1px)' }}
                                            >
                                                <Spinner size="sm" />
                                            </div>
                                        )}

                                        <div className="p-4 space-y-3">
                                            {/* ── Header: avatar + company + status + time ── */}
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
                                                    style={{
                                                        background: 'var(--accent-bg)',
                                                        color: 'var(--accent)',
                                                        border: '1px solid var(--accent-dim)',
                                                    }}
                                                >
                                                    {companyInitial}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-[14px] font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                                                                {s.matchedCompanyName || s.senderName || 'Unknown sender'}
                                                            </p>
                                                            {s.matchedJobTitle && (
                                                                <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                                                                    {s.matchedJobTitle}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {s.suggestedStatus && <StatusPill status={s.suggestedStatus} />}
                                                            {s.createdAt && (
                                                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                                    {formatRelativeTime(s.createdAt)}
                                                                </span>
                                                            )}
                                                            {s.gmailMessageId && activeTab === 'application_response' && (
                                                                <a
                                                                    href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Open in Gmail"
                                                                    className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                                                                    style={{
                                                                        color: 'var(--text-muted)',
                                                                        border: '1px solid var(--border-subtle)',
                                                                        background: 'var(--bg-elevated)',
                                                                    }}
                                                                >
                                                                    <GmailLinkIcon />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1.5">
                                                        <ConfidencePill confidence={s.confidence} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ── Email preview block ── */}
                                            <div
                                                className="rounded-lg px-3 py-2.5"
                                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                                            >
                                                <p className="text-[12.5px] font-medium leading-snug" style={{ color: 'var(--text-secondary)' }}>
                                                    {s.emailSubject || 'No subject'}
                                                </p>
                                                {s.emailSnippet && (
                                                    <p className="text-[11.5px] mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                                                        {s.emailSnippet}
                                                    </p>
                                                )}
                                                {(s.senderName || s.senderEmail) && (
                                                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                        From: {s.senderName || s.senderEmail}
                                                    </p>
                                                )}
                                            </div>

                                            {/* ── AI note ── */}
                                            {s.suggestedNote && (
                                                <div
                                                    className="rounded-lg px-3 py-2.5"
                                                    style={{
                                                        background: 'var(--accent-bg)',
                                                        borderLeft: '3px solid var(--accent)',
                                                        border: '1px solid var(--accent-dim)',
                                                    }}
                                                >
                                                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--accent)' }}>AI note</p>
                                                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                        {s.suggestedNote}
                                                    </p>
                                                </div>
                                            )}

                                            {/* ── Calendar event chip ── */}
                                            {hasCalEvent && (
                                                <div
                                                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                                                    style={{
                                                        background: hasScope ? 'rgba(59,130,246,0.06)' : 'var(--bg-elevated)',
                                                        border: `1px solid ${hasScope ? 'rgba(59,130,246,0.2)' : 'var(--border-subtle)'}`,
                                                    }}
                                                >
                                                    {hasScope && (
                                                        <input
                                                            type="checkbox"
                                                            checked={isCalChecked}
                                                            onChange={(e) => {
                                                                setCalendarUnchecked((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (!e.target.checked) next.add(s._id); else next.delete(s._id);
                                                                    return next;
                                                                });
                                                            }}
                                                            className="shrink-0 cursor-pointer"
                                                            style={{ accentColor: '#3b82f6', width: 14, height: 14 }}
                                                        />
                                                    )}
                                                    <span style={{ color: hasScope ? '#3b82f6' : 'var(--text-muted)', flexShrink: 0 }}>
                                                        <CalendarIcon />
                                                    </span>
                                                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                                                        <p className="text-[12.5px] font-semibold truncate" style={{ color: hasScope ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                            {s.suggestedCalendarEvent!.title}
                                                        </p>
                                                        <p className="text-[11.5px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                            {formatCalEventDate(s.suggestedCalendarEvent!.dateTimeISO)}
                                                        </p>
                                                    </div>
                                                    {!hasScope && (
                                                        <button
                                                            onClick={handleConnectGmail}
                                                            className="text-[11px] font-semibold shrink-0 underline"
                                                            style={{ color: 'var(--accent)' }}
                                                        >
                                                            Connect calendar →
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Footer: match info + email link toggle + action buttons ── */}
                                            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                                {s.emailCategory !== 'job_offer' && (
                                                    <div className="flex-1 min-w-0 text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                        {job ? (
                                                            <>
                                                                <span>Matched: </span>
                                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                                    {job.companyName} — {job.jobTitle}
                                                                </span>
                                                                <span
                                                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-1.5"
                                                                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                                                                >
                                                                    {job.status}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span style={{ color: 'rgba(251,191,36,0.85)' }}>⚠ No matching job found</span>
                                                        )}
                                                    </div>
                                                )}
                                                {s.emailCategory === 'job_offer' && <div className="flex-1" />}

                                                {/* Action buttons */}
                                                <div className="flex gap-1.5 shrink-0">
                                                    {s.emailCategory === 'job_offer' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleReject(s)}
                                                                disabled={busy}
                                                                className="btn-secondary flex items-center gap-1"
                                                                style={{ fontSize: 12, padding: '5px 10px' }}
                                                            >
                                                                <XIcon /> Dismiss
                                                            </button>
                                                            <a
                                                                href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn-primary flex items-center gap-1"
                                                                style={{ fontSize: 12, padding: '5px 10px' }}
                                                            >
                                                                <ExternalLinkIcon /> Open in Gmail
                                                            </a>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingSuggestion(s)}
                                                                disabled={busy}
                                                                className="btn-secondary flex items-center gap-1"
                                                                style={{ fontSize: 12, padding: '5px 10px' }}
                                                            >
                                                                <EditIcon /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(s)}
                                                                disabled={busy}
                                                                className="btn-danger flex items-center gap-1"
                                                                style={{ fontSize: 12, padding: '5px 10px' }}
                                                            >
                                                                <XIcon /> Dismiss
                                                            </button>
                                                            {(s.suggestedStatus && job || (hasCalEvent && hasScope)) && (
                                                                <button
                                                                    onClick={() => handleAccept(s)}
                                                                    disabled={busy}
                                                                    className="btn-primary flex items-center gap-1"
                                                                    style={{ fontSize: 12, padding: '5px 10px' }}
                                                                >
                                                                    <CheckIcon />
                                                                    {s.suggestedStatus ? 'Apply' : 'Save to calendar'}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Edit modal ── */}
                    {editingSuggestion && (
                        <EditSuggestionModal
                            suggestion={editingSuggestion}
                            onClose={() => setEditingSuggestion(null)}
                            onSave={handleEditSave}
                        />
                    )}

                    {/* ── Toast ── */}
                    {toast && (
                        <div
                            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl whitespace-nowrap"
                            style={{
                                background: toast.type === 'err' ? 'rgba(244,100,100,0.12)' : 'var(--bg-elevated)',
                                border: `1px solid ${toast.type === 'err' ? 'rgba(244,100,100,0.3)' : 'var(--border)'}`,
                                color: toast.type === 'err' ? 'var(--rose, #f46464)' : 'var(--text-primary)',
                                animation: 'fadeUp 200ms ease',
                            }}
                        >
                            {toast.msg}
                        </div>
                    )}

                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        @keyframes fadeUp {
                            from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
};

export default EmailSuggestionsPage;
