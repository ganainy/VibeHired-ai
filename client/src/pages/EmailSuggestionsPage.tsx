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
    pollNow,
    getGmailScopeStatus,
    getPreferences,
    updatePreferences,
    type EmailSuggestion,
    type PollNowResult,
} from '../services/emailSuggestionsApi';
import { getGoogleConnectUrl } from '../services/googleCalendarApi';
import EditSuggestionModal from '../components/email-suggestions/EditSuggestionModal';

//  Icons 

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
        {/* envelope  offset left/down so the arrow doesn't overlap */}
        <rect x="1" y="9" width="14" height="12" rx="1.5" />
        <polyline points="1 10 8 15 15 10" />
        {/* external-link arrow  top-right corner, clear of the envelope */}
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

//  Helpers 

const STATUS_COLORS: Record<string, string> = {
    Interview: 'var(--azure)',
    Assessment: 'var(--ember)',
    Rejected: 'var(--rose)',
    Offer: 'var(--jade)',
};

const CONFIDENCE_COLORS: Record<string, string> = {
    high: 'var(--jade)',
    medium: 'var(--ember)',
    low: 'var(--rose)',
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

//  How it works steps 

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
        description: 'Nothing is applied automatically. You review each suggestion and click Apply  or Dismiss if it\'s wrong.',
    },
];

function buildPollToast(r: PollNowResult): string {
    if (r.scanned === 0) return 'No new emails to scan.';
    const scannedPart = `Scanned ${r.scanned} email${r.scanned !== 1 ? 's' : ''}`;
    if ((r.applicationResponses + r.jobLeads) === 0) return `${scannedPart}  no job-related emails found.`;
    const parts: string[] = [];
    if (r.applicationResponses > 0) parts.push(`${r.applicationResponses} application response${r.applicationResponses !== 1 ? 's' : ''}`);
    if (r.jobLeads > 0) parts.push(`${r.jobLeads} job lead${r.jobLeads !== 1 ? 's' : ''}`);
    return `${scannedPart}  found ${parts.join(' and ')}.`;
}

//  Main Page 

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
    const [includeReadEmails, setIncludeReadEmails] = useState(false);
    const [calendarUnchecked, setCalendarUnchecked] = useState<Set<string>>(new Set());
    const [, setNoteAddedLocally] = useState<Set<string>>(new Set());
    const [editingSuggestion, setEditingSuggestion] = useState<EmailSuggestion | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
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
            setIncludeReadEmails(prefs.includeReadEmails ?? false);
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
                    (result.calendarEventCreated ? '  Calendar event created.' : ''),
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

    const handleIncludeReadEmailsChange = async (value: boolean) => {
        setIncludeReadEmails(value);
        try {
            await updatePreferences({ includeReadEmails: value });
        } catch {
            setIncludeReadEmails(!value); // revert on failure
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

    const appCount = suggestions.filter(s => (s.emailCategory ?? 'application_response') === 'application_response').length;
    const leadCount = suggestions.filter(s => s.emailCategory === 'job_offer').length;
    const totalCount = suggestions.length;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const visibleSuggestions = suggestions
        .filter(s => (s.emailCategory ?? 'application_response') === activeTab)
        .filter((s) => {
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

    return (
        <div className="inbox-amber">
            <header className="inbox-topbar">
                <div className="inbox-topbar-inner">
                    <div className="inbox-search">
                        <span className="inbox-search-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="inbox-search-input"
                            placeholder="Search archives..."
                            type="search"
                            aria-label="Search inbox"
                        />
                    </div>
                    <div className="inbox-topbar-actions">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen((v) => !v)}
                            title="Scan settings"
                            className={settingsOpen ? 'inbox-icon-btn is-active' : 'inbox-icon-btn'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                            </svg>
                        </button>
                        <button
                            onClick={handlePoll}
                            disabled={polling}
                            className="inbox-primary-btn"
                            data-onboarding="primary-action"
                        >
                            <RefreshIcon spinning={polling} />
                            <span>{polling ? `Scanning last ${scanLimit} emails` : 'Scan inbox'}</span>
                            {!polling && (
                                <span className="inbox-credit-pill">1 Credit</span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="inbox-container">
                <section className="inbox-hero">
                    <div className="inbox-title-row">
                        <div>
                            <div className="inbox-title-inline">
                                <h1 className="inbox-title">Inbox</h1>
                                {totalCount > 0 && (
                                    <span className="inbox-count-pill">{totalCount}</span>
                                )}
                            </div>
                            <p className="inbox-subtitle">
                                AI-detected status changes from your job application emails. Review before applying.
                            </p>
                        </div>
                    </div>

                    <div className="inbox-stats-grid">
                        <div className="inbox-stat inbox-stat-primary">
                            <span className="inbox-stat-icon"><MailIcon /></span>
                            <div>
                                <p>Active Inbox</p>
                                <h3>{totalCount}</h3>
                            </div>
                        </div>
                        <div className="inbox-stat inbox-stat-neutral">
                            <span className="inbox-stat-icon"><MailIcon /></span>
                            <div>
                                <p>Applications</p>
                                <h3>{appCount}</h3>
                            </div>
                        </div>
                        <div className="inbox-stat inbox-stat-secondary">
                            <span className="inbox-stat-icon"><BoltIcon /></span>
                            <div>
                                <p>Job Leads</p>
                                <h3>{leadCount}</h3>
                            </div>
                        </div>
                    </div>
                </section>

                {settingsOpen && (
                    <div className="inbox-settings">
                        <div className="inbox-settings-row">
                            <span className="inbox-settings-label">Scan</span>
                            <select
                                value={scanLimit}
                                onChange={(e) => handleScanLimitChange(Number(e.target.value))}
                                className="inbox-select"
                            >
                                <option value={25}>Last 25 emails</option>
                                <option value={50}>Last 50 emails</option>
                                <option value={100}>Last 100 emails</option>
                                <option value={200}>Last 200 emails</option>
                            </select>
                        </div>
                        <label className="inbox-toggle">
                            <button
                                role="switch"
                                aria-checked={autoPollApplications}
                                onClick={() => handleAutoPollApplicationsChange(!autoPollApplications)}
                                className={autoPollApplications ? 'inbox-toggle-track is-active' : 'inbox-toggle-track'}
                            >
                                <span className="inbox-toggle-thumb" />
                            </button>
                            <span>Auto-scan applications</span>
                        </label>
                        <label className="inbox-toggle">
                            <button
                                role="switch"
                                aria-checked={autoPollJobLeads}
                                onClick={() => handleAutoPollJobLeadsChange(!autoPollJobLeads)}
                                className={autoPollJobLeads ? 'inbox-toggle-track is-active' : 'inbox-toggle-track'}
                            >
                                <span className="inbox-toggle-thumb" />
                            </button>
                            <span>Auto-scan job leads</span>
                        </label>
                        <label className="inbox-toggle">
                            <button
                                role="switch"
                                aria-checked={includeReadEmails}
                                onClick={() => handleIncludeReadEmailsChange(!includeReadEmails)}
                                className={includeReadEmails ? 'inbox-toggle-track is-active' : 'inbox-toggle-track'}
                            >
                                <span className="inbox-toggle-thumb" />
                            </button>
                            <span>Include read emails</span>
                        </label>
                        <p className="inbox-settings-note">
                            Processed emails are labeled <span className="inbox-code-pill">vibe-hired-processed</span> in Gmail.
                        </p>
                    </div>
                )}

                <div className="inbox-how">
                    <button
                        type="button"
                        onClick={toggleHowItWorks}
                        className="inbox-how-trigger"
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
                        <div className="inbox-how-grid">
                            {HOW_IT_WORKS.map((step, i) => (
                                <div key={i} className="inbox-how-card">
                                    <div className="inbox-step-pill">{i + 1}</div>
                                    <span className="inbox-how-icon"><step.icon /></span>
                                    <div>
                                        <p className="inbox-how-title">{step.title}</p>
                                        <p className="inbox-how-desc">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {hasScope === false && (
                    <div className="inbox-warning">
                        <span><MailIcon /></span>
                        <div>
                            <p>Gmail access not granted</p>
                            <p>Connect or re-authorize your Google account to enable inbox scanning. Your calendar data is preserved.</p>
                        </div>
                        <button onClick={handleConnectGmail} className="inbox-link-btn">
                            <LinkIcon /> Connect Google
                        </button>
                    </div>
                )}

                {actionError && (
                    <div className={actionError.upgrade ? 'inbox-alert is-upgrade' : 'inbox-alert'}>
                        <svg className="inbox-alert-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p>{actionError.message}</p>
                            {actionError.upgrade && (
                                PAYMENTS_ENABLED
                                    ? <a href="/subscriptions">View upgrade options</a>
                                    : <span>Paid plans coming soon</span>
                            )}
                        </div>
                    </div>
                )}

                <section className="inbox-updates">
                    <div className="inbox-updates-header">
                        <h2>Recent Updates</h2>
                        <div className="inbox-chips">
                            <button
                                type="button"
                                onClick={() => switchTab('application_response')}
                                className={activeTab === 'application_response' ? 'inbox-chip is-active' : 'inbox-chip'}
                            >
                                Applications {appCount > 0 && <span>{appCount}</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => switchTab('job_offer')}
                                className={activeTab === 'job_offer' ? 'inbox-chip is-active' : 'inbox-chip'}
                            >
                                Job Leads {leadCount > 0 && <span>{leadCount}</span>}
                            </button>
                            <span className="inbox-chip ghost">Sort: Newest</span>
                        </div>
                    </div>

                    {loading && (
                        <div className="inbox-skeletons">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="inbox-skeleton" style={{ opacity: 1 - i * 0.2 }}>
                                    <div className="inbox-skeleton-head">
                                        <div className="inbox-skeleton-avatar" />
                                        <div>
                                            <div className="inbox-skeleton-line short" />
                                            <div className="inbox-skeleton-line" />
                                        </div>
                                        <div className="inbox-skeleton-pill" />
                                    </div>
                                    <div className="inbox-skeleton-block" />
                                    <div className="inbox-skeleton-actions">
                                        <span />
                                        <span />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && suggestions.length === 0 && (
                        <div className="inbox-empty">
                            <div className="inbox-empty-icon"><InboxIcon /></div>
                            {hasScope === false ? (
                                <>
                                    <h3>Gmail account not connected</h3>
                                    <p>Connect your Gmail account to use inbox scanning and get AI-detected application updates.</p>
                                    <button onClick={handleConnectGmail} className="inbox-link-btn">
                                        <LinkIcon /> Connect Google
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h3>All caught up</h3>
                                    <p>No pending suggestions. Use the Scan inbox button above to check for new job emails.</p>
                                </>
                            )}
                        </div>
                    )}

                    {!loading && suggestions.length > 0 && visibleSuggestions.length === 0 && (
                        <div className="inbox-empty">
                            {normalizedQuery ? (
                                <>
                                    <h3>No results found</h3>
                                    <p>Try adjusting your search or switch tabs to see more updates.</p>
                                </>
                            ) : (
                                <>
                                    <h3>No {activeTab === 'job_offer' ? 'job lead' : 'application'} emails pending</h3>
                                    <p>Switch tabs to see your {activeTab === 'job_offer' ? 'application responses' : 'job leads'}.</p>
                                </>
                            )}
                        </div>
                    )}

                    {!loading && visibleSuggestions.length > 0 && (
                        <div className="inbox-cards">
                            {visibleSuggestions.map((s) => {
                                const busy = actionIds.has(s._id);
                                const job = s.jobApplicationId as any;
                                const isCalChecked = !calendarUnchecked.has(s._id);
                                const hasCalEvent = !!(s.suggestedCalendarEvent?.dateTimeISO);
                                const companyInitial = (s.matchedCompanyName || s.senderName || '?')[0].toUpperCase();

                                return (
                                    <div key={s._id} className="inbox-card">
                                        {busy && (
                                            <div className="inbox-card-overlay">
                                                <Spinner size="sm" />
                                            </div>
                                        )}

                                        <div className="inbox-card-body">
                                            <div className="inbox-card-header">
                                                <div className="inbox-card-avatar">{companyInitial}</div>
                                                <div className="inbox-card-meta">
                                                    <div>
                                                        <h4>{s.matchedCompanyName || s.senderName || 'Unknown sender'}</h4>
                                                        {s.matchedJobTitle && <p>{s.matchedJobTitle}</p>}
                                                    </div>
                                                    <div className="inbox-card-tags">
                                                        {s.suggestedStatus && <StatusPill status={s.suggestedStatus} />}
                                                        {s.createdAt && <span>{formatRelativeTime(s.createdAt)}</span>}
                                                        {s.gmailMessageId && (
                                                            <a
                                                                href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title="Open in Gmail"
                                                                className="inbox-gmail-btn"
                                                            >
                                                                <GmailLinkIcon />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="inbox-card-status">
                                                <ConfidencePill confidence={s.confidence} />
                                            </div>

                                            <div className="inbox-card-preview">
                                                <p className="inbox-card-subject">{s.emailSubject || 'No subject'}</p>
                                                {s.emailSnippet && <p className="inbox-card-snippet">{s.emailSnippet}</p>}
                                                {(s.senderName || s.senderEmail) && (
                                                    <p className="inbox-card-from">From: {s.senderName || s.senderEmail}</p>
                                                )}
                                            </div>

                                            {s.suggestedNote && (
                                                <div className="inbox-card-note">
                                                    <div className="inbox-card-note-head">
                                                        <span>AI Note</span>
                                                    </div>
                                                    <p>{s.suggestedNote}</p>
                                                </div>
                                            )}

                                            {hasCalEvent && (
                                                <div className="inbox-card-calendar">
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
                                                        />
                                                    )}
                                                    <span><CalendarIcon /></span>
                                                    <div>
                                                        <p>{s.suggestedCalendarEvent!.title}</p>
                                                        <span>{formatCalEventDate(s.suggestedCalendarEvent!.dateTimeISO)}</span>
                                                    </div>
                                                    {!hasScope && (
                                                        <button onClick={handleConnectGmail}>Connect calendar</button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="inbox-card-footer">
                                                {s.emailCategory !== 'job_offer' && (
                                                    <div className="inbox-card-match">
                                                        {job ? (
                                                            <>
                                                                <span>Matched:</span>
                                                                <strong>{job.companyName} {job.jobTitle}</strong>
                                                                <em>{job.status}</em>
                                                            </>
                                                        ) : (
                                                            <span className="warn">No matching job found</span>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="inbox-card-actions">
                                                    {s.emailCategory === 'job_offer' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleReject(s)}
                                                                disabled={busy}
                                                                className="inbox-ghost-btn"
                                                            >
                                                                <XIcon /> Dismiss
                                                            </button>
                                                            <a
                                                                href={`https://mail.google.com/mail/u/0/#all/${s.gmailMessageId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inbox-solid-btn"
                                                            >
                                                                <ExternalLinkIcon /> Open in Gmail
                                                            </a>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingSuggestion(s)}
                                                                disabled={busy}
                                                                className="inbox-ghost-btn"
                                                            >
                                                                <EditIcon /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(s)}
                                                                disabled={busy}
                                                                className="inbox-ghost-btn" style={{ color: 'var(--error)' }}
                                                            >
                                                                <XIcon /> Dismiss
                                                            </button>
                                                            {(s.suggestedStatus && job || (hasCalEvent && hasScope)) && (
                                                                <button
                                                                    onClick={() => handleAccept(s)}
                                                                    disabled={busy}
                                                                    className="inbox-solid-btn"
                                                                >
                                                                    <CheckIcon /> {s.suggestedStatus ? 'Apply' : 'Save to calendar'}
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
                </section>

                {editingSuggestion && (
                    <EditSuggestionModal
                        suggestion={editingSuggestion}
                        onClose={() => setEditingSuggestion(null)}
                        onSave={handleEditSave}
                    />
                )}
            </main>

            {toast && (
                <div className={toast.type === 'err' ? 'inbox-toast is-error' : 'inbox-toast'}>
                    {toast.msg}
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }

                .inbox-amber {
                    --primary: var(--accent);
                    --primary-dim: var(--accent-dim);
                    --primary-container: var(--accent-bg);
                    --secondary: var(--ember);
                    --secondary-container: var(--ember-bg, rgba(240, 126, 56, 0.08));
                    --surface: var(--bg-base);
                    --surface-low: var(--bg-elevated);
                    --surface-lowest: var(--bg-surface);
                    --surface-variant: var(--bg-raised, var(--bg-elevated));
                    --text-primary-amber: var(--text-primary);
                    --text-muted-amber: var(--text-muted);
                    --text-secondary: var(--text-secondary);
                    --text-muted: var(--text-muted);
                    --outline-variant: var(--border);
                    --error: var(--rose);
                    --error-soft: var(--rose-bg);
                    --shadow-soft: 0 12px 40px rgba(0, 0, 0, 0.25);
                    background: var(--surface);
                    color: var(--text-primary-amber);
                    min-height: 100vh;
                    position: relative;
                    font-family: 'Inter', sans-serif;
                }

                .inbox-amber h1,
                .inbox-amber h2,
                .inbox-amber h3,
                .inbox-amber h4 {
                    font-family: 'Manrope', 'Lora', serif;
                }

                .inbox-topbar {
                    position: sticky;
                    top: 0;
                    z-index: 3;
                    background: var(--bg-surface);
                    border-bottom: 1px solid var(--border);
                }

                .inbox-topbar-inner {
                    max-width: 72rem;
                    margin: 0 auto;
                    padding: 1.25rem 2rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    justify-content: space-between;
                }

                .inbox-search {
                    flex: 1;
                    max-width: 480px;
                    position: relative;
                }

                .inbox-search-icon {
                    position: absolute;
                    left: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }

                .inbox-search-input {
                    width: 100%;
                    border: none;
                    border-radius: 999px;
                    padding: 0.7rem 1rem 0.7rem 2.75rem;
                    background: var(--surface-low);
                    box-shadow: inset 0 0 0 1px var(--border);
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }

                .inbox-search-input:focus {
                    outline: 2px solid var(--accent-bg);
                }

                .inbox-topbar-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .inbox-icon-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 14px;
                    border: 1px solid var(--border);
                    background: transparent;
                    color: var(--text-muted);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 150ms ease;
                }

                .inbox-icon-btn.is-active {
                    background: var(--bg-surface);
                    box-shadow: var(--shadow-soft);
                    color: var(--primary);
                }

                .inbox-primary-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.65rem 1rem;
                    border-radius: 999px;
                    border: none;
                    background: var(--primary);
                    color: var(--text-on-accent, #0e0e17);
                    font-weight: 700;
                    font-size: 0.9rem;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
                }

                .inbox-primary-btn:disabled {
                    opacity: 0.7;
                }

                .inbox-credit-pill {
                    background: var(--accent-dim);
                    color: var(--text-on-accent, #0e0e17);
                    font-size: 0.65rem;
                    padding: 0.2rem 0.5rem;
                    border-radius: 999px;
                    font-weight: 700;
                }

                .inbox-container {
                    position: relative;
                    z-index: 2;
                    max-width: 72rem;
                    margin: 0 auto;
                    padding: 2rem 2rem 4rem;
                }

                .inbox-title-row {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                }

                .inbox-title-inline {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .inbox-title {
                    font-size: 2.75rem;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    margin-bottom: 0.5rem;
                }

                .inbox-count-pill {
                    background: var(--primary-container);
                    color: var(--text-on-accent, #0e0e17);
                    font-weight: 800;
                    font-size: 0.8rem;
                    padding: 0.2rem 0.6rem;
                    border-radius: 999px;
                }

                .inbox-subtitle {
                    color: var(--text-muted-amber);
                    font-size: 0.95rem;
                }

                .inbox-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1.5rem;
                    margin-top: 2rem;
                }

                .inbox-stat {
                    border-radius: 1.5rem;
                    padding: 2rem;
                    box-shadow: var(--shadow-soft);
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    min-height: 180px;
                }

                .inbox-stat h3 {
                    font-size: 3rem;
                    font-weight: 800;
                    margin: 0;
                }

                .inbox-stat p {
                    font-weight: 600;
                    margin: 0 0 0.5rem;
                }

                .inbox-stat-icon {
                    width: 48px;
                    height: 48px;
                }

                .inbox-stat-primary {
                    background: var(--primary);
                    color: var(--text-on-accent, #0e0e17);
                }

                .inbox-stat-neutral {
                    background: var(--surface-lowest);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                }

                .inbox-stat-neutral h3 {
                    color: var(--primary);
                }

                .inbox-stat-secondary {
                    background: var(--azure-bg, rgba(59, 130, 246, 0.08));
                    color: var(--azure, #3b82f6);
                    border: 1px solid var(--border);
                }

                .inbox-settings {
                    margin-top: 2rem;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 1rem 1.5rem;
                    padding: 1rem 1.25rem;
                    border-radius: 1.25rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    box-shadow: var(--shadow-soft);
                }

                .inbox-settings-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .inbox-settings-label {
                    font-size: 0.8rem;
                    color: var(--text-muted-amber);
                    font-weight: 600;
                }

                .inbox-select {
                    border: none;
                    background: var(--surface-low);
                    padding: 0.4rem 0.8rem;
                    border-radius: 999px;
                    font-size: 0.85rem;
                    color: var(--text-primary);
                }

                .inbox-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: var(--text-primary-amber);
                }

                .inbox-toggle-track {
                    width: 36px;
                    height: 18px;
                    border-radius: 999px;
                    border: 1px solid var(--border);
                    background: var(--surface-low);
                    position: relative;
                }

                .inbox-toggle-track.is-active {
                    background: var(--accent-bg);
                    border-color: var(--accent-dim);
                }

                .inbox-toggle-thumb {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 12px;
                    height: 12px;
                    border-radius: 999px;
                    background: var(--text-on-accent, #0e0e17);
                    transition: transform 150ms ease;
                }

                .inbox-toggle-track.is-active .inbox-toggle-thumb {
                    transform: translateX(16px);
                    background: var(--accent);
                }

                .inbox-settings-note {
                    margin-left: auto;
                    font-size: 0.75rem;
                    color: var(--text-muted-amber);
                }

                .inbox-code-pill {
                    background: var(--surface-variant);
                    padding: 0.15rem 0.4rem;
                    border-radius: 0.5rem;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.7rem;
                }

                .inbox-how {
                    margin-top: 1.5rem;
                }

                .inbox-how-trigger {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--primary);
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .inbox-how-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                    margin-top: 1rem;
                    padding: 1.5rem;
                    border-radius: 1.5rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                }

                .inbox-how-card {
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-start;
                }

                .inbox-how-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    background: var(--accent-bg);
                    color: var(--primary);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .inbox-step-pill {
                    width: 28px;
                    height: 28px;
                    border-radius: 10px;
                    background: var(--accent-bg);
                    color: var(--primary);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.8rem;
                }

                .inbox-how-title {
                    font-weight: 700;
                    font-size: 0.9rem;
                    margin-bottom: 0.25rem;
                }

                .inbox-how-desc {
                    font-size: 0.75rem;
                    color: var(--text-muted-amber);
                }

                .inbox-warning {
                    margin-top: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    border-radius: 1.25rem;
                    background: var(--ember-bg, rgba(240, 126, 56, 0.08));
                    border: 1px solid var(--ember, #f07e38);
                    color: var(--ember, #f07e38);
                }

                .inbox-warning p:first-child {
                    font-weight: 700;
                    margin-bottom: 0.2rem;
                }

                .inbox-warning p:last-child {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }

                .inbox-link-btn {
                    margin-left: auto;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.5rem 0.9rem;
                    border-radius: 999px;
                    border: none;
                    background: var(--primary);
                    color: var(--text-on-accent, #0e0e17);
                    font-size: 0.8rem;
                    font-weight: 700;
                }

                .inbox-alert {
                    margin-top: 1.5rem;
                    display: flex;
                    gap: 0.75rem;
                    padding: 1rem 1.25rem;
                    border-radius: 1rem;
                    background: var(--error-soft);
                    border: 1px solid var(--rose);
                    color: var(--error);
                }

                .inbox-alert.is-upgrade {
                    background: var(--ember-bg, rgba(240, 126, 56, 0.08));
                    border-color: var(--ember, #f07e38);
                    color: var(--ember, #f07e38);
                }

                .inbox-alert-icon {
                    width: 18px;
                    height: 18px;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .inbox-alert a {
                    display: inline-block;
                    margin-top: 0.3rem;
                    color: inherit;
                    text-decoration: underline;
                    font-weight: 600;
                    font-size: 0.8rem;
                }

                .inbox-updates {
                    margin-top: 2.5rem;
                }

                .inbox-updates-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .inbox-updates-header h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                }

                .inbox-chips {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .inbox-chip {
                    border-radius: 999px;
                    background: var(--surface-low);
                    color: var(--text-muted-amber);
                    padding: 0.35rem 0.9rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    border: 1px solid var(--border);
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                }

                .inbox-chip span {
                    background: var(--surface-lowest);
                    color: var(--primary);
                    padding: 0.05rem 0.4rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                }

                .inbox-chip.is-active {
                    background: var(--accent-bg);
                    color: var(--text-primary);
                    border-color: var(--accent-dim);
                }

                .inbox-chip.is-active span {
                    background: var(--surface-lowest);
                    color: var(--primary);
                }

                .inbox-chip.ghost {
                    background: transparent;
                    color: var(--text-muted-amber);
                    border-style: dashed;
                }

                .inbox-skeletons {
                    display: grid;
                    gap: 1.5rem;
                }

                .inbox-skeleton {
                    background: var(--surface-lowest);
                    border-radius: 1.25rem;
                    border: 1px solid var(--border);
                    padding: 1.5rem;
                    box-shadow: var(--shadow-soft);
                }

                .inbox-skeleton-head {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    justify-content: space-between;
                }

                .inbox-skeleton-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 16px;
                    background: var(--surface-low);
                }

                .inbox-skeleton-line {
                    width: 180px;
                    height: 10px;
                    border-radius: 6px;
                    background: var(--surface-low);
                }

                .inbox-skeleton-line.short {
                    width: 120px;
                    margin-bottom: 6px;
                }

                .inbox-skeleton-pill {
                    width: 60px;
                    height: 20px;
                    border-radius: 999px;
                    background: var(--surface-low);
                }

                .inbox-skeleton-block {
                    margin-top: 1rem;
                    height: 70px;
                    border-radius: 16px;
                    background: var(--surface-low);
                }

                .inbox-skeleton-actions {
                    margin-top: 1rem;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                }

                .inbox-skeleton-actions span {
                    width: 70px;
                    height: 28px;
                    border-radius: 999px;
                    background: var(--surface-low);
                }

                .inbox-empty {
                    background: var(--surface-lowest);
                    border-radius: 1.5rem;
                    padding: 2rem;
                    text-align: center;
                    border: 1px solid var(--border);
                    box-shadow: var(--shadow-soft);
                }

                .inbox-empty h3 {
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin-bottom: 0.4rem;
                }

                .inbox-empty p {
                    color: var(--text-muted-amber);
                    margin-bottom: 1rem;
                }

                .inbox-empty-icon {
                    width: 52px;
                    height: 52px;
                    border-radius: 18px;
                    margin: 0 auto 1rem;
                    background: var(--surface-low);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .inbox-cards {
                    display: grid;
                    gap: 1.5rem;
                }

                .inbox-card {
                    position: relative;
                    background: var(--surface-lowest);
                    border-radius: 1.5rem;
                    padding: 0;
                    border: 1px solid var(--border);
                    box-shadow: var(--shadow-soft);
                    transition: transform 200ms ease;
                }

                .inbox-card:hover {
                    transform: translateY(-2px);
                }

                .inbox-card-overlay {
                    position: absolute;
                    inset: 0;
                    border-radius: 1.5rem;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(2px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2;
                }

                .inbox-card-body {
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.2rem;
                }

                .inbox-card-header {
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                }

                .inbox-card-avatar {
                    width: 54px;
                    height: 54px;
                    border-radius: 18px;
                    background: var(--surface-low);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.3rem;
                    color: var(--primary);
                }

                .inbox-card-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 1rem;
                    flex: 1;
                }

                .inbox-card-meta h4 {
                    font-size: 1.15rem;
                    font-weight: 700;
                }

                .inbox-card-meta p {
                    font-size: 0.85rem;
                    color: var(--text-muted-amber);
                }

                .inbox-card-tags {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted-amber);
                    font-size: 0.75rem;
                }

                .inbox-gmail-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 12px;
                    background: var(--surface-low);
                    border: 1px solid var(--border);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .inbox-card-status {
                    display: flex;
                    gap: 0.5rem;
                }

                .inbox-card-preview {
                    background: var(--surface-low);
                    border-radius: 1rem;
                    padding: 1rem 1.25rem;
                    border: 1px solid var(--border);
                }

                .inbox-card-subject {
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .inbox-card-snippet {
                    font-size: 0.8rem;
                    color: var(--text-muted-amber);
                    margin-top: 0.4rem;
                    line-height: 1.5;
                }

                .inbox-card-from {
                    margin-top: 0.4rem;
                    font-size: 0.75rem;
                    color: var(--text-muted-amber);
                }

                .inbox-card-note {
                    background: var(--accent-bg);
                    border-radius: 1rem;
                    padding: 1rem 1.25rem;
                    border: 1px solid var(--accent-dim);
                }

                .inbox-card-note-head {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--primary);
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    margin-bottom: 0.4rem;
                }

                .inbox-card-note p {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }

                .inbox-card-calendar {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.9rem 1rem;
                    border-radius: 1rem;
                    background: var(--azure-bg, rgba(59, 130, 246, 0.08));
                    border: 1px solid var(--azure, #3b82f6);
                    font-size: 0.8rem;
                }

                .inbox-card-calendar input {
                    width: 14px;
                    height: 14px;
                    accent-color: var(--azure, #3b82f6);
                }

                .inbox-card-calendar span {
                    color: var(--azure, #3b82f6);
                }

                .inbox-card-calendar button {
                    margin-left: auto;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-decoration: underline;
                    color: var(--primary);
                }

                .inbox-card-calendar p {
                    font-weight: 600;
                }

                .inbox-card-calendar span + div span {
                    display: block;
                    color: var(--text-muted-amber);
                }

                .inbox-card-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .inbox-card-match {
                    font-size: 0.75rem;
                    color: var(--text-muted-amber);
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                }

                .inbox-card-match strong {
                    color: var(--text-primary-amber);
                    font-weight: 600;
                }

                .inbox-card-match em {
                    font-style: normal;
                    background: var(--surface-low);
                    padding: 0.1rem 0.5rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                }

                .inbox-card-match .warn {
                    color: var(--ember, #f07e38);
                }

                .inbox-card-actions {
                    display: flex;
                    gap: 0.6rem;
                    flex-wrap: wrap;
                }

                .inbox-ghost-btn {
                    border: 1px solid var(--border);
                    background: transparent;
                    color: var(--primary);
                    border-radius: 999px;
                    padding: 0.45rem 0.9rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                }

                .inbox-solid-btn {
                    border: none;
                    background: var(--primary);
                    color: var(--text-on-accent, #0e0e17);
                    border-radius: 999px;
                    padding: 0.45rem 0.9rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                }

                .inbox-toast {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 0.7rem 1.25rem;
                    border-radius: 1rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    box-shadow: var(--shadow-soft);
                    font-size: 0.85rem;
                    animation: fadeUp 200ms ease;
                    z-index: 50;
                }

                .inbox-toast.is-error {
                    background: var(--rose-bg);
                    color: var(--error);
                }
            `}</style>
        </div>
    );
};

export default EmailSuggestionsPage;

