// client/src/pages/EmailSuggestionsPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/parseApiError';
import { PAYMENTS_ENABLED } from '../utils/featureFlags';
import {
    listPendingSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    pollNow,
    getGmailScopeStatus,
    getPreferences,
    updatePreferences,
    type EmailSuggestion,
    type PollNowResult,
} from '../services/emailSuggestionsApi';
import {
    getPendingFollowUpSuggestionsApi,
    generateFollowUpDraftApi,
    sendFollowUpApi,
    dismissFollowUpApi,
    snoozeFollowUpOneWeekApi,
    type IFollowUpSuggestion,
} from '../services/jobApi';
import EditSuggestionModal from '../components/email-suggestions/EditSuggestionModal';

// ─── Icons ───────────────────────────────────────────────────────────────────

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
        <rect x="1" y="9" width="14" height="12" rx="1.5" />
        <polyline points="1 10 8 15 15 10" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="12" y1="11" x2="21" y2="3" />
    </svg>
);

const RejectionIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
);

const JobSuggestionIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const FollowUpIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
        <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
);

const ClockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const SnoozeIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, string> = {
    Interview: '#1E3932',
    Assessment: '#d4a017',
    Rejected: '#c82014',
    Offer: '#006241',
};

const CONFIDENCE_COLORS: Record<string, string> = {
    high: '#006241',
    medium: '#d4a017',
    low: '#c82014',
};

function ConfidencePill({ confidence }: { confidence: string }) {
    const color = CONFIDENCE_COLORS[confidence] ?? 'rgba(0,0,0,0.38)';
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
    const color = STATUS_COLORS[status] ?? 'rgba(0,0,0,0.38)';
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

// ─── How it works ────────────────────────────────────────────────────────────

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
        description: 'Nothing is applied automatically. You review each suggestion and click Apply or Dismiss if it\'s wrong.',
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

// ─── Toggle sub-component ────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-black/87 font-medium">{label}</span>
            <button
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-pill relative transition-colors cursor-pointer ${checked ? 'bg-green-accent' : 'bg-[#edebe9]'}`}
            >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const EmailSuggestionsPage: React.FC = () => {
    const { refreshUsage } = useAuth();
    const navigate = useNavigate();
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
    const [includeReadEmails, setIncludeReadEmails] = useState(false);
    const [calendarUnchecked, setCalendarUnchecked] = useState<Set<string>>(new Set());
    const [, setNoteAddedLocally] = useState<Set<string>>(new Set());
    const [editingSuggestion, setEditingSuggestion] = useState<EmailSuggestion | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [howItWorksOpen, setHowItWorksOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('emailSuggestions.howItWorksOpen') === 'true'; }
        catch { return false; }
    });
    const [activeFilter, setActiveFilter] = useState<'all' | 'rejection' | 'job_suggestion' | 'follow_up'>('all');
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Follow-up suggestions state
    const [followUps, setFollowUps] = useState<IFollowUpSuggestion[]>([]);
    const [followUpLoading, setFollowUpLoading] = useState(true);
    const [followUpActionId, setFollowUpActionId] = useState<string | null>(null);

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
            setIncludeReadEmails(prefs.includeReadEmails ?? false);
            setNoteAddedLocally(new Set(data.filter((s) => s.noteAdded).map((s) => s._id)));
        } catch {
            // non-fatal
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadFollowUps = useCallback(async () => {
        setFollowUpLoading(true);
        try {
            const followUpData = await getPendingFollowUpSuggestionsApi();
            setFollowUps(followUpData);
        } catch {
            // non-fatal
        } finally {
            setFollowUpLoading(false);
        }
    }, []);

    useEffect(() => { loadFollowUps(); }, [loadFollowUps]);

    const handleGenerateFollowUpDraft = async (jobId: string) => {
        setFollowUpActionId(jobId);
        try {
            const updated = await generateFollowUpDraftApi(jobId);
            setFollowUps((prev) => prev.map((f) => f.jobId === jobId ? updated : f));
            showToast('AI follow-up email draft generated.', 'ok');
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to generate follow-up email.', 'err');
        } finally {
            setFollowUpActionId(null);
        }
    };

    const handleSendFollowUp = async (jobId: string) => {
        setFollowUpActionId(jobId);
        try {
            await sendFollowUpApi(jobId);
            setFollowUps((prev) => prev.filter((f) => f.jobId !== jobId));
            showToast('Follow-up email sent!', 'ok');
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to send follow-up email.', 'err');
        } finally {
            setFollowUpActionId(null);
        }
    };

    const handleSnoozeFollowUp = async (jobId: string) => {
        setFollowUpActionId(jobId);
        try {
            const updated = await snoozeFollowUpOneWeekApi(jobId);
            setFollowUps((prev) => prev.map((f) => f.jobId === jobId ? updated : f));
            showToast('Follow-up snoozed for 1 week.', 'ok');
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to snooze follow-up.', 'err');
        } finally {
            setFollowUpActionId(null);
        }
    };

    const handleDismissFollowUp = async (jobId: string) => {
        setFollowUpActionId(jobId);
        try {
            await dismissFollowUpApi(jobId);
            setFollowUps((prev) => prev.filter((f) => f.jobId !== jobId));
            showToast('Follow-up dismissed.', 'ok');
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to dismiss follow-up.', 'err');
        } finally {
            setFollowUpActionId(null);
        }
    };

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
                    (result.calendarEventCreated ? ' — Calendar event created.' : ''),
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
            const result = await pollNow(scanLimit, includeReadEmails);
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
            // non-fatal
        }
    };

    const handleAutoPollApplicationsChange = async (value: boolean) => {
        setAutoPollApplications(value);
        try {
            await updatePreferences({ autoPollApplications: value });
        } catch {
            setAutoPollApplications(!value);
        }
    };

    const handleAutoPollJobLeadsChange = async (value: boolean) => {
        setAutoPollJobLeads(value);
        try {
            await updatePreferences({ autoPollJobLeads: value });
        } catch {
            setAutoPollJobLeads(!value);
        }
    };

    const handleIncludeReadEmailsChange = async (value: boolean) => {
        setIncludeReadEmails(value);
        try {
            await updatePreferences({ includeReadEmails: value });
        } catch {
            setIncludeReadEmails(!value);
        }
    };

    const handleConnectGmail = () => {
        navigate('/settings?googleCalendar');
    };

    // ─── Derived data ──────────────────────────────────────────────────────────

    const rejectionSuggestions = suggestions.filter(s => s.suggestedStatus === 'Rejected');
    const jobLeadSuggestions = suggestions.filter(s => s.emailCategory === 'job_offer');
    const otherAppSuggestions = suggestions.filter(s => s.emailCategory === 'application_response' && s.suggestedStatus !== 'Rejected');
    const totalCount = suggestions.length + followUps.length;
    const rejectionCount = rejectionSuggestions.length;
    const jobLeadCount = jobLeadSuggestions.length;
    const followUpCount = followUps.length;

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredSuggestions = suggestions.filter((s) => {
        if (!normalizedQuery) return true;
        const haystack = [
            s.matchedCompanyName,
            s.senderName,
            s.senderEmail,
            s.matchedJobTitle,
            s.emailSubject,
            s.emailSnippet,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
    });

    const filteredFollowUps = followUps.filter((f) => {
        if (!normalizedQuery) return true;
        const haystack = [
            f.companyName,
            f.jobTitle,
            f.draftSubject,
            f.draftBody,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
    });

    const visibleRejections = activeFilter === 'all' || activeFilter === 'rejection'
        ? filteredSuggestions.filter(s => s.suggestedStatus === 'Rejected')
        : [];
    const visibleJobLeads = activeFilter === 'all' || activeFilter === 'job_suggestion'
        ? filteredSuggestions.filter(s => s.emailCategory === 'job_offer')
        : [];
    const visibleOtherApps = activeFilter === 'all'
        ? filteredSuggestions.filter(s => s.emailCategory === 'application_response' && s.suggestedStatus !== 'Rejected')
        : [];
    const visibleFollowUps = activeFilter === 'all' || activeFilter === 'follow_up'
        ? filteredFollowUps
        : [];

    const allVisibleItems = [
        ...visibleRejections.map(s => ({ type: 'rejection' as const, data: s })),
        ...visibleJobLeads.map(s => ({ type: 'job_suggestion' as const, data: s })),
        ...visibleOtherApps.map(s => ({ type: 'application_response' as const, data: s })),
        ...visibleFollowUps.map(f => ({ type: 'follow_up' as const, data: f })),
    ];

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#f2f0eb] font-manrope pb-24 lg:pb-0">
            <main className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-10 py-10">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-[clamp(2rem,5vw,2.8rem)] leading-[1.2] font-semibold text-green mb-2 tracking-tight">
                        Email Suggestions
                    </h1>
                    <p className="text-lg leading-[1.75] text-black/58 max-w-2xl">
                        AI-detected updates from your job hunt. Rejections, job suggestions, and follow-ups in one place.
                    </p>
                </div>

                {/* Search + Actions */}
                <div className="flex items-center gap-4 mb-8 flex-wrap">
                    <div className="flex-1 min-w-[200px] max-w-[480px] relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/38 pointer-events-none">
                            <SearchIcon />
                        </span>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white rounded-pill border border-transparent shadow-card text-sm text-black/87 placeholder:text-black/38 focus:outline-none focus:ring-2 focus:ring-green/20 transition-all"
                            placeholder="Search inbox..."
                            type="search"
                            aria-label="Search inbox"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen((v) => !v)}
                            title="Scan settings"
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${settingsOpen ? 'bg-white shadow-warm border-green-accent/30 text-green' : 'border-[#d4d0c8] text-black/38 hover:bg-white hover:text-black/58'}`}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                            </svg>
                        </button>
                        <button
                            onClick={handlePoll}
                            disabled={polling}
                            className="btn-primary shadow-frap disabled:opacity-70"
                        >
                            <RefreshIcon spinning={polling} />
                            <span>{polling ? `Scanning last ${scanLimit} emails` : 'Scan inbox'}</span>
                            {!polling && (
                                <span className="bg-white/20 text-white text-[0.65rem] px-2 py-0.5 rounded-pill font-bold">1 Credit</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* ── Left Column ── */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Compact Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="card p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center text-green">
                                    <MailIcon />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-black/87 leading-none">{totalCount}</p>
                                    <p className="text-xs text-black/58 font-medium mt-0.5">Active</p>
                                </div>
                            </div>
                            <div className="card p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-error-bg flex items-center justify-center text-error">
                                    <RejectionIcon />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-error leading-none">{rejectionCount}</p>
                                    <p className="text-xs text-black/58 font-medium mt-0.5">Rejections</p>
                                </div>
                            </div>
                            <div className="card p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center text-green">
                                    <JobSuggestionIcon />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green leading-none">{jobLeadCount}</p>
                                    <p className="text-xs text-black/58 font-medium mt-0.5">Suggestions</p>
                                </div>
                            </div>
                            <div className="card p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-warm-bg flex items-center justify-center text-warm">
                                    <FollowUpIcon />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-warm leading-none">{followUpCount}</p>
                                    <p className="text-xs text-black/58 font-medium mt-0.5">Follow-ups</p>
                                </div>
                            </div>
                        </div>

                        {/* Settings Panel */}
                        {settingsOpen && (
                            <div className="card p-5 space-y-4 animate-fade-in">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-xs font-semibold text-black/58 uppercase tracking-wider">Scan</span>
                                    <select
                                        value={scanLimit}
                                        onChange={(e) => handleScanLimitChange(Number(e.target.value))}
                                        className="bg-[#f2f0eb] border-none rounded-pill px-4 py-2 text-sm text-black/87 focus:outline-none focus:ring-2 focus:ring-green/20 cursor-pointer"
                                    >
                                        <option value={25}>Last 25 emails</option>
                                        <option value={50}>Last 50 emails</option>
                                        <option value={100}>Last 100 emails</option>
                                        <option value={200}>Last 200 emails</option>
                                    </select>
                                </div>
                                <div className="flex flex-wrap gap-6">
                                    <Toggle label="Auto-scan applications" checked={autoPollApplications} onChange={handleAutoPollApplicationsChange} />
                                    <Toggle label="Auto-scan job leads" checked={autoPollJobLeads} onChange={handleAutoPollJobLeadsChange} />
                                    <Toggle label="Include read emails" checked={includeReadEmails} onChange={handleIncludeReadEmailsChange} />
                                </div>
                                <p className="text-xs text-black/58">
                                    Processed emails are labeled <code className="bg-[#f2f0eb] px-1.5 py-0.5 rounded text-[0.7rem] font-mono text-green font-bold">vibe-hired-processed</code> in Gmail.
                                </p>
                            </div>
                        )}

                        {/* How It Works */}
                        <div>
                            <button
                                type="button"
                                onClick={toggleHowItWorks}
                                className="inline-flex items-center gap-2 text-green text-sm font-semibold hover:opacity-80 transition-opacity"
                            >
                                <svg
                                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    className={`transition-transform duration-200 ${howItWorksOpen ? 'rotate-180' : ''}`}
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                                {howItWorksOpen ? 'Hide' : 'How does this work?'}
                            </button>
                            {howItWorksOpen && (
                                <div className="card p-5 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                                    {HOW_IT_WORKS.map((step, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                                <div className="w-7 h-7 rounded-lg bg-green/10 text-green flex items-center justify-center text-xs font-bold">
                                                    {i + 1}
                                                </div>
                                                <div className="w-8 h-8 rounded-lg bg-green/10 text-green flex items-center justify-center">
                                                    <step.icon />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-black/87">{step.title}</p>
                                                <p className="text-xs text-black/58 leading-relaxed mt-0.5">{step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Gmail Warning */}
                        {hasScope === false && (
                            <div className="flex items-center gap-4 p-4 rounded-card bg-warm-bg border border-warm/30 text-warm">
                                <span className="shrink-0"><MailIcon /></span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm">Gmail access not granted</p>
                                    <p className="text-xs text-black/58 mt-0.5">Connect or re-authorize your Google account to enable inbox scanning. Your calendar data is preserved.</p>
                                </div>
                                <button onClick={handleConnectGmail} className="btn-primary text-xs shrink-0">
                                    <LinkIcon /> Connect Google
                                </button>
                            </div>
                        )}

                        {/* Error Alert */}
                        {actionError && (
                            <div className={`flex gap-3 p-4 rounded-card ${actionError.upgrade ? 'bg-warm-bg border border-warm/30 text-warm' : 'bg-error-bg border border-error/30 text-error'}`}>
                                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium">{actionError.message}</p>
                                    {actionError.upgrade && (
                                        PAYMENTS_ENABLED
                                            ? <a href="/subscriptions" className="text-xs font-semibold underline mt-1 inline-block">View upgrade options</a>
                                            : <span className="text-xs mt-1 inline-block">Paid plans coming soon</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Filter Chips */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setActiveFilter('all')} className={`badge ${activeFilter === 'all' ? 'badge-jade' : 'badge-ink'}`}>
                                All {totalCount > 0 && <span className="ml-1 bg-white/50 px-1.5 py-0.5 rounded-full text-[0.65rem]">{totalCount}</span>}
                            </button>
                            <button onClick={() => setActiveFilter('rejection')} className={`badge ${activeFilter === 'rejection' ? 'badge-rose' : 'badge-ink'}`}>
                                Rejections {rejectionCount > 0 && <span className="ml-1 bg-white/50 px-1.5 py-0.5 rounded-full text-[0.65rem]">{rejectionCount}</span>}
                            </button>
                            <button onClick={() => setActiveFilter('job_suggestion')} className={`badge ${activeFilter === 'job_suggestion' ? 'badge-jade' : 'badge-ink'}`}>
                                Job Suggestions {jobLeadCount > 0 && <span className="ml-1 bg-white/50 px-1.5 py-0.5 rounded-full text-[0.65rem]">{jobLeadCount}</span>}
                            </button>
                            <button onClick={() => setActiveFilter('follow_up')} className={`badge ${activeFilter === 'follow_up' ? 'badge-ember' : 'badge-ink'}`}>
                                Follow-ups {followUpCount > 0 && <span className="ml-1 bg-white/50 px-1.5 py-0.5 rounded-full text-[0.65rem]">{followUpCount}</span>}
                            </button>
                        </div>

                        {/* Content Feed */}
                        <div className="space-y-5">
                            {loading && followUpLoading && (
                                <div className="space-y-5">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="card p-6 animate-pulse">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-[#f2f0eb]" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-[#f2f0eb] rounded w-1/3" />
                                                    <div className="h-3 bg-[#f2f0eb] rounded w-1/4" />
                                                </div>
                                            </div>
                                            <div className="mt-4 h-16 bg-[#f2f0eb] rounded-xl" />
                                            <div className="mt-4 flex justify-end gap-2">
                                                <div className="h-8 w-20 bg-[#f2f0eb] rounded-pill" />
                                                <div className="h-8 w-24 bg-[#f2f0eb] rounded-pill" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!loading && !followUpLoading && allVisibleItems.length === 0 && (
                                <div className="card p-10 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-[#f2f0eb] flex items-center justify-center text-green mx-auto mb-4">
                                        <InboxIcon />
                                    </div>
                                    {hasScope === false ? (
                                        <>
                                            <h3 className="text-lg font-bold text-black/87 mb-1">Gmail account not connected</h3>
                                            <p className="text-sm text-black/58 mb-4">Connect your Gmail account to use inbox scanning and get AI-detected application updates.</p>
                                            <button onClick={handleConnectGmail} className="btn-primary">
                                                <LinkIcon /> Connect Google
                                            </button>
                                        </>
                                    ) : normalizedQuery ? (
                                        <>
                                            <h3 className="text-lg font-bold text-black/87 mb-1">No results found</h3>
                                            <p className="text-sm text-black/58">Try adjusting your search or filter to see more updates.</p>
                                        </>
                                    ) : activeFilter !== 'all' ? (
                                        <>
                                            <h3 className="text-lg font-bold text-black/87 mb-1">No {activeFilter === 'rejection' ? 'rejections' : activeFilter === 'job_suggestion' ? 'job suggestions' : 'follow-ups'} pending</h3>
                                            <p className="text-sm text-black/58">Switch filters to see other types of updates.</p>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-bold text-black/87 mb-1">All caught up</h3>
                                            <p className="text-sm text-black/58">No pending suggestions or follow-ups. Use the Scan inbox button above to check for new job emails.</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {!loading && !followUpLoading && allVisibleItems.length > 0 && (
                                <div className="space-y-5">
                                    {allVisibleItems.map((item) => {
                                        // ═══════════════════════════════════════════════
                                        // REJECTION CARD
                                        // ═══════════════════════════════════════════════
                                        if (item.type === 'rejection') {
                                            const s = item.data;
                                            const busy = actionIds.has(s._id);
                                            const companyInitial = (s.matchedCompanyName || s.senderName || '?')[0].toUpperCase();
                                            return (
                                                <div key={s._id} className="card relative overflow-hidden border-l-4 border-l-error">
                                                    {busy && (
                                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-card">
                                                            <Spinner size="sm" />
                                                        </div>
                                                    )}
                                                    <div className="p-6 space-y-4">
                                                        <div className="flex items-start gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-error-bg flex items-center justify-center text-error font-bold text-lg shrink-0">
                                                                {companyInitial}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                                    <div>
                                                                        <h4 className="font-bold text-black/87">{s.matchedCompanyName || s.senderName || 'Unknown sender'}</h4>
                                                                        {s.matchedJobTitle && <p className="text-sm text-black/58">{s.matchedJobTitle}</p>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <StatusPill status="Rejected" />
                                                                        {s.createdAt && <span className="text-xs text-black/38">{formatRelativeTime(s.createdAt)}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-error-bg border border-error/20">
                                                            <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center text-error shrink-0">
                                                                <RejectionIcon />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-error">Application Rejected</p>
                                                                <p className="text-xs text-black/58">{s.emailSubject || 'No subject'}</p>
                                                            </div>
                                                        </div>

                                                        {s.emailSnippet && (
                                                            <div className="bg-[#f2f0eb] rounded-xl p-4 border border-[#e8e6e1]">
                                                                <p className="text-sm text-black/58 leading-relaxed">{s.emailSnippet}</p>
                                                                {(s.senderName || s.senderEmail) && (
                                                                    <p className="text-xs text-black/38 mt-2">From: {s.senderName || s.senderEmail}</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                                            <button onClick={() => handleReject(s)} disabled={busy} className="btn-danger text-xs">
                                                                <XIcon /> Dismiss
                                                            </button>
                                                            {s.gmailMessageId && (
                                                                <a href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                                                                    <GmailLinkIcon /> Open in Gmail
                                                                </a>
                                                            )}
                                                            <button onClick={() => handleAccept(s)} disabled={busy} className="btn-primary text-xs bg-error hover:bg-error/90 border-error">
                                                                <CheckIcon /> Mark Rejected
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // ═══════════════════════════════════════════════
                                        // JOB SUGGESTION CARD
                                        // ═══════════════════════════════════════════════
                                        if (item.type === 'job_suggestion') {
                                            const s = item.data;
                                            const busy = actionIds.has(s._id);
                                            const companyInitial = (s.matchedCompanyName || s.senderName || '?')[0].toUpperCase();
                                            return (
                                                <div key={s._id} className="card relative overflow-hidden border-l-4 border-l-green">
                                                    {busy && (
                                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-card">
                                                            <Spinner size="sm" />
                                                        </div>
                                                    )}
                                                    <div className="p-6 space-y-4">
                                                        <div className="flex items-start gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-green/10 flex items-center justify-center text-green font-bold text-lg shrink-0">
                                                                {companyInitial}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                                    <div>
                                                                        <h4 className="font-bold text-black/87">{s.matchedCompanyName || s.senderName || 'Unknown sender'}</h4>
                                                                        {s.matchedJobTitle && <p className="text-sm text-black/58">{s.matchedJobTitle}</p>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="badge badge-jade">Job Suggestion</span>
                                                                        {s.createdAt && <span className="text-xs text-black/38">{formatRelativeTime(s.createdAt)}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-green/5 border border-green/20">
                                                            <div className="w-8 h-8 rounded-lg bg-green/10 flex items-center justify-center text-green shrink-0">
                                                                <SparkleIcon />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-green">We found a suitable job for you!</p>
                                                                <p className="text-xs text-black/58">Apply for this opportunity before it&apos;s gone.</p>
                                                            </div>
                                                        </div>

                                                        <div className="bg-[#f2f0eb] rounded-xl p-4 border border-[#e8e6e1]">
                                                            <p className="font-semibold text-sm text-black/87">{s.emailSubject || 'No subject'}</p>
                                                            {s.emailSnippet && <p className="text-sm text-black/58 leading-relaxed mt-1">{s.emailSnippet}</p>}
                                                        </div>

                                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                                            <button onClick={() => handleReject(s)} disabled={busy} className="btn-danger text-xs">
                                                                <XIcon /> Dismiss
                                                            </button>
                                                            {s.gmailMessageId && (
                                                                <a href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                                                                    <ExternalLinkIcon /> View Email
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // ═══════════════════════════════════════════════
                                        // APPLICATION RESPONSE CARD
                                        // ═══════════════════════════════════════════════
                                        if (item.type === 'application_response') {
                                            const s = item.data;
                                            const busy = actionIds.has(s._id);
                                            const job = s.jobApplicationId as any;
                                            const isCalChecked = !calendarUnchecked.has(s._id);
                                            const hasCalEvent = !!(s.suggestedCalendarEvent?.dateTimeISO);
                                            const companyInitial = (s.matchedCompanyName || s.senderName || '?')[0].toUpperCase();
                                            return (
                                                <div key={s._id} className="card relative overflow-hidden">
                                                    {busy && (
                                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-card">
                                                            <Spinner size="sm" />
                                                        </div>
                                                    )}
                                                    <div className="p-6 space-y-4">
                                                        <div className="flex items-start gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-[#f2f0eb] flex items-center justify-center text-green font-bold text-lg shrink-0">
                                                                {companyInitial}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                                    <div>
                                                                        <h4 className="font-bold text-black/87">{s.matchedCompanyName || s.senderName || 'Unknown sender'}</h4>
                                                                        {s.matchedJobTitle && <p className="text-sm text-black/58">{s.matchedJobTitle}</p>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {s.suggestedStatus && <StatusPill status={s.suggestedStatus} />}
                                                                        {s.createdAt && <span className="text-xs text-black/38">{formatRelativeTime(s.createdAt)}</span>}
                                                                        {s.gmailMessageId && (
                                                                            <a
                                                                                href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                title="Open in Gmail"
                                                                                className="w-8 h-8 rounded-lg bg-[#f2f0eb] border border-[#d4d0c8] flex items-center justify-center text-green hover:bg-white transition-colors"
                                                                            >
                                                                                <GmailLinkIcon />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 flex-wrap">
                                                            <ConfidencePill confidence={s.confidence} />
                                                        </div>

                                                        <div className="bg-[#f2f0eb] rounded-xl p-4 border border-[#e8e6e1]">
                                                            <p className="font-semibold text-sm text-black/87">{s.emailSubject || 'No subject'}</p>
                                                            {s.emailSnippet && <p className="text-sm text-black/58 leading-relaxed mt-1">{s.emailSnippet}</p>}
                                                            {(s.senderName || s.senderEmail) && (
                                                                <p className="text-xs text-black/38 mt-2">From: {s.senderName || s.senderEmail}</p>
                                                            )}
                                                        </div>

                                                        {s.suggestedNote && (
                                                            <div className="bg-green/5 rounded-xl p-4 border border-green/20">
                                                                <div className="text-[0.65rem] font-bold text-green uppercase tracking-widest mb-1">AI Note</div>
                                                                <p className="text-sm text-black/58">{s.suggestedNote}</p>
                                                            </div>
                                                        )}

                                                        {hasCalEvent && (
                                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(30,57,50,0.08)] border border-[#1E3932]/30 text-sm">
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
                                                                        className="w-3.5 h-3.5 accent-green shrink-0"
                                                                    />
                                                                )}
                                                                <span className="text-[#1E3932] shrink-0"><CalendarIcon /></span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-semibold text-black/87">{s.suggestedCalendarEvent!.title}</p>
                                                                    <span className="text-xs text-black/58">{formatCalEventDate(s.suggestedCalendarEvent!.dateTimeISO)}</span>
                                                                </div>
                                                                {!hasScope && (
                                                                    <button onClick={handleConnectGmail} className="text-xs font-semibold underline text-green shrink-0">Connect calendar</button>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                                            <div className="text-xs text-black/58 flex items-center gap-1.5 flex-wrap">
                                                                {job ? (
                                                                    <>
                                                                        <span>Matched:</span>
                                                                        <strong className="text-black/87 font-semibold">{job.companyName} {job.jobTitle}</strong>
                                                                        <span className="bg-[#f2f0eb] px-2 py-0.5 rounded-pill text-[0.65rem] font-medium">{job.status}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-warm font-medium">No matching job found</span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <button onClick={() => setEditingSuggestion(s)} disabled={busy} className="btn-secondary text-xs">
                                                                    <EditIcon /> Edit
                                                                </button>
                                                                <button onClick={() => handleReject(s)} disabled={busy} className="btn-danger text-xs">
                                                                    <XIcon /> Dismiss
                                                                </button>
                                                                {(s.suggestedStatus && job || (hasCalEvent && hasScope)) && (
                                                                    <button onClick={() => handleAccept(s)} disabled={busy} className="btn-primary text-xs">
                                                                        <CheckIcon /> {s.suggestedStatus ? 'Apply' : 'Save to calendar'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // ═══════════════════════════════════════════════
                                        // FOLLOW-UP CARD
                                        // ═══════════════════════════════════════════════
                                        const fu = item.data;
                                        return (
                                            <div key={fu.jobId} className="card relative overflow-hidden border-l-4 border-l-warm">
                                                {followUpActionId === fu.jobId && (
                                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-card">
                                                        <Spinner size="sm" />
                                                    </div>
                                                )}
                                                <div className="p-6 space-y-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-warm-bg flex items-center justify-center text-warm font-bold text-lg shrink-0">
                                                            {(fu.companyName ?? '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                                                <div>
                                                                    <h4 className="font-bold text-black/87">{fu.jobTitle ?? 'Unknown Position'}</h4>
                                                                    <p className="text-sm text-black/58">{fu.companyName ?? 'Unknown Company'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {fu.isDue && (
                                                                        <span className="badge badge-ember">Due now</span>
                                                                    )}
                                                                    <span className="text-xs text-black/38 flex items-center gap-1">
                                                                        <ClockIcon /> {fu.daysWithoutResponse} days
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-warm-bg border border-warm/20">
                                                        <div className="w-8 h-8 rounded-lg bg-warm/10 flex items-center justify-center text-warm shrink-0">
                                                            <FollowUpIcon />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm text-warm">Time to follow up</p>
                                                            <p className="text-xs text-black/58">
                                                                {fu.isDue
                                                                    ? `It has been ${fu.daysWithoutResponse} days since this application.`
                                                                    : fu.dueDateISO
                                                                        ? `Follow-up reminder: ${new Date(fu.dueDateISO).toLocaleDateString()}`
                                                                        : 'Send a follow-up email to check on your application status.'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {fu.draftBody && (
                                                        <div className="bg-[#f2f0eb] rounded-xl p-4 border border-[#e8e6e1]">
                                                            <p className="font-semibold text-sm text-black/87">{fu.draftSubject || 'Follow-up on my application'}</p>
                                                            <p className="text-sm text-black/58 leading-relaxed mt-1">{fu.draftBody.slice(0, 150)}...</p>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                                        <button onClick={() => navigate(`/jobs/${fu.jobId}/workspace/job-description`)} className="btn-secondary text-xs">
                                                            <ExternalLinkIcon /> View Job
                                                        </button>
                                                        <button onClick={() => handleSnoozeFollowUp(fu.jobId)} disabled={followUpActionId === fu.jobId} className="btn-secondary text-xs">
                                                            <SnoozeIcon /> Snooze
                                                        </button>
                                                        <button onClick={() => handleDismissFollowUp(fu.jobId)} disabled={followUpActionId === fu.jobId} className="btn-danger text-xs">
                                                            <XIcon /> Dismiss
                                                        </button>
                                                        {fu.draftBody ? (
                                                            <button onClick={() => handleSendFollowUp(fu.jobId)} disabled={followUpActionId === fu.jobId} className="btn-primary text-xs bg-warm border-warm hover:bg-warm/90">
                                                                {followUpActionId === fu.jobId ? 'Sending...' : 'Send Email'}
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleGenerateFollowUpDraft(fu.jobId)} disabled={followUpActionId === fu.jobId} className="btn-primary text-xs bg-warm border-warm hover:bg-warm/90">
                                                                {followUpActionId === fu.jobId ? 'Generating...' : 'Generate Draft'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right Column ── */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Gmail Status */}
                        <div className="card p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-green">Gmail Status</h2>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${hasScope ? 'bg-green-accent' : 'bg-error'}`} />
                                    <span className={`text-[0.65rem] font-bold tracking-widest ${hasScope ? 'text-green-accent' : 'text-error'}`}>
                                        {hasScope ? 'CONNECTED' : 'DISCONNECTED'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-[#f2f0eb] rounded-xl mb-5">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-warm-sm">
                                    <MailIcon />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-black/87">Gmail Account</p>
                                    <p className="text-xs text-black/58">{hasScope ? 'Authorized for inbox scanning' : 'Not connected'}</p>
                                </div>
                            </div>
                            <button onClick={handlePoll} disabled={polling} className="btn-primary w-full justify-center disabled:opacity-70">
                                <RefreshIcon spinning={polling} />
                                <span>{polling ? 'Polling...' : 'Poll Now'}</span>
                            </button>
                        </div>

                        {/* Preferences */}
                        <div className="card p-6">
                            <h2 className="text-xl font-semibold text-black/87 mb-5">Preferences</h2>
                            <div className="mb-5">
                                <label className="text-sm font-semibold text-black/58 block mb-2">Scan</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[25, 50, 100, 200].map(limit => (
                                        <button
                                            key={limit}
                                            onClick={() => handleScanLimitChange(limit)}
                                            className={`px-3 py-2 text-sm font-semibold rounded-lg text-center transition-all active:scale-95 ${scanLimit === limit ? 'border-2 border-green-accent bg-green-light/30 text-green-accent' : 'border border-cream-ceramic text-black/58 hover:bg-[#f2f0eb]'}`}
                                        >
                                            Last {limit} emails
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4 py-4 border-t border-[#edebe9]">
                                <Toggle label="Auto-scan applications" checked={autoPollApplications} onChange={handleAutoPollApplicationsChange} />
                                <Toggle label="Auto-scan job leads" checked={autoPollJobLeads} onChange={handleAutoPollJobLeadsChange} />
                                <Toggle label="Include read emails" checked={includeReadEmails} onChange={handleIncludeReadEmailsChange} />
                            </div>
                            <div className="mt-4 pt-4 border-t border-[#edebe9]">
                                <p className="text-[11px] leading-relaxed text-black/58 italic">
                                    Processed emails are labeled <span className="text-green-accent font-bold font-mono">vibe-hired-processed</span> in Gmail.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm z-50 animate-fade-up shadow-warm-xl ${toast.type === 'err' ? 'bg-error-bg text-error border border-error/20' : 'bg-white text-black/87 border border-[#d4d0c8]'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Edit Modal */}
            {editingSuggestion && (
                <EditSuggestionModal
                    suggestion={editingSuggestion}
                    onClose={() => setEditingSuggestion(null)}
                    onSave={handleEditSave}
                />
            )}
        </div>
    );
};

export default EmailSuggestionsPage;
