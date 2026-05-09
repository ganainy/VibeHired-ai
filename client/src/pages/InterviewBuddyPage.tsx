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

/* ─── Icons (inline SVGs) ─── */
const IconMic = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
    <path d="M19 10a7 7 0 01-14 0" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const IconLock = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const IconEyeOff = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconChevronRight = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconAlert = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconRocket = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconDownload = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconCheck = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconBolt = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconKeyboard = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
  </svg>
);

const IconAnalytics = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const IconTask = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/* ─── Feature data ─── */
const bentoCards = [
  {
    title: 'Invisible Everywhere',
    body: 'Hidden mode ensures no icons in the taskbar, dock, or active windows. Your screen stays completely private.',
    icon: <IconEyeOff className="text-[#00754A]" />,
    accent: 'border-l-4 border-[#00754A]',
    bg: 'bg-white',
    span: 'md:col-span-7',
  },
  {
    title: 'Instant Setup',
    body: 'Launch in under 10 seconds with no complex installations. Ready when you are.',
    icon: <IconBolt className="text-[#00754A]" />,
    accent: '',
    bg: 'bg-[#D4E9E2]',
    span: 'md:col-span-5',
  },
  {
    title: 'Global Shortcuts',
    body: 'Summon or hide with custom key bindings. Full control at your fingertips without touching the mouse.',
    icon: <IconKeyboard className="text-[#00754A]" />,
    accent: '',
    bg: 'bg-[#EDEBE9]',
    span: 'md:col-span-5',
  },
  {
    title: 'Contextual Intelligence',
    body: 'AI maps your CV against job descriptions to surface relevant talking points in real time.',
    icon: <IconAnalytics className="text-[#00754A]" />,
    accent: 'border-l-4 border-[#00754A]',
    bg: 'bg-white',
    span: 'md:col-span-7',
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

/* ─── Component ─── */
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
        const active = data.jobs.filter((j) => j.status !== 'Rejected' && j.status !== 'Closed');
        setJobs(active);
        if (active.length > 0) setSelectedJobId(active[0]._id);
      })
      .catch(() => {})
      .finally(() => setJobsLoading(false));

    getGlobalMaterials()
      .then((data) => setMaterials(data))
      .catch(() => {})
      .finally(() => setMaterialsLoading(false));

    getCvBranches({ lite: true })
      .then((response) => setCvBranches(response.branches || []))
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
  const selectedJobLabel = selectedJob ? `${selectedJob.jobTitle} at ${selectedJob.companyName}` : '';
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
    setSelectedMaterialIds((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleLaunch = () => {
    if (!selectedJobId) return;
    const token = localStorage.getItem('authToken') ?? '';
    const deepLink = `vibehired://launch?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(selectedJobId)}&apiUrl=${encodeURIComponent(apiUrl)}&jobLanguage=${encodeURIComponent(selectedJobLanguage)}&jobLabel=${encodeURIComponent(selectedJobLabel)}&referenceMaterialIds=${encodeURIComponent(selectedReferenceIdsParam)}&activeCvId=${encodeURIComponent(selectedActiveCvId)}`;

    setLaunching(true);
    setCompanionStatus('unknown');
    window.open(deepLink, '_blank', 'noopener,noreferrer');

    launchTimeoutRef.current = setTimeout(() => {
      setLaunching(false);
      setCompanionStatus('not-installed');
    }, 1500);
  };

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

  /* ─── Render helpers ─── */
  const selectBaseClasses =
    'w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none transition-colors appearance-none bg-[#F2F0EB] border border-[#E0E3DE] text-[rgba(0,0,0,0.87)] focus:border-[#00754A] focus:ring-1 focus:ring-[#00754A]';

  return (
    <div className="min-h-screen bg-[#F2F0EB] font-['Manrope',sans-serif] tracking-tight pb-20">
      {/* ── Hero ── */}
      <header className="max-w-[1440px] mx-auto pt-10 px-5 md:px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="md:w-3/5">
            <div className="flex items-center gap-2 mb-3">
              <IconMic className="text-[#00754A]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#00754A]">
                Desktop Companion
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#006241] mb-3 tracking-tighter leading-[1.1]">
              AI Interview Buddy
            </h1>
            <p className="text-base md:text-lg text-[rgba(0,0,0,0.58)] max-w-xl leading-relaxed">
              Your silent co-pilot for high-stakes interviews. Confidence delivered in a sleek, non-intrusive companion app.
            </p>
            <div className="mt-5">
              <button
                onClick={handleLaunch}
                disabled={!selectedJobId || launching}
                className="inline-flex items-center justify-center gap-2 h-[50px] px-6 rounded-full bg-[#00754A] text-white text-sm font-bold shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {launching ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <IconRocket />
                    Launch installed companion
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Decorative stat blocks instead of image */}
          <div className="md:w-2/5 w-full">
            <div className="bg-[#D4E9E2] rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)] rotate-1 max-w-[360px] ml-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-2xl font-extrabold text-[#006241]">&lt;10s</p>
                  <p className="text-[11px] text-[rgba(0,0,0,0.58)] font-medium mt-1">Launch time</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-2xl font-extrabold text-[#006241]">0</p>
                  <p className="text-[11px] text-[rgba(0,0,0,0.58)] font-medium mt-1">Taskbar icons</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center col-span-2">
                  <p className="text-2xl font-extrabold text-[#006241]">Stealth Mode</p>
                  <p className="text-[11px] text-[rgba(0,0,0,0.58)] font-medium mt-1">Invisible to screen share &amp; task switch</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 3-Step Quick Setup ── */}
      <section className="max-w-[1440px] mx-auto mt-10 px-5 md:px-6">
        <div className="bg-white rounded-xl p-6 shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-2 mb-5">
            <IconTask className="text-[#00754A]" />
            <h2 className="text-xl font-bold text-[#006241]">3-Step Quick Setup</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="space-y-2 border-l-2 border-[#D4E9E2] pl-4">
              <span className="text-[10px] text-[#00754A] font-bold uppercase tracking-[0.2em]">Step 01</span>
              <h3 className="font-semibold text-sm text-[rgba(0,0,0,0.87)]">Select Active Job</h3>
              {jobsLoading ? (
                <div className="h-11 bg-[#F2F0EB] rounded-lg animate-pulse" />
              ) : jobs.length === 0 ? (
                <p className="text-sm text-[rgba(0,0,0,0.58)]">No active jobs found.</p>
              ) : (
                <div className="relative">
                  <select
                    id="job-select"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className={selectBaseClasses}
                  >
                    {jobs.map((j) => (
                      <option key={j._id} value={j._id}>
                        {j.jobTitle} — {j.companyName}
                      </option>
                    ))}
                  </select>
                  <label className="absolute left-3 top-0.5 text-[9px] font-bold text-[#00754A] uppercase tracking-wider">
                    Active Job
                  </label>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6F7A72] text-lg">
                    expand_more
                  </span>
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div className="space-y-2 border-l-2 border-[#D4E9E2] pl-4">
              <span className="text-[10px] text-[#00754A] font-bold uppercase tracking-[0.2em]">Step 02</span>
              <h3 className="font-semibold text-sm text-[rgba(0,0,0,0.87)]">Select Active CV</h3>
              {cvLoading ? (
                <div className="h-11 bg-[#F2F0EB] rounded-lg animate-pulse" />
              ) : activeCvOptions.length === 0 ? (
                <p className="text-sm text-[rgba(0,0,0,0.58)]">No CVs found.</p>
              ) : (
                <div className="relative">
                  <select
                    id="active-cv-select"
                    value={selectedActiveCvId}
                    onChange={(e) => setSelectedActiveCvId(e.target.value)}
                    className={selectBaseClasses}
                  >
                    {activeCvOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="absolute left-3 top-0.5 text-[9px] font-bold text-[#00754A] uppercase tracking-wider">
                    Active CV
                  </label>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6F7A72] text-lg">
                    expand_more
                  </span>
                </div>
              )}
            </div>

            {/* Step 3 */}
            <div className="space-y-2 border-l-2 border-[#D4E9E2] pl-4">
              <span className="text-[10px] text-[#00754A] font-bold uppercase tracking-[0.2em]">Step 03</span>
              <h3 className="font-semibold text-sm text-[rgba(0,0,0,0.87)]">Launch &amp; Excel</h3>
              <button
                onClick={handleLaunch}
                disabled={!selectedJobId || launching}
                className="w-full h-11 bg-[#006241] text-white rounded-full text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg">rocket_launch</span>
                Ready to Start
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reference Documents (Prep Library) ── */}
      <section className="max-w-[1440px] mx-auto mt-6 px-5 md:px-6">
        <div className="bg-white rounded-xl p-6 shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)]">
          <button
            type="button"
            onClick={() => setShowReferenceSection((prev) => !prev)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-sm font-bold text-[rgba(0,0,0,0.87)]">Reference Documents (Prep Library)</h3>
              <p className="text-[12px] text-[rgba(0,0,0,0.58)] mt-0.5">
                {selectedMaterialIds.length} attached · Optional context for AI answers
              </p>
            </div>
            <span className="material-symbols-outlined text-[#6F7A72] text-lg">
              {showReferenceSection ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showReferenceSection && (
            <div className="mt-4 pt-4 border-t border-[#E0E3DE]">
              {materialsLoading ? (
                <p className="text-[13px] text-[rgba(0,0,0,0.58)]">Loading Prep Library documents…</p>
              ) : materials.length === 0 ? (
                <p className="text-[13px] text-[rgba(0,0,0,0.58)]">No Prep Library documents found.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialIds(materials.map((m) => m._id))}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-[#F2F0EB] text-[rgba(0,0,0,0.87)] font-semibold hover:bg-[#E0E3DE] transition-colors"
                    >
                      Attach all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialIds([])}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-[#F2F0EB] text-[rgba(0,0,0,0.87)] font-semibold hover:bg-[#E0E3DE] transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {materials.map((material) => {
                      const checked = selectedMaterialIds.includes(material._id);
                      return (
                        <label
                          key={material._id}
                          className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                            checked ? 'bg-[#D4E9E2]/40' : 'hover:bg-[#F2F0EB]/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMaterialSelection(material._id)}
                            className="mt-0.5 accent-[#00754A]"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium truncate text-[rgba(0,0,0,0.87)]">
                              {material.title}
                            </span>
                            <span className="block text-[11px] text-[rgba(0,0,0,0.58)]">
                              {material.type.toUpperCase()} · {formatMaterialSize(material)}
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
      </section>

      {/* ── Hotkeys ── */}
      <section className="max-w-[1440px] mx-auto mt-6 px-5 md:px-6">
        <div className="bg-white rounded-xl p-6 shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-2 mb-4">
            <IconKeyboard className="text-[#00754A]" />
            <h2 className="text-lg font-bold text-[#006241]">Global Shortcuts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hotkeys.map((hk) => (
              <div
                key={hk.action}
                className="flex items-center justify-between rounded-lg px-4 py-3 bg-[#F9F9F9] border border-[#E0E3DE]"
              >
                <span className="text-sm text-[rgba(0,0,0,0.87)] font-medium">{hk.action}</span>
                <div className="flex items-center gap-1">
                  {hk.keys.map((k, i) => (
                    <React.Fragment key={k}>
                      <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md bg-white border border-[#BEC9C0] text-[11px] font-bold text-[rgba(0,0,0,0.87)] shadow-sm">
                        {k}
                      </kbd>
                      {i < hk.keys.length - 1 && (
                        <span className="text-[rgba(0,0,0,0.38)] text-xs mx-0.5">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Bento Grid ── */}
      <section className="bg-[#1E3932] text-white py-10 mt-10">
        <div className="max-w-[1440px] mx-auto px-5 md:px-6">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-white mb-6">
            Engineered for Stealth.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {bentoCards.map((card) => (
              <div
                key={card.title}
                className={`${card.span} ${card.bg} ${card.accent} rounded-xl p-5 shadow-[0_2px_4px_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.24)] flex flex-col gap-2`}
              >
                <div className="mb-1">{card.icon}</div>
                <h3 className="font-bold text-lg text-[#006241]">{card.title}</h3>
                <p className="text-sm text-[rgba(0,0,0,0.58)] leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default InterviewBuddyPage;
