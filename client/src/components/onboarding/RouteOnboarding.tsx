import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, ChevronRight, HelpCircle, X } from 'lucide-react';

/* ─── Storage key prefix ─────────────────────────────────────────────────── */
const GUIDE_SHOWN_PREFIX = 'guide_shown_';

/* ─── Per-page guide config ──────────────────────────────────────────────── */
type PageGuide = {
    key: string;
    match: (pathname: string) => boolean;
    title: string;
    description: string;
    features: string[];
};

const PAGE_GUIDES: PageGuide[] = [
    {
        key: 'dashboard',
        match: (p) => p === '/dashboard',
        title: 'Job Dashboard',
        description: 'Your central hub for tracking every job application and its current status at a glance.',
        features: [
            'Add jobs manually or by pasting a job description',
            'Track application stages from Applied through to Offer',
            'Spot follow-up actions with at-a-glance status badges',
            'Click any job to open its full review workspace',
        ],
    },
    {
        key: 'manage-cv',
        match: (p) => p.startsWith('/manage-cv'),
        title: 'CV Workspace',
        description: 'Create and maintain your base CV and tailored role-specific variants.',
        features: [
            'Build a structured base CV with a rich editor',
            'Generate role-specific tailored variants with AI',
            'Import from an existing PDF or paste plain text',
            'Export or copy finals ready for applications',
        ],
    },
    {
        key: 'email-suggestions',
        match: (p) => p.startsWith('/email-suggestions'),
        title: 'Inbox Assistant',
        description: 'Review AI-extracted suggestions from your job-related emails before applying them.',
        features: [
            'Scan your inbox with one click to fetch updates',
            'Review each suggestion before applying it',
            'Approve, edit, or dismiss with full control',
            'Suggestions automatically link to existing jobs',
        ],
    },
    {
        key: 'analytics',
        match: (p) => p.startsWith('/analytics'),
        title: 'Analytics',
        description: 'Visualise your job search performance with pipeline charts and trend metrics.',
        features: [
            'Pipeline funnel showing stage-by-stage conversion',
            'Application response rate and reply timing trends',
            'Activity volume over a rolling time window',
            'Identify bottlenecks to sharpen your strategy',
        ],
    },
    {
        key: 'calendar',
        match: (p) => p.startsWith('/calendar'),
        title: 'Schedule',
        description: 'Manage interviews, reminders, and follow-up deadlines in one unified timeline.',
        features: [
            'View upcoming interviews and key deadlines at a glance',
            'Create events linked to specific job applications',
            'Set reminders so you never miss a follow-up',
            'Sync with external calendar services',
        ],
    },
    {
        key: 'work-tracker',
        match: (p) => p.startsWith('/work-tracker'),
        title: 'Work Tracker',
        description: 'Log time blocks and appointments to keep your job search activity measurable.',
        features: [
            'Record shifts, appointments, and work sessions',
            'Organise entries by employer and appointment type',
            'View weekly and monthly activity summaries',
            'Review and export your time logs at any point',
        ],
    },
    {
        key: 'interview-materials',
        match: (p) => p.startsWith('/interview-materials'),
        title: 'Interview Prep Library',
        description: 'Store notes, links, and documents to prepare for interviews efficiently.',
        features: [
            'Add notes, Markdown documents, and useful links',
            'Organise materials per job or interview round',
            'Toggle pinning to keep must-reads at the top',
            'Archive materials after interviews are complete',
        ],
    },
    {
        key: 'settings',
        match: (p) => p.startsWith('/settings'),
        title: 'App Settings',
        description: 'Configure your integrations, AI prompts, and application-wide preferences.',
        features: [
            'Add API keys for AI and email integrations',
            'Customise default prompts for tailored AI outputs',
            'Manage automation and notification preferences',
            'Connect or disconnect external services',
        ],
    },
    {
        key: 'subscriptions',
        match: (p) => p.startsWith('/subscriptions'),
        title: 'Plans & Billing',
        description: 'Manage your subscription plan, credit balance, and billing details.',
        features: [
            'View your current credit balance and usage breakdown',
            'Compare available plans and feature limits',
            'Upgrade, downgrade, or cancel your subscription',
            'Access billing history and download invoices',
        ],
    },
    {
        key: 'portfolio-setup',
        match: (p) => p.startsWith('/portfolio-setup'),
        title: 'Portfolio Setup',
        description: 'Build and publish a professional portfolio profile to share with employers.',
        features: [
            'Connect project sources and add curated work samples',
            'Customise your profile bio and display name',
            'Control visibility settings before publishing',
            'Share a direct link to your live portfolio',
        ],
    },
    {
        key: 'auto-jobs',
        match: (p) => p.startsWith('/auto-jobs'),
        title: 'Auto Jobs',
        description: 'Automatically discover and import matching job listings from LinkedIn based on your saved preferences.',
        features: [
            'Configure keywords, location, job type, and experience level',
            'Run automated LinkedIn job scraping with one click',
            'Review AI-scored matches and spot the best fits instantly',
            'Promote matching jobs straight to your main dashboard',
        ],
    },
    {
        key: 'interview-buddy',
        match: (p) => p.startsWith('/interview-buddy'),
        title: 'Interview Buddy',
        description: 'A stealth AI companion that transcribes interview questions and surfaces structured answers in real time.',
        features: [
            'Install the companion app once — runs silently on your machine',
            'Fully invisible on screen share, taskbar, and task manager',
            'Hold Ctrl+Shift+Space to capture the interviewer\'s question',
            'AI-generated answer appears in a floating overlay only you can see',
        ],
    },
];

/* ─── Component ──────────────────────────────────────────────────────────── */
const RouteOnboarding: React.FC = () => {
    const location = useLocation();
    const [open, setOpen] = useState(false);

    const guide = PAGE_GUIDES.find((g) => g.match(location.pathname));

    // Auto-open once on the very first visit to each route.
    // setOpen(false) on every route change so the panel closes when navigating
    // away, and only re-opens automatically on a page that hasn't been seen yet.
    useEffect(() => {
        if (!guide) return;
        const seenKey = `${GUIDE_SHOWN_PREFIX}${guide.key}`;
        try {
            if (localStorage.getItem(seenKey) === 'true') {
                setOpen(false);
                return;
            }
        } catch {
            // ignore localStorage errors
        }
        // Mark as seen only when the panel actually opens (inside the timeout),
        // to avoid counting routes that were navigated away from in < 600 ms.
        const timer = window.setTimeout(() => {
            try {
                localStorage.setItem(seenKey, 'true');
            } catch {
                // ignore localStorage errors
            }
            setOpen(true);
        }, 600);
        return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guide?.key]);

    if (!guide) return null;

    return (
        <>
            {/* ── Floating help FAB ─────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-[1200] flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
                style={{
                    background: 'var(--accent)',
                    color: 'var(--bg-base)',
                    border: '1.5px solid var(--accent-dim)',
                }}
                aria-label="Open page guide"
                title="Page guide"
            >
                <HelpCircle size={18} />
            </button>

            {/* ── Backdrop ─────────────────────────────────────────────────── */}
            <div
                className={`fixed inset-0 z-[1300] transition-opacity duration-300 ${
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                style={{ background: 'rgba(0,0,0,0.3)' }}
                onClick={() => setOpen(false)}
                aria-hidden="true"
            />

            {/* ── Slide-in guide panel ──────────────────────────────────────── */}
            <div
                className="fixed right-0 top-0 h-full z-[1400] flex flex-col transition-transform duration-300 ease-out"
                style={{
                    width: 'min(360px, 90vw)',
                    background: 'var(--bg-elevated)',
                    borderLeft: '1px solid var(--border)',
                    boxShadow: '-6px 0 32px rgba(0,0,0,0.15)',
                    transform: open ? 'translateX(0)' : 'translateX(100%)',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={`${guide.title} guide`}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Page Guide
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close guide"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 flex flex-col gap-5">
                    {/* Title + description */}
                    <div>
                        <h2
                            className="text-base font-semibold mb-1.5"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {guide.title}
                        </h2>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {guide.description}
                        </p>
                    </div>

                    {/* Feature bullets */}
                    <div>
                        <p
                            className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Key Features
                        </p>
                        <ul className="flex flex-col gap-2.5">
                            {guide.features.map((feature, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-2.5 text-sm"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    <ChevronRight
                                        size={14}
                                        className="mt-0.5 shrink-0"
                                        style={{ color: 'var(--accent)' }}
                                    />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

                {/* Footer */}
                <div
                    className="px-5 py-3.5 shrink-0"
                    style={{ borderTop: '1px solid var(--border)' }}
                >
                    <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        Tap the
                        <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
                            style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
                        >
                            <HelpCircle size={10} />
                        </span>
                        button any time to reopen this guide.
                    </p>
                </div>
            </div>
        </>
    );
};

export default RouteOnboarding;




