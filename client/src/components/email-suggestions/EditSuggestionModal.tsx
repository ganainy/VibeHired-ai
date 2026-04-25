// client/src/components/email-suggestions/EditSuggestionModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { EmailSuggestion, EmailCategory, JobStatus, updateSuggestion, type UpdateSuggestionPayload } from '../../services/emailSuggestionsApi';

const toDateTimeLocal = (iso: string | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
import { JobApplication, getJobs } from '../../services/jobApi';

const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const XIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);


const SearchIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return <>{text}</>;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
        if (idx > lastIndex) parts.push(<span key={lastIndex}>{text.slice(lastIndex, idx)}</span>);
        parts.push(
            <span key={idx} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                {text.slice(idx, idx + query.length)}
            </span>
        );
        lastIndex = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, lastIndex);
    }
    if (lastIndex < text.length) parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
    return <>{parts}</>;
};

interface EditSuggestionModalProps {
    suggestion: EmailSuggestion;
    onClose: () => void;
    onSave: (updated: EmailSuggestion) => void;
}

const JOB_STATUS_OPTIONS: { value: JobStatus | null; label: string }[] = [
    { value: null, label: 'No status change' },
    { value: 'Applied', label: 'Applied' },
    { value: 'Not Applied', label: 'Not Applied' },
    { value: 'Interview', label: 'Interview' },
    { value: 'Assessment', label: 'Assessment' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Offer', label: 'Offer' },
];

const EditSuggestionModal: React.FC<EditSuggestionModalProps> = ({ suggestion, onClose, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [jobs, setJobs] = useState<JobApplication[]>([]);
    
    // Form state
    const [matchedCompanyName, setMatchedCompanyName] = useState(suggestion.matchedCompanyName || '');
    const [matchedJobTitle, setMatchedJobTitle] = useState(suggestion.matchedJobTitle || '');
    const [jobApplicationId, setJobApplicationId] = useState<string>(suggestion.jobApplicationId?._id || '');
    const [suggestedStatus, setSuggestedStatus] = useState<JobStatus | null>(suggestion.suggestedStatus);
    const [emailCategory, setEmailCategory] = useState<EmailCategory>(suggestion.emailCategory ?? 'application_response');

    // Calendar event state
    const origCal = suggestion.suggestedCalendarEvent;
    const [calEnabled, setCalEnabled] = useState(!!origCal);
    const [calTitle, setCalTitle] = useState(origCal?.title || '');
    const [calDateTime, setCalDateTime] = useState(toDateTimeLocal(origCal?.dateTimeISO));
    const [calDescription, setCalDescription] = useState(origCal?.description || '');
    const [calNotification, setCalNotification] = useState(origCal?.notificationMinutesBefore ?? 30);

    // Searchable job dropdown
    const [jobSearch, setJobSearch] = useState('');
    const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
    const jobDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target as Node)) {
                setJobDropdownOpen(false);
            }
        };
        if (jobDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [jobDropdownOpen]);

    const filteredJobs = jobs.filter((job) => {
        const label = `${job.companyName} — ${job.jobTitle} (${job.status})`;
        return label.toLowerCase().includes(jobSearch.toLowerCase());
    });

    const selectedJob = jobs.find((j) => j._id === jobApplicationId);
    const selectedLabel = selectedJob
        ? `${selectedJob.companyName} — ${selectedJob.jobTitle} (${selectedJob.status})`
        : '-- No matching job --';

    useEffect(() => {
        const loadJobs = async () => {
            setLoading(true);
            try {
                const jobList = await getJobs();
                setJobs(jobList);
            } catch (err) {
                console.error('Failed to load jobs:', err);
            } finally {
                setLoading(false);
            }
        };
        loadJobs();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        try {
            const payload: UpdateSuggestionPayload = {};
            
            if (matchedCompanyName !== (suggestion.matchedCompanyName || '')) {
                payload.matchedCompanyName = matchedCompanyName || undefined;
            }
            if (matchedJobTitle !== (suggestion.matchedJobTitle || '')) {
                payload.matchedJobTitle = matchedJobTitle || undefined;
            }
            if (jobApplicationId !== (suggestion.jobApplicationId?._id || '')) {
                payload.jobApplicationId = jobApplicationId || null;
            }
            if (suggestedStatus !== suggestion.suggestedStatus) {
                payload.suggestedStatus = suggestedStatus;
            }
            if (emailCategory !== (suggestion.emailCategory ?? 'application_response')) {
                payload.emailCategory = emailCategory;
            }

            const calHasChanged =
                calEnabled !== !!origCal ||
                calTitle !== (origCal?.title || '') ||
                calDateTime !== toDateTimeLocal(origCal?.dateTimeISO) ||
                calDescription !== (origCal?.description || '') ||
                calNotification !== (origCal?.notificationMinutesBefore ?? 30);

            if (calHasChanged) {
                if (!calEnabled) {
                    payload.calendarEvent = null;
                } else {
                    payload.calendarEvent = {
                        title: calTitle,
                        dateTimeISO: calDateTime ? new Date(calDateTime).toISOString() : '',
                        description: calDescription,
                        notificationMinutesBefore: calNotification,
                    };
                }
            }

            // Only send if there are changes
            if (Object.keys(payload).length > 0) {
                const updated = await updateSuggestion(suggestion._id, payload);
                onSave(updated);
            } else {
                onClose();
            }
        } catch (err) {
            console.error('Failed to update suggestion:', err);
            alert('Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={onClose}
        >
            <div 
                className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ 
                    backgroundColor: 'var(--bg-surface)', 
                    border: '1px solid var(--border)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div 
                    className="flex items-center justify-between px-5 py-4"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    <div className="flex items-center gap-2">
                        <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(0,98,65,0.15)', color: 'var(--accent)' }}
                        >
                            <EditIcon />
                        </div>
                        <h2 
                            className="text-lg font-semibold"
                            style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
                        >
                            Edit Suggestion
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Email info - read only */}
                    <div>
                        <label 
                            className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Email
                        </label>
                        <div 
                            className="rounded-lg px-3 py-2 text-sm"
                            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                        >
                            <p className="font-medium">{suggestion.emailSubject}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                {suggestion.senderName || suggestion.senderEmail || 'Unknown sender'}
                            </p>
                        </div>
                    </div>

                    {/* Matched Company Name */}
                    <div>
                        <label 
                            className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Company Name
                        </label>
                        <input
                            type="text"
                            value={matchedCompanyName}
                            onChange={(e) => setMatchedCompanyName(e.target.value)}
                            placeholder="Enter company name"
                            className="w-full rounded-lg px-3 py-2 text-sm"
                            style={{ 
                                backgroundColor: 'var(--bg-elevated)', 
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                            }}
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            The AI-detected company name from the email. Edit if incorrect.
                        </p>
                    </div>

                    {/* Matched Job Title */}
                    <div>
                        <label 
                            className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Job Title
                        </label>
                        <input
                            type="text"
                            value={matchedJobTitle}
                            onChange={(e) => setMatchedJobTitle(e.target.value)}
                            placeholder="Enter job title"
                            className="w-full rounded-lg px-3 py-2 text-sm"
                            style={{ 
                                backgroundColor: 'var(--bg-elevated)', 
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                            }}
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            The AI-detected job title from the email. Edit if incorrect.
                        </p>
                    </div>

                    {/* Job Application Match */}
                    <div>
                        <label 
                            className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Match to Job Application
                        </label>
                        {loading ? (
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading jobs...</div>
                        ) : (
                            <div ref={jobDropdownRef} className="relative">
                                {/* Trigger button */}
                                <button
                                    type="button"
                                    onClick={() => { setJobDropdownOpen((v) => !v); setJobSearch(''); }}
                                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left gap-2"
                                    style={{
                                        backgroundColor: 'var(--bg-elevated)',
                                        color: jobApplicationId ? 'var(--text-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${jobDropdownOpen ? 'var(--accent)' : 'var(--border)'}`,
                                        transition: 'border-color 150ms',
                                    }}
                                >
                                    <span className="truncate flex-1">{selectedLabel}</span>
                                    <span style={{ color: 'var(--text-muted)', flexShrink: 0, rotate: jobDropdownOpen ? '180deg' : '0deg', transition: 'rotate 150ms' }}>
                                        <ChevronDownIcon />
                                    </span>
                                </button>

                                {/* Dropdown panel */}
                                {jobDropdownOpen && (
                                    <div
                                        className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden"
                                        style={{
                                            backgroundColor: 'var(--bg-elevated)',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        }}
                                    >
                                        {/* Search input */}
                                        <div
                                            className="flex items-center gap-2 px-3 py-2"
                                            style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                        >
                                            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><SearchIcon /></span>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={jobSearch}
                                                onChange={(e) => setJobSearch(e.target.value)}
                                                placeholder="Search jobs…"
                                                className="flex-1 text-sm bg-transparent outline-none"
                                                style={{ color: 'var(--text-primary)' }}
                                            />
                                            {jobSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setJobSearch('')}
                                                    className="text-xs"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >✕</button>
                                            )}
                                        </div>

                                        {/* Options list */}
                                        <div className="max-h-52 overflow-y-auto">
                                            {/* Clear / no match option */}
                                            {!jobSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setJobApplicationId(''); setJobDropdownOpen(false); }}
                                                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                                                    style={{
                                                        color: !jobApplicationId ? 'var(--accent)' : 'var(--text-muted)',
                                                        backgroundColor: !jobApplicationId ? 'var(--accent-bg)' : 'transparent',
                                                    }}
                                                >
                                                    -- No matching job --
                                                </button>
                                            )}

                                            {filteredJobs.length === 0 && jobSearch ? (
                                                <div className="px-3 py-3 text-sm italic" style={{ color: 'var(--text-muted)' }}>
                                                    No jobs match &ldquo;{jobSearch}&rdquo;
                                                </div>
                                            ) : (
                                                filteredJobs.map((job) => {
                                                    const label = `${job.companyName} — ${job.jobTitle} (${job.status})`;
                                                    const isSelected = job._id === jobApplicationId;
                                                    return (
                                                        <button
                                                            key={job._id}
                                                            type="button"
                                                            onClick={() => { setJobApplicationId(job._id); setJobDropdownOpen(false); setJobSearch(''); }}
                                                            className="w-full text-left px-3 py-2 text-sm transition-colors"
                                                            style={{
                                                                color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                                                                backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
                                                            }}
                                                            onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                                                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = isSelected ? 'var(--accent-bg)' : 'transparent'; }}
                                                        >
                                                            {highlightMatch(label, jobSearch)}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Select which of your job applications this email relates to.
                        </p>
                    </div>

                    {/* Calendar Event */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                Calendar Event
                            </label>
                            {/* Toggle switch — disabled when suggestion has no calendar event at all */}
                            <button
                                type="button"
                                role="switch"
                                aria-checked={calEnabled}
                                disabled={!origCal}
                                onClick={() => origCal && setCalEnabled((v) => !v)}
                                title={!origCal ? 'No calendar event attached to this suggestion' : undefined}
                                className="relative inline-flex items-center flex-shrink-0 rounded-full transition-colors focus:outline-none"
                                style={{
                                    width: 42,
                                    height: 24,
                                    backgroundColor: !origCal
                                        ? 'var(--border)'
                                        : calEnabled
                                            ? 'var(--accent, #e8b844)'
                                            : 'var(--bg-elevated)',
                                    border: `1px solid ${!origCal ? 'transparent' : calEnabled ? 'transparent' : 'var(--border)'}`,
                                    cursor: !origCal ? 'not-allowed' : 'pointer',
                                    opacity: !origCal ? 0.45 : 1,
                                    transition: 'background-color 200ms',
                                }}
                            >
                                <span
                                    style={{
                                        display: 'block',
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        backgroundColor: calEnabled && origCal ? '#0e0e17' : 'var(--text-muted)',
                                        transform: calEnabled && origCal ? 'translateX(21px)' : 'translateX(3px)',
                                        transition: 'transform 200ms, background-color 200ms',
                                        pointerEvents: 'none',
                                    }}
                                />
                            </button>
                        </div>

                        {calEnabled && (
                            <div
                                className="space-y-3 rounded-xl px-3.5 py-3"
                                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                            >
                                {/* Title */}
                                <div>
                                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Title</label>
                                    <input
                                        type="text"
                                        value={calTitle}
                                        onChange={(e) => setCalTitle(e.target.value)}
                                        placeholder="e.g. Interview at Acme"
                                        className="w-full rounded-lg px-3 py-2 text-sm"
                                        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                    />
                                </div>

                                {/* Date & Time */}
                                <div>
                                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                                        Date &amp; Time
                                        {!calDateTime && <span className="ml-1.5 font-normal" style={{ color: 'rgba(239,68,68,0.85)' }}>— required to add event</span>}
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={calDateTime}
                                        onChange={(e) => setCalDateTime(e.target.value)}
                                        className="w-full rounded-lg px-3 py-2 text-sm"
                                        style={{
                                            backgroundColor: 'var(--bg-base)',
                                            color: calDateTime ? 'var(--text-primary)' : 'var(--text-muted)',
                                            border: `1px solid ${!calDateTime ? 'rgba(239,68,68,0.6)' : 'var(--border)'}`,
                                            colorScheme: 'dark',
                                        }}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
                                    <textarea
                                        value={calDescription}
                                        onChange={(e) => setCalDescription(e.target.value)}
                                        placeholder="Optional notes for the event"
                                        rows={2}
                                        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                                        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                    />
                                </div>

                                {/* Notification */}
                                <div>
                                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notify before (minutes)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={10080}
                                        value={calNotification}
                                        onChange={(e) => setCalNotification(Math.max(0, Number(e.target.value)))}
                                        className="w-full rounded-lg px-3 py-2 text-sm"
                                        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                                    />
                                </div>
                            </div>
                        )}

                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {calEnabled
                                ? 'Event will be created in Google Calendar when you click Apply.'
                                : 'No calendar event will be created for this suggestion.'}
                        </p>
                    </div>

                    {/* Email Category */}
                    <div>
                        <label
                            className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Email Type
                        </label>
                        <div className="flex gap-2">
                            {(['application_response', 'job_offer'] as EmailCategory[]).map((cat) => {
                                const isActive = emailCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setEmailCategory(cat)}
                                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                        style={{
                                            backgroundColor: isActive ? 'rgba(0,98,65,0.12)' : 'var(--bg-elevated)',
                                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                            border: `1px solid ${isActive ? 'rgba(0,98,65,0.35)' : 'var(--border)'}`,
                                        }}
                                    >
                                        {cat === 'application_response' ? 'Application' : 'Job Lead'}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {emailCategory === 'application_response'
                                ? 'A response to a job you applied for.'
                                : 'A proactive outreach or job offer email.'}
                        </p>
                    </div>

                    {/* Suggested Status */}
                    <div>
                        <label 
                            className="text-xs font-semibold uppercase tracking-wider mb-2 block"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Suggested Status
                        </label>
                        <select
                            value={suggestedStatus || ''}
                            onChange={(e) => setSuggestedStatus(e.target.value as JobStatus || null)}
                            className="w-full rounded-lg px-3 py-2 text-sm"
                            style={{ 
                                backgroundColor: 'var(--bg-elevated)', 
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                            }}
                        >
                            {JOB_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.label} value={opt.value || ''}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            The status that will be applied when you click "Apply".
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                            style={{ 
                                backgroundColor: 'var(--bg-elevated)', 
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                            style={{ 
                                backgroundColor: 'var(--accent)', 
                                color: '#000',
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditSuggestionModal;
