// client/src/pages/InterviewBuddyPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { getJobs, JobApplication } from '../services/jobApi';

const COMPANION_DOWNLOAD_URL: string | null =
  import.meta.env.VITE_COMPANION_DOWNLOAD_URL || null;

// ── Feature card data ─────────────────────────────────────────────────────────
const stealth = [
  {
    num: '01',
    title: 'Invisible on taskbar & dock',
    body:
      'No presence on macOS Dock or Windows taskbar — the session runs as a background utility so nothing shows up next to the apps you are sharing.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Invisible in task manager',
    body:
      'The process is aliased so it blends in with routine background services inside Activity Monitor or Task Manager.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Invisible on tab switch',
    body:
      'Alt/Cmd + Tab never reveals the overlay — there is no preview tile or highlighted window while you keep multitasking.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Invisible on screen share',
    body:
      'The answer overlay is excluded from Zoom, Teams, and any screen-capture tool at the OS level using display affinity APIs — your interviewer never sees it.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
];

const hotkeys = [
  { keys: ['Ctrl', 'Shift', 'Space'], action: 'Toggle microphone listening' },
  { keys: ['Ctrl', 'Shift', 'H'], action: 'Hide / show the answer overlay' },
  { keys: ['Ctrl', 'Shift', 'C'], action: 'Clear the current answer' },
];

// ── Component ─────────────────────────────────────────────────────────────────
const InterviewBuddyPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [jobsLoading, setJobsLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [companionStatus, setCompanionStatus] = useState<'unknown' | 'available' | 'not-installed'>('unknown');
  const launchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getJobs()
      .then((data) => {
        const active = data.filter((j) => j.status !== 'Rejected' && j.status !== 'Closed');
        setJobs(active);
        if (active.length > 0) setSelectedJobId(active[0]._id);
      })
      .catch(() => {})
      .finally(() => setJobsLoading(false));
  }, []);

  const selectedJob = jobs.find((j) => j._id === selectedJobId);

  const handleLaunch = () => {
    if (!selectedJobId) return;
    const token = localStorage.getItem('authToken') ?? '';
    const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';
    const deepLink = `vibehired://launch?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(selectedJobId)}&apiUrl=${encodeURIComponent(apiUrl)}`;

    setLaunching(true);
    setCompanionStatus('unknown');
    window.location.href = deepLink;

    // If the companion is installed the OS opens it; if not, nothing happens and
    // the tab stays open. After 1.5 s with no navigation-away we mark it as
    // not-installed and surface the download link.
    launchTimeoutRef.current = setTimeout(() => {
      setLaunching(false);
      setCompanionStatus('not-installed');
    }, 1500);
  };

  // If page focus returns quickly after the deep-link fires, count as available.
  useEffect(() => {
    const onFocus = () => {
      if (launching) {
        if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
        setLaunching(false);
        setCompanionStatus('available');
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [launching]);

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto" style={{ color: 'var(--text-primary)' }}>

      {/* ── Header ── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
              <path d="M19 10a7 7 0 01-14 0" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <span
            className="text-[11px] font-black uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
          >
            Admin Preview
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          AI Interview Buddy
        </h1>
        <p className="text-base max-w-xl" style={{ color: 'var(--text-secondary)' }}>
          A stealth desktop companion that listens to your interviewer, then shows AI-generated answers
          in an overlay that is <strong style={{ color: 'var(--text-primary)' }}>completely invisible</strong> to
          Zoom, Teams, and any screen-capture tool.
        </p>
      </div>

      {/* ── Stealth feature grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {stealth.map((f) => (
          <div
            key={f.num}
            className="rounded-xl p-5 flex gap-4"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div>
              <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                {f.num}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                {f.title}
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {f.body}
              </p>
            </div>
            <div className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {f.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Hotkeys ── */}
      <div
        className="rounded-xl p-5 mb-10"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="13" rx="2" />
            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
          </svg>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            OS-Level Hotkey Registration
          </span>
        </div>
        <p className="text-[13px] mb-4" style={{ color: 'var(--text-secondary)' }}>
          Hotkeys are registered at the operating-system level using global shortcuts, not browser listeners.
          Keystrokes never propagate to websites or web apps, making them invisible to browsers,
          screen-sharing tools, and online detection systems.
        </p>
        <div className="space-y-2">
          {hotkeys.map((hk) => (
            <div key={hk.action} className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {hk.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-bright)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {hk.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Launch panel ── */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Launch a session
        </h2>
        <p className="text-[13px] mb-5" style={{ color: 'var(--text-secondary)' }}>
          Select the job you are interviewing for. The companion will use the job description and your
          prep materials to craft tailored answers.
        </p>

        {/* Job selector */}
        <div className="mb-4">
          <label
            htmlFor="job-select"
            className="block text-[11px] font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Active Job
          </label>
          {jobsLoading ? (
            <div
              className="h-10 rounded-lg animate-pulse"
              style={{ background: 'var(--bg-elevated)' }}
            />
          ) : jobs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No active job applications found. Add a job first.
            </p>
          ) : (
            <select
              id="job-select"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => { (e.target as HTMLSelectElement).style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { (e.target as HTMLSelectElement).style.borderColor = 'var(--border)'; }}
            >
              {jobs.map((j) => (
                <option
                  key={j._id}
                  value={j._id}
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {j.jobTitle} — {j.companyName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={!selectedJobId || launching}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150"
          style={{
            background: selectedJobId && !launching ? 'var(--accent)' : 'var(--bg-elevated)',
            color: selectedJobId && !launching ? '#0e0e17' : 'var(--text-muted)',
            cursor: selectedJobId && !launching ? 'pointer' : 'not-allowed',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            if (selectedJobId && !launching)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            if (selectedJobId && !launching)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
          }}
        >
          {launching ? (
            <>
              <span
                className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--text-muted)', borderTopColor: 'var(--text-primary)' }}
              />
              Launching…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Launch Interview Buddy
            </>
          )}
        </button>

        {/* Status feedback */}
        {companionStatus === 'available' && (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
            style={{ background: 'var(--jade-bg)', border: '1px solid rgba(45,212,160,0.2)', color: 'var(--jade)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Companion launched successfully. The overlay is now running.
          </div>
        )}

        {companionStatus === 'not-installed' && (
          <div
            className="mt-4 rounded-lg px-4 py-4"
            style={{ background: 'var(--ember-bg)', border: '1px solid rgba(240,126,56,0.2)' }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ember)' }}>
              Companion app not detected
            </p>
            <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>
              The Interview Buddy overlay requires the companion desktop app to be running.
              {COMPANION_DOWNLOAD_URL ? ' Download and install it, then click Launch again.' : ' Start it locally with:'}
            </p>
            {COMPANION_DOWNLOAD_URL ? (
              <div className="flex gap-2 flex-wrap">
                <a
                  href={COMPANION_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'var(--accent)', color: '#0e0e17' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download for Windows / macOS
                </a>
              </div>
            ) : (
              <code
                className="block text-xs px-3 py-2 rounded-md mb-3"
                style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--accent)', fontFamily: 'monospace' }}
              >
                cd electron &amp;&amp; npm run dev
              </code>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleLaunch}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="mt-8 mb-2">
        <h2 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
          How it works
        </h2>
        <ol className="space-y-3">
          {[
            'Install the companion app on your machine (one-time setup).',
            'Click "Launch Interview Buddy" and select the job you are interviewing for.',
            `Press ${navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}+Shift+Space to start listening — the mic icon lights up.`,
            'The interviewer asks a question. The companion transcribes it in real time.',
            'After a brief pause, a structured answer appears in the floating overlay — only visible to you.',
            'Read the answer naturally. Press Ctrl+Shift+C to clear and get ready for the next question.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="shrink-0 font-mono font-bold text-[11px] w-5 h-5 rounded flex items-center justify-center mt-0.5"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default InterviewBuddyPage;
