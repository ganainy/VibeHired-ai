// client/src/pages/InterviewBuddyPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { getJobs, JobApplication } from '../services/jobApi';
import { getGlobalMaterials } from '../services/interviewMaterialsApi';
import { InterviewMaterial } from '../types/interviewMaterial';
import { CVDocument, getCvBranches, getJobCv } from '../services/cvApi';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/common';

const COMPANION_DOWNLOAD_URL: string | null =
  import.meta.env.VITE_COMPANION_DOWNLOAD_URL || null;

//  Feature card data 
const stealth = [
  {
    num: '01',
    title: 'Invisible on taskbar & dock',
    body:
      'Runs in the background without appearing in the Dock or taskbar.',
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
      'Process identity blends in with normal background services.',
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
      'No preview tile appears in Alt/Cmd + Tab while you multitask.',
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
      'Overlay is excluded from Zoom, Teams, and major screen-capture tools.',
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
  { keys: ['Ctrl', 'Shift', 'L'], action: 'Toggle listening' },
  { keys: ['Ctrl', 'Shift', 'Enter'], action: 'Ask AI (2 credits)' },
  { keys: ['Ctrl', 'Shift', 'H'], action: 'Hide / show overlay' },
  { keys: ['Ctrl', 'Shift', 'C'], action: 'Clear the current answer' },
];

function formatMaterialSize(material: InterviewMaterial): string {
  if (typeof material.fileSize === 'number' && material.fileSize > 0) {
    const bytes = material.fileSize;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (typeof material.content === 'string' && material.content.trim()) {
    const approxBytes = material.content.length;
    if (approxBytes < 1024) return `${approxBytes} B (text)`;
    return `${(approxBytes / 1024).toFixed(1)} KB (text)`;
  }

  return 'Size unavailable';
}

//  Component 
const InterviewBuddyPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [jobsLoading, setJobsLoading] = useState(true);
  const [materials, setMaterials] = useState<InterviewMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [cvBranches, setCvBranches] = useState<CVDocument[]>([]);
  const [jobCv, setJobCv] = useState<CVDocument | null>(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [selectedActiveCvId, setSelectedActiveCvId] = useState<string>('');
  const [showReferenceSection, setShowReferenceSection] = useState(false);
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

    getGlobalMaterials()
      .then((data) => {
        setMaterials(data);
      })
      .catch(() => {})
      .finally(() => setMaterialsLoading(false));

    getCvBranches({ lite: true })
      .then((response) => {
        setCvBranches(response.branches || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setJobCv(null);
      setSelectedActiveCvId('');
      setCvLoading(false);
      return;
    }

    setCvLoading(true);
    getJobCv(selectedJobId)
      .then((response) => {
        const nextJobCv = response.cv || null;
        setJobCv(nextJobCv);

        const job = jobs.find((item) => item._id === selectedJobId);
        const defaultCvId = nextJobCv?._id || job?.baseCvId || '';
        setSelectedActiveCvId(defaultCvId);
      })
      .catch(() => {
        setJobCv(null);
        const job = jobs.find((item) => item._id === selectedJobId);
        setSelectedActiveCvId(job?.baseCvId || '');
      })
      .finally(() => setCvLoading(false));
  }, [selectedJobId, jobs]);

  const selectedJob = jobs.find((job) => job._id === selectedJobId);
  const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';
  const selectedJobLanguage = selectedJob?.language ?? 'en';
  const selectedJobLabel = selectedJob
    ? `${selectedJob.jobTitle} at ${selectedJob.companyName}`
    : '';
  const selectedReferenceIdsParam = selectedMaterialIds.join(',');

  const activeCvOptions = [
    ...(jobCv ? [{ value: jobCv._id, label: 'Job CV (saved for this role)' }] : []),
    ...cvBranches
      .filter((cv) => cv._id !== jobCv?._id)
      .map((cv) => ({
        value: cv._id,
        label: cv.displayName || cv.category || 'Unnamed CV',
      })),
  ];

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterialIds((prev) => (
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    ));
  };

  const handleLaunch = () => {
    if (!selectedJobId) return;
    const token = localStorage.getItem('authToken') ?? '';
    const deepLink = `vibehired://launch?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(selectedJobId)}&apiUrl=${encodeURIComponent(apiUrl)}&jobLanguage=${encodeURIComponent(selectedJobLanguage)}&jobLabel=${encodeURIComponent(selectedJobLabel)}&referenceMaterialIds=${encodeURIComponent(selectedReferenceIdsParam)}&activeCvId=${encodeURIComponent(selectedActiveCvId)}`;

    setLaunching(true);
    setCompanionStatus('unknown');

    // Use window.open instead of window.location.href so the current tab's URL
    // is never modified. If window.location.href is used, Chrome may defer the
    // external-protocol permission dialog across page navigations (e.g. an OAuth
    // redirect) and replay it at the next login  making the dialog appear at an
    // unexpected time. Firing the deep link via window.open keeps it scoped to a
    // separate browsing context; the permission prompt appears immediately on
    // this click and is never deferred into the login flow.
    window.open(deepLink, '_blank', 'noopener,noreferrer');

    // If the companion is installed the OS opens it; if not, nothing happens.
    // After 1.5 s with no focus-return we mark it as not-installed and surface
    // the download link.
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

      {/* Mobile-only notice  hidden on sm+ */}
      <div className="sm:hidden flex flex-col items-center justify-center text-center gap-4 py-20">
        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--accent)' }}>computer</span>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Desktop Only</h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          AI Interview Buddy requires the desktop companion app. Please open this page on your PC or Mac to get started.
        </p>
      </div>

      {/* Desktop content  hidden on mobile */}
      <div className="hidden sm:block">

      {/*  Header  */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
            <path d="M19 10a7 7 0 01-14 0" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span>AI Interview Buddy</span>
        </h1>
        <p className="text-base max-w-xl" style={{ color: 'var(--text-secondary)' }}>
          A desktop companion that listens, drafts answers, and shows them in a stealth overlay while you interview.
        </p>
      </div>

      {/*  Stealth feature grid  */}
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

      {/*  Launch panel  */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Get started in 3 steps
        </h2>
        <p className="text-[13px] mb-5" style={{ color: 'var(--text-secondary)' }}>
          Install once, choose context for this launch, then start the companion.
        </p>

        <div className="mb-5 flex items-center flex-wrap gap-2">
          <Badge
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border-0 shadow-none"
            style={{ background: '#e8b844', color: '#0e0e17' }}
          >
            2 Credit
          </Badge>
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            charged each time you press Ask AI (button or Ctrl/Cmd+Shift+Enter); listening and transcription are free.
          </span>
        </div>

        <div
          className="mb-5 rounded-lg p-3"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            AI Context
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
                style={{ background: 'var(--bg-surface)' }}
              />
            ) : jobs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No active job applications found. Add a job first.
              </p>
            ) : (
                <div className="relative">
                  <select
                    id="job-select"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none transition-colors"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                    }}
                    onFocus={(e) => { (e.target as HTMLSelectElement).style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { (e.target as HTMLSelectElement).style.borderColor = 'var(--border)'; }}
                  >
                    {jobs.map((j) => (
                      <option
                        key={j._id}
                        value={j._id}
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        {j.jobTitle}  {j.companyName}
                      </option>
                    ))}
                  </select>
                  <span
                    className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    expand_more
                  </span>
                </div>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="active-cv-select"
              className="block text-[11px] font-black uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Active CV
            </label>
            {cvLoading ? (
              <div
                className="h-10 rounded-lg animate-pulse"
                style={{ background: 'var(--bg-surface)' }}
              />
            ) : activeCvOptions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No CV found. Add or generate a CV first.
              </p>
            ) : (
                <div className="relative">
                  <select
                    id="active-cv-select"
                    value={selectedActiveCvId}
                    onChange={(e) => setSelectedActiveCvId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none transition-colors"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                    }}
                    onFocus={(e) => { (e.target as HTMLSelectElement).style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { (e.target as HTMLSelectElement).style.borderColor = 'var(--border)'; }}
                  >
                    {activeCvOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    expand_more
                  </span>
                </div>
            )}
          </div>

          <div className="mb-2">
            <label
              className="block text-[11px] font-black uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Reference Documents (Prep Library)
            </label>
            <div
              className="rounded-lg"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <button
                type="button"
                onClick={() => setShowReferenceSection((prev) => !prev)}
                className="w-full rounded-lg px-3 py-2.5 text-sm flex items-center justify-between text-left"
                style={{ color: 'var(--text-primary)' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>
                  {selectedMaterialIds.length} attached
                </span>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--text-muted)' }}>
                  {showReferenceSection ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {showReferenceSection && (
                <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--border)' }}>

              {materialsLoading ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Loading Prep Library documents...
                </p>
              ) : materials.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  No Prep Library documents found.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded-md"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      onClick={() => setSelectedMaterialIds(materials.map((m) => m._id))}
                    >
                      Attach all
                    </button>
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded-md"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      onClick={() => setSelectedMaterialIds([])}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                    {materials.map((material) => {
                      const checked = selectedMaterialIds.includes(material._id);
                      return (
                        <label
                          key={material._id}
                          className="flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer"
                          style={{ background: checked ? 'var(--bg-surface)' : 'transparent' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMaterialSelection(material._id)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {material.title}
                            </span>
                            <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {material.type.toUpperCase()} • {formatMaterialSize(material)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
                </div>
              )}
            </div>
          </div>

          <p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Selected data is sent to AI each time you launch and can be changed before any new launch.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Step 1
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {COMPANION_DOWNLOAD_URL ? (
                <>
                  <a
                    href={COMPANION_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                  >
                    Download
                  </a>{' '}
                  and install the companion app (one-time).
                </>
              ) : (
                <>Download and install the companion app (one-time).</>
              )}
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Step 2
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              Set AI context for this run using Active Job, Active CV, and optional reference documents.
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Step 3
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              Click Launch installed companion to start your interview session.
            </p>
          </div>
        </div>

        {/* Install + Launch actions */}
        <div className="flex flex-wrap items-center gap-2">
          {COMPANION_DOWNLOAD_URL ? (
            <a
              href={COMPANION_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download companion app
            </a>
          ) : null}

          <Button
            onClick={handleLaunch}
            disabled={!selectedJobId || launching}
            isLoading={launching}
            icon={!launching ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : undefined}
            className="px-5 py-2.5"
          >
            {launching ? 'Launching' : 'Launch installed companion'}
          </Button>
        </div>
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
              {COMPANION_DOWNLOAD_URL ? ' Download and install it first, then click "Launch installed companion" again.' : ' Start it locally with:'}
            </p>
            {COMPANION_DOWNLOAD_URL ? (
              <div className="flex gap-2 flex-wrap">
                <a
                  href={COMPANION_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
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

      </div>{/* end hidden sm:block desktop wrapper */}
    </div>
  );
};

export default InterviewBuddyPage;

