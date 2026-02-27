// client/src/pages/EmailSuggestionsPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
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
} from '../services/emailSuggestionsApi';
import { getGoogleConnectUrl } from '../services/googleCalendarApi';

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

function formatCalEventDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso;
    }
}

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
        description: 'Every 15 minutes the server scans your inbox for new unread emails that look like job application responses.',
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const EmailSuggestionsPage: React.FC = () => {
    const [suggestions, setSuggestions] = useState<EmailSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [actionIds, setActionIds] = useState<Set<string>>(new Set());
    const [hasScope, setHasScope] = useState<boolean | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [lookbackDays, setLookbackDays] = useState(14);
    const [defaultProvider, setDefaultProvider] = useState<string | null>(null);
    const [inboxProvider, setInboxProvider] = useState<string | null>(null);
    const [calendarUnchecked, setCalendarUnchecked] = useState<Set<string>>(new Set());
    const [noteAddedLocally, setNoteAddedLocally] = useState<Set<string>>(new Set());

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
            setLookbackDays(prefs.lookbackDays);
            setDefaultProvider(prefs.defaultProvider ?? null);
            setInboxProvider(prefs.inboxProvider ?? null);
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
            const result = await acceptSuggestion(s._id, { includeCalendarEvent });
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
        } catch {
            showToast('Failed to apply suggestion.', 'err');
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        }
    };

    const handleAddNote = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(`note-${s._id}`));
        try {
            await addNoteSuggestion(s._id);
            setNoteAddedLocally((prev) => new Set(prev).add(s._id));
            showToast(`Note added to ${s.matchedCompanyName ?? 'job'}.`);
        } catch {
            showToast('Failed to add note.', 'err');
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(`note-${s._id}`); return n; });
        }
    };

    const handleReject = async (s: EmailSuggestion) => {
        setActionIds((prev) => new Set(prev).add(s._id));
        try {
            await rejectSuggestion(s._id);
            setSuggestions((prev) => prev.filter((x) => x._id !== s._id));
        } catch {
            showToast('Failed to dismiss.', 'err');
        } finally {
            setActionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        }
    };

    const handlePoll = async () => {
        setPolling(true);
        try {
            const result = await pollNow(lookbackDays);
            await load();
            showToast(result.count > 0 ? `Found ${result.count} new suggestion${result.count > 1 ? 's' : ''}!` : 'No new job emails found.');
        } catch {
            showToast('Poll failed — check your Gmail connection.', 'err');
        } finally {
            setPolling(false);
        }
    };

    const handleLookbackDaysChange = async (value: number) => {
        setLookbackDays(value);
        try {
            await updatePreferences({ lookbackDays: value });
        } catch {
            // non-fatal - preference not saved but UI still works
        }
    };

    const handleInboxProviderChange = async (value: string | null) => {
        setInboxProvider(value);
        try {
            const updated = await updatePreferences({ inboxProvider: value ?? '' });
            setInboxProvider(updated.inboxProvider ?? null);
            showToast(
                value
                    ? `Inbox scanning will use ${value} for AI classification.`
                    : 'Inbox scanning will follow your global AI provider setting.'
            );
        } catch {
            showToast('Failed to save provider preference.', 'err');
        }
    };

    const handleConnectGmail = async () => {
        try {
            const url = await getGoogleConnectUrl();
            window.location.href = url;
        } catch {
            showToast('Failed to start Gmail connection.', 'err');
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-12">

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <span style={{ color: 'var(--accent)' }}><InboxIcon /></span>
                        <h1
                            className="text-2xl font-bold tracking-tight"
                            style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
                        >
                            Email Inbox
                        </h1>
                        {suggestions.length > 0 && (
                            <span
                                className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                            >
                                {suggestions.length}
                            </span>
                        )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        AI-detected status changes from your job application emails, ready to review before applying.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <select
                        value={lookbackDays}
                        onChange={(e) => handleLookbackDaysChange(Number(e.target.value))}
                        className="text-xs rounded-lg px-2.5 py-2"
                        style={{
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                        }}
                    >
                        <option value={1}>Last 1 day</option>
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                    <button
                        onClick={handlePoll}
                        disabled={polling}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                            backgroundColor: 'var(--accent)',
                            color: '#000',
                            opacity: polling ? 0.65 : 1,
                        }}
                    >
                        <RefreshIcon spinning={polling} />
                        {polling ? 'Scanning…' : 'Scan inbox'}
                    </button>
                </div>
            </div>

            {/* ── How it works ── */}
            <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                    How it works
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {HOW_IT_WORKS.map((step, i) => (
                        <div key={i} className="flex gap-3">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{ backgroundColor: 'rgba(232,184,68,0.1)', color: 'var(--accent)' }}
                            >
                                <step.icon />
                            </div>
                            <div>
                                <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                                    {step.title}
                                </p>
                                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    className="mt-4 pt-4 flex flex-wrap gap-x-6 gap-y-1.5"
                    style={{ borderTop: '1px solid var(--border)' }}
                >
                    <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Auto-scan:</span> every 15 minutes while server is running
                    </p>
                    <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Matched emails:</span> labelled <code style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, backgroundColor: 'var(--bg-elevated)' }}>job-tracker-processed</code> in Gmail so they're never shown twice
                    </p>
                    <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Privacy:</span> email bodies are only sent to your own configured AI provider
                    </p>
                </div>
            </div>

            {/* ── Privacy & AI provider section ── */}
            {(() => {
                const effectiveProvider = inboxProvider || defaultProvider;
                const isExternal = effectiveProvider === 'gemini' || effectiveProvider === 'openrouter';
                return (
                    <div
                        className="rounded-2xl p-5"
                        style={{
                            backgroundColor: isExternal ? 'rgba(239,68,68,0.04)' : 'var(--bg-surface)',
                            border: isExternal ? '1px solid rgba(239,68,68,0.22)' : '1px solid var(--border)',
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{
                                    backgroundColor: isExternal ? 'rgba(239,68,68,0.1)' : 'rgba(232,184,68,0.1)',
                                    color: isExternal ? '#ef4444' : 'var(--accent)',
                                }}
                            >
                                <ShieldIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                    Privacy &amp; AI provider
                                </p>
                                {isExternal ? (
                                    <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                        Your current AI provider (<strong style={{ color: 'var(--text-secondary)' }}>{effectiveProvider}</strong>) is an external service.
                                        Email subjects and partial body text are sent to that provider’s servers for classification.
                                        For maximum privacy, select <strong style={{ color: 'var(--text-secondary)' }}>Ollama (local)</strong> below to keep all email content on your own machine.
                                    </p>
                                ) : (
                                    <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                        {effectiveProvider === 'ollama'
                                            ? 'Email content is classified by your local Ollama model — nothing leaves your machine.'
                                            : 'Configure which AI provider processes your emails. Choose a local Ollama model to keep email content fully private.'}
                                    </p>
                                )}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <label className="text-[11.5px] font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                        AI provider for inbox:
                                    </label>
                                    <select
                                        value={inboxProvider ?? ''}
                                        onChange={(e) => handleInboxProviderChange(e.target.value || null)}
                                        className="text-xs rounded-lg px-2.5 py-1.5"
                                        style={{
                                            backgroundColor: 'var(--bg-elevated)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border)',
                                        }}
                                    >
                                        <option value="">Follow global setting ({defaultProvider ?? 'none set'})</option>
                                        <option value="ollama">Ollama (local — most private)</option>
                                        <option value="gemini">Gemini</option>
                                        <option value="openrouter">OpenRouter</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {hasScope === false && (
                <div
                    className="rounded-2xl p-5"
                    style={{
                        backgroundColor: 'rgba(251,191,36,0.06)',
                        border: '1px solid rgba(251,191,36,0.25)',
                    }}
                >
                    <div className="flex items-start gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
                        >
                            <MailIcon />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                Gmail access not granted
                            </p>
                            <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-muted)' }}>
                                Your Google account is not connected, or it was connected before this feature was added and needs re-authorisation with Gmail read permissions. Your existing Calendar connection and data will be preserved.
                            </p>
                            <button
                                onClick={handleConnectGmail}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                                style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                            >
                                <LinkIcon />
                                Connect / reconnect Google account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Suggestion list ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                        Pending review
                    </p>
                    {suggestions.length > 0 && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} waiting
                        </p>
                    )}
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div
                            className="w-7 h-7 rounded-full border-2 border-t-transparent"
                            style={{
                                borderColor: 'var(--border)',
                                borderTopColor: 'var(--accent)',
                                animation: 'spin 0.8s linear infinite',
                            }}
                        />
                    </div>
                )}

                {!loading && suggestions.length === 0 && (
                    <div
                        className="rounded-2xl p-10 flex flex-col items-center text-center"
                        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    >
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        >
                            <InboxIcon />
                        </div>
                        <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            All caught up
                        </p>
                        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                            No pending suggestions. Click <strong style={{ color: 'var(--text-secondary)' }}>Scan inbox</strong> above to check for new job emails, or wait for the automatic scan every 15 minutes.
                        </p>
                    </div>
                )}

                {!loading && suggestions.map((s) => {
                    const busy = actionIds.has(s._id);
                    const noteBusy = actionIds.has(`note-${s._id}`);
                    const job = s.jobApplicationId as any;
                    const isCalChecked = !calendarUnchecked.has(s._id);
                    const isNoteAdded = noteAddedLocally.has(s._id);
                    const hasCalEvent = !!s.suggestedCalendarEvent;
                    return (
                        <div
                            key={s._id}
                            className="rounded-2xl p-5"
                            style={{
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                opacity: busy ? 0.5 : 1,
                                transition: 'opacity 150ms',
                            }}
                        >
                            {/* Company / status row */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                    <p className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {s.matchedCompanyName || s.senderName || 'Unknown sender'}
                                    </p>
                                    {s.matchedJobTitle && (
                                        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {s.matchedJobTitle}
                                        </p>
                                    )}
                                </div>
                                {s.suggestedStatus && <StatusPill status={s.suggestedStatus} />}
                            </div>

                            {/* Email subject + snippet */}
                            <div
                                className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-3"
                                style={{ backgroundColor: 'var(--bg-elevated)' }}
                            >
                                <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    <MailIcon />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                        {s.emailSubject}
                                    </p>
                                    <p className="text-[11.5px] mt-1 leading-relaxed line-clamp-3" style={{ color: 'var(--text-muted)' }}>
                                        {s.emailSnippet}
                                    </p>
                                </div>
                            </div>

                            {/* ── Section 2: Note ── */}
                            {s.suggestedNote && (
                                <div
                                    className="rounded-xl px-3.5 py-3 mb-3"
                                    style={{
                                        backgroundColor: 'rgba(232,184,68,0.06)',
                                        border: '1px solid rgba(232,184,68,0.15)',
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                                                <NoteIcon /> AI note
                                            </p>
                                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                {s.suggestedNote}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleAddNote(s)}
                                            disabled={noteBusy || isNoteAdded}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                            style={{
                                                backgroundColor: isNoteAdded ? 'rgba(34,197,94,0.12)' : 'rgba(232,184,68,0.15)',
                                                color: isNoteAdded ? '#22c55e' : 'var(--accent)',
                                                border: `1px solid ${isNoteAdded ? 'rgba(34,197,94,0.3)' : 'rgba(232,184,68,0.3)'}`,
                                                opacity: noteBusy ? 0.6 : 1,
                                                cursor: isNoteAdded ? 'default' : 'pointer',
                                            }}
                                        >
                                            {isNoteAdded ? (<><CheckIcon /> Added to job</>) : noteBusy ? 'Adding…' : 'Add to job notes'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Section 3: Calendar event ── */}
                            {hasCalEvent && (
                                <div
                                    className="rounded-xl px-3.5 py-3 mb-3"
                                    style={{
                                        backgroundColor: hasScope ? 'rgba(59,130,246,0.05)' : 'rgba(150,150,150,0.05)',
                                        border: `1px solid ${hasScope ? 'rgba(59,130,246,0.18)' : 'rgba(150,150,150,0.18)'}`,
                                        opacity: hasScope ? 1 : 0.7,
                                    }}
                                >
                                    <div className="flex items-start gap-3">
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
                                                className="mt-1 shrink-0 cursor-pointer"
                                                style={{ accentColor: '#3b82f6' }}
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold mb-1 flex items-center gap-1.5"
                                                style={{ color: hasScope ? '#3b82f6' : 'var(--text-muted)' }}>
                                                <CalendarIcon />
                                                {hasScope
                                                    ? (isCalChecked ? 'Add to calendar when applied' : 'Skip calendar event')
                                                    : 'Calendar event detected'}
                                                {!hasScope && (
                                                    <button
                                                        onClick={handleConnectGmail}
                                                        className="ml-2 underline text-[11px] font-normal"
                                                        style={{ color: 'var(--accent)' }}
                                                    >
                                                        Connect Google Calendar →
                                                    </button>
                                                )}
                                            </p>
                                            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {s.suggestedCalendarEvent!.title}
                                            </p>
                                            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {formatCalEventDate(s.suggestedCalendarEvent!.dateTimeISO)}
                                            </p>
                                            {s.suggestedCalendarEvent!.description && (
                                                <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                                    {s.suggestedCalendarEvent!.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Match status + actions row */}
                            <div className="flex items-end justify-between gap-3">
                                <div className="text-[11.5px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                                    {job ? (
                                        <p>
                                            Matched to:{' '}
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {job.companyName} — {job.jobTitle}
                                            </span>
                                            {' '}
                                            <span
                                                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ml-1"
                                                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                                            >
                                                currently {job.status}
                                            </span>
                                        </p>
                                    ) : (
                                        <p style={{ color: 'rgba(251,191,36,0.85)' }}>
                                            ⚠ No matching job found
                                        </p>
                                    )}
                                    <p>{CONFIDENCE_LABELS[s.confidence]}</p>
                                </div>

                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => handleReject(s)}
                                        disabled={busy}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors"
                                        style={{
                                            backgroundColor: 'rgba(244,100,100,0.07)',
                                            color: 'var(--rose, #f46464)',
                                            border: '1px solid rgba(244,100,100,0.18)',
                                        }}
                                    >
                                        <XIcon /> Dismiss
                                    </button>
                                    {(s.suggestedStatus || (hasCalEvent && hasScope)) && (
                                        <button
                                            onClick={() => handleAccept(s)}
                                            disabled={busy}
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
                                            style={{
                                                backgroundColor: 'var(--accent)',
                                                color: '#000',
                                            }}
                                        >
                                            <CheckIcon />
                                            {s.suggestedStatus ? 'Apply' : 'Save to calendar'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Toast */}
            {toast && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl whitespace-nowrap"
                    style={{
                        backgroundColor: toast.type === 'err' ? 'rgba(244,100,100,0.12)' : 'var(--bg-elevated)',
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
    );
};

export default EmailSuggestionsPage;
