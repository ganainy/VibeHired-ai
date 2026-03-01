// client/src/pages/WorkTrackerPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  CalendarDays,
  Trash2,
  Pencil,
  X,
  Upload,
  AlertCircle,
  Timer,
  Briefcase,
  MapPin,
  Check,
  Sparkles,
  FileText,
  Mic,
} from 'lucide-react';
import {
  getEntries,
  getStats,
  createEntry,
  updateEntry,
  deleteEntry,
  createReminder,
  parseSchedule,
  confirmScheduleImport,
  getAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  PopulatedAppointmentType,
  WorkEntry,
  WorkTrackerStats,
  WorkEntryType,
  WorkEntryStatus,
  CreateWorkEntryPayload,
  parseMagicPrompt,
} from '../services/workTrackerApi';
import {
  getEmployers,
  createEmployer,
  updateEmployer,
  deleteEmployer,
  addSubLocation,
  updateSubLocation,
  deleteSubLocation,
  Employer,
  SubLocation,
} from '../services/employerApi';
import Spinner from '../components/common/Spinner';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function padZero(n: number) {
  return n.toString().padStart(2, '0');
}

function formatDate(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function computePreviewHours(startTime: string, endTime: string, breakMins: number = 0): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  const totalMins = Math.max(0, (endMins - startMins) - breakMins);
  return Math.round((totalMins / 60) * 100) / 100;
}

function groupEntriesByDate(entries: WorkEntry[]): Map<string, WorkEntry[]> {
  const map = new Map<string, WorkEntry[]>();
  for (const entry of entries) {
    const key = entry.date.split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const EmployerAvatar: React.FC<{ employer: { name: string; logoUrl?: string | null }; size?: number }> = ({
  employer,
  size = 32,
}) => {
  const initials = employer.name.slice(0, 2).toUpperCase();
  if (employer.logoUrl) {
    return (
      <img
        src={employer.logoUrl}
        alt={employer.name}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        color: 'var(--accent)',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

const EmployerSelect = ({
  employers,
  value,
  onChange,
  disabled
}: {
  employers: Employer[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selected = employers.find((e) => e._id === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        className={`input-base w-full flex items-center justify-between transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        style={{ padding: '8px 12px', textAlign: 'left', minHeight: '40px' }}
      >
        {selected ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <EmployerAvatar employer={selected} size={20} />
            <span className="truncate" style={{ color: 'var(--text-primary)' }}>{selected.name}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Select employer…</span>
        )}
        <svg
          className={`w-4 h-4 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'transform rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute z-50 w-full mt-1 border rounded-lg shadow-xl overflow-y-auto max-h-60"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
        >
          {employers.length === 0 ? (
            <div className="px-3 py-3 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              No employers found
            </div>
          ) : (
            <div className="py-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                onClick={() => { onChange(''); setIsOpen(false); }}
              >
                <div style={{ width: 20, height: 20 }} className="flex-shrink-0" />
                <span className="truncate flex-1" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Select employer…</span>
              </button>
              {employers.map((emp) => (
                <button
                  key={emp._id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => { onChange(emp._id); setIsOpen(false); }}
                >
                  <EmployerAvatar employer={emp} size={20} />
                  <span className="truncate flex-1" style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                    {emp.name || 'Unnamed Employer'}
                  </span>
                  {value === emp._id && (
                    <Check size={14} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, accent }) => (
  <div
    className="card flex items-start gap-4 p-5"
    style={{ flex: '1 1 160px' }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: accent ? 'var(--accent-bg)' : 'var(--bg-elevated)',
        border: `1px solid ${accent ? 'var(--accent-dim)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: accent ? 'var(--accent)' : 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <p className="label-overline mb-0.5">{label}</p>
      <p className="font-mono text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  </div>
);

// ── AI Schedule Import Modal ──────────────────────────────────────────────────

type ImportStep = 'upload' | 'review' | 'saving' | 'done';

interface ReviewEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  type: WorkEntryType;
  selected: boolean;
}

interface ScheduleImportModalProps {
  employers: Employer[];
  onClose: () => void;
  onDone: () => void;
}

const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({ employers, onClose, onDone }) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [employerId, setEmployerId] = useState(employers[0]?._id ?? '');
  const [subLocationId, setSubLocationId] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [scheduleText, setScheduleText] = useState('');
  const [defaultStart, setDefaultStart] = useState('09:00');
  const [defaultEnd, setDefaultEnd] = useState('17:00');
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importError, setImportError] = useState('');
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const selectedEmployerImport = employers.find((e) => e._id === employerId);
  const hasSubLocationsImport = (selectedEmployerImport?.subLocations?.length ?? 0) > 0;
  const selectedCount = entries.filter((e) => e.selected).length;

  const handleEmployerChangeImport = (id: string) => { setEmployerId(id); setSubLocationId(''); };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const patchReviewEntry = (id: string, patch: Partial<ReviewEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const removeReviewEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const calcHrs = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return Math.round((diff / 60) * 10) / 10;
  };

  const handleParse = async () => {
    if (!employerId) return setImportError('Select an employer first.');
    if (inputMode === 'file' && !file) return setImportError('Upload a schedule file.');
    if (inputMode === 'text' && !scheduleText.trim()) return setImportError('Paste or type the schedule text.');
    setParsing(true);
    setImportError('');
    try {
      const fd = new FormData();
      if (inputMode === 'file' && file) fd.append('file', file);
      if (inputMode === 'text') fd.append('text', scheduleText);
      fd.append('defaultStartTime', defaultStart);
      fd.append('defaultEndTime', defaultEnd);
      const result = await parseSchedule(fd);
      if (result.count === 0) {
        setImportError('No entries found. Try pasting the text directly, or check the file content.');
        return;
      }
      setEntries(
        result.entries.map((e, i) => ({
          id: String(i),
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          notes: e.notes ?? '',
          type: 'shift' as WorkEntryType,
          selected: true,
        })),
      );
      setStep('review');
    } catch (err: any) {
      setImportError(err?.response?.data?.message ?? err?.message ?? 'AI parsing failed. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleImportConfirm = async () => {
    const toSave = entries.filter((e) => e.selected);
    if (toSave.length === 0) return setImportError('Select at least one entry.');
    setStep('saving');
    try {
      const result = await confirmScheduleImport(
        employerId,
        toSave.map((e) => ({
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          type: e.type,
          notes: e.notes || null,
          subLocationId: subLocationId || undefined,
        })),
      );
      setSavedCount(result.count);
      setStep('done');
    } catch (err: any) {
      setImportError(err?.response?.data?.message ?? 'Failed to save entries.');
      setStep('review');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,23,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="card-elevated w-full flex flex-col"
        style={{ maxWidth: step === 'review' ? 860 : 540, maxHeight: '92vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>AI Schedule Import</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {step === 'upload' && 'Upload an image, PDF, or paste your work schedule'}
                {step === 'review' && `Review ${entries.length} extracted entr${entries.length === 1 ? 'y' : 'ies'} — edit or deselect before saving`}
                {step === 'saving' && 'Saving…'}
                {step === 'done' && `${savedCount} ${savedCount === 1 ? 'entry' : 'entries'} added to your tracker`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="p-5 space-y-5">
              {importError && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-dim)', color: 'var(--rose)' }}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />{importError}
                </div>
              )}

              {/* Employer + sub-location selectors */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-overline mb-2 block">Employer *</label>
                  {employers.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No employers yet. Add one in the Employers tab.</p>
                  ) : (
                    <EmployerSelect
                      employers={employers}
                      value={employerId}
                      onChange={(id) => handleEmployerChangeImport(id)}
                    />
                  )}
                </div>
                {hasSubLocationsImport && (
                  <div>
                    <label className="label-overline mb-2 block">
                      <MapPin size={10} className="inline mr-1" />Sub-location (optional)
                    </label>
                    <select className="input-base w-full" value={subLocationId} onChange={(e) => setSubLocationId(e.target.value)}>
                      <option value="">None — general</option>
                      {selectedEmployerImport!.subLocations.map((sl) => <option key={sl._id} value={sl._id}>{sl.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Default times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-overline mb-2 block">Default start (if not in schedule)</label>
                  <input type="time" className="input-base w-full" value={defaultStart} onChange={(e) => setDefaultStart(e.target.value)} />
                </div>
                <div>
                  <label className="label-overline mb-2 block">Default end (if not in schedule)</label>
                  <input type="time" className="input-base w-full" value={defaultEnd} onChange={(e) => setDefaultEnd(e.target.value)} />
                </div>
              </div>

              {/* Input mode toggle */}
              <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-raised)' }}>
                {(['file', 'text'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5"
                    style={{
                      background: inputMode === mode ? 'var(--bg-surface)' : 'transparent',
                      color: inputMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: inputMode === mode ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                  >
                    {mode === 'file' ? <Upload size={12} /> : <FileText size={12} />}
                    {mode === 'file' ? 'Image / PDF' : 'Paste text'}
                  </button>
                ))}
              </div>

              {/* File dropzone */}
              {inputMode === 'file' && (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all p-8"
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--accent)' : file ? 'var(--jade)' : 'var(--border)'}`,
                    background: dragOver ? 'var(--accent-bg)' : 'var(--bg-raised)',
                    minHeight: 160,
                  }}
                >
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                  {file ? (
                    <>
                      <FileText size={32} style={{ color: 'var(--jade)' }} />
                      <div className="text-center">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB · {file.type}</p>
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs mt-2 underline" style={{ color: 'var(--text-muted)' }}>Remove</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                      <div className="text-center">
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Drag & drop or click to upload</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Images (JPG, PNG, WebP) or PDF · up to 10 MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Text paste area */}
              {inputMode === 'text' && (
                <textarea
                  className="input-base w-full font-mono text-xs"
                  rows={9}
                  placeholder={`Paste your work schedule here…\n\nExample:\nMon 02/03 - 09:00-17:00\nWed 04/03 - 14:00-22:00\nFri 06/03 - Night shift 22:00-06:00`}
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  style={{ resize: 'vertical', lineHeight: 1.6 }}
                />
              )}
            </div>
          )}

          {/* ── STEP: REVIEW ── */}
          {step === 'review' && (
            <div className="p-5 space-y-3">
              {importError && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-dim)', color: 'var(--rose)' }}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />{importError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedCount} of {entries.length} selected · Edit or deselect rows before confirming</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setEntries((p) => p.map((e) => ({ ...e, selected: true })))} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}>All</button>
                  <button onClick={() => setEntries((p) => p.map((e) => ({ ...e, selected: false })))} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}>None</button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      <th className="p-2 w-8" />
                      <th className="p-2 text-left"><span className="label-overline">Date</span></th>
                      <th className="p-2 text-left"><span className="label-overline">Start</span></th>
                      <th className="p-2 text-left"><span className="label-overline">End</span></th>
                      <th className="p-2 text-left"><span className="label-overline">Hrs</span></th>
                      <th className="p-2 text-left"><span className="label-overline">Type</span></th>
                      <th className="p-2 text-left"><span className="label-overline">Status</span></th>
                      <th className="p-2 text-left"><span className="label-overline">Notes</span></th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => {
                      const isPast = entry.date <= today;
                      const hrs = calcHrs(entry.startTime, entry.endTime);
                      return (
                        <tr
                          key={entry.id}
                          style={{
                            background: entry.selected ? 'transparent' : 'var(--bg-raised)',
                            borderBottom: idx < entries.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                            opacity: entry.selected ? 1 : 0.4,
                          }}
                        >
                          <td className="p-2">
                            <input type="checkbox" checked={entry.selected} onChange={(e) => patchReviewEntry(entry.id, { selected: e.target.checked })} className="w-3.5 h-3.5 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                          </td>
                          <td className="p-1.5"><input type="date" className="input-base text-xs p-1 h-7" value={entry.date} onChange={(e) => patchReviewEntry(entry.id, { date: e.target.value })} /></td>
                          <td className="p-1.5"><input type="time" className="input-base text-xs p-1 h-7" value={entry.startTime} onChange={(e) => patchReviewEntry(entry.id, { startTime: e.target.value })} /></td>
                          <td className="p-1.5"><input type="time" className="input-base text-xs p-1 h-7" value={entry.endTime} onChange={(e) => patchReviewEntry(entry.id, { endTime: e.target.value })} /></td>
                          <td className="p-2"><span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{hrs}h</span></td>
                          <td className="p-1.5">
                            <select className="input-base text-xs p-1 h-7" value={entry.type} onChange={(e) => patchReviewEntry(entry.id, { type: e.target.value as WorkEntryType })}>
                              <option value="shift">Shift</option>
                              <option value="appointment">Appt</option>
                            </select>
                          </td>
                          <td className="p-2"><span className={`badge ${isPast ? 'badge-jade' : 'badge-ember'} text-[10px]`}>{isPast ? 'done' : 'planned'}</span></td>
                          <td className="p-1.5"><input type="text" className="input-base text-xs p-1 h-7 w-28" value={entry.notes} placeholder="—" onChange={(e) => patchReviewEntry(entry.id, { notes: e.target.value })} /></td>
                          <td className="p-1.5"><button onClick={() => removeReviewEntry(entry.id)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }} title="Remove row"><X size={12} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STEP: SAVING ── */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Saving entries…</p>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--jade-bg)', border: '1px solid var(--jade-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--jade)' }}>
                <CheckCircle2 size={30} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{savedCount} {savedCount === 1 ? 'entry' : 'entries'} added</p>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  Future dates are marked <span style={{ color: 'var(--ember)' }}>planned</span>, past dates as <span style={{ color: 'var(--jade)' }}>done</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={step === 'done' ? onClose : step === 'review' ? () => setStep('upload') : onClose}
            className="btn-ghost text-sm px-3 py-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {step === 'done' ? 'Close' : step === 'review' ? '← Back' : 'Cancel'}
          </button>

          {step === 'upload' && (
            <button
              onClick={handleParse}
              disabled={parsing || !employerId || (inputMode === 'file' ? !file : !scheduleText.trim())}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40"
            >
              {parsing
                ? <><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />Extracting…</>
                : <><Sparkles size={15} />Extract with AI</>}
            </button>
          )}

          {step === 'review' && (
            <button onClick={handleImportConfirm} disabled={selectedCount === 0} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40">
              <Plus size={15} />Add {selectedCount} {selectedCount === 1 ? 'entry' : 'entries'}
            </button>
          )}

          {step === 'done' && (
            <button onClick={onDone} className="btn-primary flex items-center gap-2 text-sm">
              <CheckCircle2 size={15} />View in tracker
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Add/Edit Entry Modal ──────────────────────────────────────────────────────

interface EntryModalProps {
  employers: Employer[];
  appointmentTypes: PopulatedAppointmentType[];
  editEntry?: WorkEntry | null;
  preFilled?: {
    type?: WorkEntryType;
    employerId?: string;
    appointmentTypeId?: string;
    subLocationId?: string;
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
  };
  onClose: () => void;
  onSaved: (entry: WorkEntry) => void;
}

const EntryModal: React.FC<EntryModalProps> = ({ employers, appointmentTypes, editEntry, preFilled, onClose, onSaved }) => {
  const [employerId, setEmployerId] = useState(editEntry?.employerId?._id ?? preFilled?.employerId ?? (employers[0]?._id ?? ''));
  const [appointmentTypeId, setAppointmentTypeId] = useState(editEntry?.appointmentTypeId?._id ?? preFilled?.appointmentTypeId ?? (appointmentTypes[0]?._id ?? ''));
  const [subLocationId, setSubLocationId] = useState(editEntry?.subLocationId ?? preFilled?.subLocationId ?? '');
  const [title, setTitle] = useState(editEntry?.title ?? preFilled?.title ?? '');
  const [type, setType] = useState<WorkEntryType>(editEntry?.type ?? preFilled?.type ?? 'shift');
  const [date, setDate] = useState(editEntry?.date ? editEntry.date.split('T')[0] : preFilled?.date ?? new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(editEntry?.startTime ?? preFilled?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(editEntry?.endTime ?? preFilled?.endTime ?? '17:00');
  const [breakMinutes, setBreakMinutes] = useState(editEntry?.breakMinutes?.toString() ?? '0');
  const [paidKilometers, setPaidKilometers] = useState(editEntry?.paidKilometers?.toString() ?? '0');
  const [notes, setNotes] = useState(editEntry?.notes ?? preFilled?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Voice input for notes
  const { startListening: startNotesListening, stopListening: stopNotesListening, transcript: notesTranscript, resetTranscript: resetNotesTranscript, isListening: isNotesListening, isSupported: isNotesSpeechSupported } = useSpeechRecognition();

  // Handle transcript changes
  useEffect(() => {
    if (notesTranscript) {
      setNotes(prev => (prev ? prev + ' ' : '') + notesTranscript.trim());
      resetNotesTranscript();
    }
  }, [notesTranscript, resetNotesTranscript]);

  const handleNotesVoiceInput = () => {
    if (isNotesListening) {
      stopNotesListening();
    } else {
      startNotesListening(document.documentElement.lang || 'en-US');
    }
  };

  const selectedEmployer = employers.find((e) => e._id === employerId);
  const hasSubLocations = type === 'shift' && (selectedEmployer?.subLocations?.length ?? 0) > 0;

  // Reset sub-location when employer changes
  const handleEmployerChange = (newId: string) => {
    setEmployerId(newId);
    setSubLocationId('');
  };

  const previewHours = computePreviewHours(startTime, endTime, parseInt(breakMinutes) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'shift' && !employerId) return setError('Please select an employer for the shift.');
    if (type === 'appointment' && !appointmentTypeId && !employerId) return setError('Please select an appointment type or employer.');
    if (!date) return setError('Date is required.');
    setSaving(true);
    setError('');
    try {
      const payload: CreateWorkEntryPayload = {
        employerId: type === 'shift' ? employerId : undefined,
        appointmentTypeId: type === 'appointment' ? (appointmentTypeId || null) : undefined,
        subLocationId: subLocationId || undefined,
        title: title.trim() || undefined,
        type,
        date,
        startTime,
        endTime,
        breakMinutes: parseInt(breakMinutes) || 0,
        paidKilometers: parseFloat(paidKilometers) || 0,
        notes: notes.trim() || undefined,
      };
      let saved: WorkEntry;
      if (editEntry) {
        saved = await updateEntry(editEntry._id, payload);
      } else {
        saved = await createEntry(payload);
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(14,14,23,0.82)', backdropFilter: 'blur(4px)' }}>
      <div className="card-elevated w-full max-w-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editEntry ? 'Edit Entry' : 'Add Work Entry'}
          </h2>
          <button className="btn-ghost p-1.5 rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type toggle */}
          <div>
            <label className="label-overline mb-2 block">Type</label>
            <div className="flex gap-2">
              {(['shift', 'appointment'] as WorkEntryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize"
                  style={{
                    background: type === t ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                    border: `1.5px solid ${type === t ? 'var(--accent-dim)' : 'var(--border)'}`,
                    color: type === t ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {t === 'shift' ? <><Briefcase size={14} className="inline mr-1.5 -mt-0.5" />Shift</> : <><CalendarDays size={14} className="inline mr-1.5 -mt-0.5" />Appointment</>}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Target: Employer or Appointment Type */}
          {type === 'shift' ? (
            <div>
              <label className="label-overline mb-2 block">Employer / Workplace</label>
              {employers.length === 0 ? (
                <div className="alert-warning text-sm">No employers yet. Add one in the Employers tab first.</div>
              ) : (
                <EmployerSelect
                  employers={employers}
                  value={employerId}
                  onChange={(id) => handleEmployerChange(id)}
                />
              )}
            </div>
          ) : (
            <div>
              <label className="label-overline mb-2 block">Appointment Type <span style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>(optional)</span></label>
              <select
                className="input-base w-full"
                value={appointmentTypeId}
                onChange={(e) => setAppointmentTypeId(e.target.value)}
              >
                <option value="">None / Custom</option>
                {appointmentTypes.map((apt) => (
                  <option key={apt._id} value={apt._id}>{apt.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sub-location (only shown when employer has sub-locations and is shift) */}
          {hasSubLocations && type === 'shift' && (
            <div>
              <label className="label-overline mb-2 block">
                <MapPin size={11} className="inline mr-1 -mt-0.5" />
                Sub-location / Department <span style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>(optional)</span>
              </label>
              <select
                className="input-base w-full"
                value={subLocationId}
                onChange={(e) => setSubLocationId(e.target.value)}
              >
                <option value="">None — general</option>
                {selectedEmployer!.subLocations.map((sl) => (
                  <option key={sl._id} value={sl._id}>{sl.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title / label */}
          <div>
            <label className="label-overline mb-2 block">Label <span style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>(optional)</span></label>
            <input
              className="input-base w-full"
              type="text"
              placeholder={type === 'shift' ? 'e.g. Morning shift, Night shift…' : 'e.g. Team standup, Doctor…'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <label className="label-overline mb-2 block">Date</label>
            <input
              className="input-base w-full"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-overline mb-2 block">Start time</label>
              <input
                className="input-base w-full font-mono"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-overline mb-2 block">End time</label>
              <input
                className="input-base w-full font-mono"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {type === 'shift' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-overline mb-2 block">Unpaid break <span style={{ color: 'var(--text-muted)', fontStyle: 'normal', textTransform: 'lowercase' }}>(min)</span></label>
                <input
                  className="input-base w-full"
                  type="number"
                  min="0"
                  step="5"
                  placeholder="0"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                />
              </div>
              <div>
                <label className="label-overline mb-2 block">Travel distance <span style={{ color: 'var(--text-muted)', fontStyle: 'normal', textTransform: 'lowercase' }}>(km)</span></label>
                <input
                  className="input-base w-full"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                  value={paidKilometers}
                  onChange={(e) => setPaidKilometers(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Hours preview */}
          {type === 'shift' && previewHours > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
              <Timer size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-mono text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                {previewHours}h
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>duration</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-overline">Notes <span style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>(optional)</span></label>
              {isNotesSpeechSupported && (
                <button
                  type="button"
                  onClick={handleNotesVoiceInput}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-all"
                  style={{
                    background: isNotesListening ? 'var(--rose-bg)' : 'var(--bg-raised)',
                    color: isNotesListening ? 'var(--rose)' : 'var(--text-muted)',
                    border: '1px solid var(--border)'
                  }}
                  title={isNotesListening ? 'Stop recording' : 'Record notes with voice'}
                >
                  <Mic size={12} className={isNotesListening ? 'animate-pulse' : ''} />
                  {isNotesListening ? 'Recording…' : 'Voice input'}
                </button>
              )}
            </div>
            <textarea
              className="input-base w-full resize-none"
              rows={3}
              placeholder="Any notes about this entry…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="alert-error flex items-center gap-2 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving || employers.length === 0}>
              {saving ? 'Saving…' : editEntry ? 'Save changes' : 'Add entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Employer Card (with inline sub-location management) ───────────────────────

interface EmployerCardProps {
  emp: Employer & { totalHours: number; entryCount: number };
  deletingEmployerId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onSubLocationsChanged: (empId: string, subs: SubLocation[]) => void;
}

const EmployerCard: React.FC<EmployerCardProps> = ({ emp, deletingEmployerId, onEdit, onDelete, onSubLocationsChanged }) => {
  const isConfirmDelete = deletingEmployerId === emp._id;

  // Sub-location state
  const [newSubName, setNewSubName] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState('');
  const [subBusy, setSubBusy] = useState<string | null>(null); // id of sub being saved/deleted

  const handleAddSub = async () => {
    const n = newSubName.trim();
    if (!n) return;
    setAddingBusy(true);
    try {
      const newSub = await addSubLocation(emp._id, n);
      onSubLocationsChanged(emp._id, [...(emp.subLocations ?? []), newSub]);
      setNewSubName('');
    } finally {
      setAddingBusy(false);
    }
  };

  const handleSaveRename = async (subId: string) => {
    const n = editingSubName.trim();
    if (!n) return;
    setSubBusy(subId);
    try {
      const renamed = await updateSubLocation(emp._id, subId, n);
      onSubLocationsChanged(emp._id, (emp.subLocations ?? []).map((s) => s._id === subId ? renamed : s));
      setEditingSubId(null);
    } finally {
      setSubBusy(null);
    }
  };

  const handleDeleteSub = async (subId: string) => {
    setSubBusy(subId);
    try {
      await deleteSubLocation(emp._id, subId);
      onSubLocationsChanged(emp._id, (emp.subLocations ?? []).filter((s) => s._id !== subId));
    } finally {
      setSubBusy(null);
    }
  };

  return (
    <div className="card-elevated p-5 flex flex-col gap-4 group">
      {/* Top row: avatar + name + actions */}
      <div className="flex items-start gap-3">
        <EmployerAvatar employer={emp} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{emp.name}</p>
          <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {emp.entryCount} entr{emp.entryCount !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}
            title="Edit"
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: isConfirmDelete ? 'var(--rose)' : 'var(--text-muted)', background: isConfirmDelete ? 'var(--rose-bg)' : 'var(--bg-raised)' }}
            title={isConfirmDelete ? 'Click again to confirm — will delete all entries' : 'Delete employer'}
          >
            {isConfirmDelete ? <span className="text-[10px] font-mono font-bold px-0.5">sure?</span> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex-1">
          <p className="label-overline text-[9px]">Total hours</p>
          <p className="font-mono text-xl font-bold mt-0.5" style={{ color: 'var(--accent)' }}>{emp.totalHours}h</p>
        </div>
        <div className="flex-1">
          <p className="label-overline text-[9px]">Entries</p>
          <p className="font-mono text-xl font-bold mt-0.5" style={{ color: 'var(--text-secondary)' }}>{emp.entryCount}</p>
        </div>
      </div>

      {/* Sub-locations section */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
        <p className="label-overline text-[9px] flex items-center gap-1 mb-2">
          <MapPin size={9} /> Sub-locations / Departments
        </p>

        {/* Existing sub-locations */}
        {emp.subLocations && emp.subLocations.length > 0 && (
          <ul className="space-y-1 mb-2">
            {emp.subLocations.map((sl) => (
              <li key={sl._id} className="flex items-center gap-1.5 group/sl">
                {editingSubId === sl._id ? (
                  <>
                    <input
                      autoFocus
                      className="input-base text-xs flex-1 py-1 px-2 h-7"
                      value={editingSubName}
                      onChange={(e) => setEditingSubName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(sl._id);
                        if (e.key === 'Escape') setEditingSubId(null);
                      }}
                      disabled={subBusy === sl._id}
                    />
                    <button
                      onClick={() => handleSaveRename(sl._id)}
                      disabled={subBusy === sl._id}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--jade)', background: 'var(--jade-bg)' }}
                      title="Save"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={() => setEditingSubId(null)}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}
                      title="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {sl.name}
                    </span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => { setEditingSubId(sl._id); setEditingSubName(sl.name); }}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        title="Rename"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteSub(sl._id)}
                        disabled={subBusy === sl._id}
                        className="p-1 rounded transition-colors"
                        style={{ color: subBusy === sl._id ? 'var(--text-muted)' : 'var(--rose)' }}
                        title="Delete sub-location"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add new sub-location */}
        <div className="flex gap-1.5 mt-1">
          <input
            className="input-base text-xs flex-1 py-1 px-2 h-7"
            placeholder="Add department / sub-location…"
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSub(); }}
            disabled={addingBusy}
          />
          <button
            onClick={handleAddSub}
            disabled={addingBusy || !newSubName.trim()}
            className="p-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
            title="Add sub-location"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Add/Edit Employer Modal ───────────────────────────────────────────────────

interface EmployerModalProps {
  editEmployer?: Employer | null;
  onClose: () => void;
  onSaved: (emp: Employer) => void;
}

const EmployerModal: React.FC<EmployerModalProps> = ({ editEmployer, onClose, onSaved }) => {
  const [name, setName] = useState(editEmployer?.name ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(editEmployer?.logoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Employer name is required.');
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      if (logoFile) fd.append('logo', logoFile);

      let saved: Employer;
      if (editEmployer) {
        saved = await updateEmployer(editEmployer._id, fd);
      } else {
        saved = await createEmployer(fd);
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save employer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(14,14,23,0.82)', backdropFilter: 'blur(4px)' }}>
      <div className="card-elevated w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editEmployer ? 'Edit Employer' : 'Add Employer'}
          </h2>
          <button className="btn-ghost p-1.5 rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="label-overline mb-2 block">Company / Workplace name</label>
            <input
              className="input-base w-full"
              type="text"
              placeholder="e.g. Starbucks, NHS Trust, Freelance…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Logo upload */}
          <div>
            <label className="label-overline mb-2 block">Logo <span style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>(optional)</span></label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl transition-all"
              style={{
                border: '2px dashed var(--border)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: logoPreview ? 12 : '28px 16px',
                minHeight: logoPreview ? 80 : 120,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-dim)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {logoPreview ? (
                <div className="flex items-center gap-4">
                  <img src={logoPreview} alt="preview" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {logoFile?.name ?? 'Current logo'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Click to replace</p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <Upload size={18} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drag & drop or click to upload</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PNG, JPG, WebP — max 5 MB</p>
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          </div>

          {error && (
            <div className="alert-error flex items-center gap-2 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : editEmployer ? 'Save changes' : 'Add employer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const WorkTrackerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timelog' | 'employers' | 'appointments'>('timelog');

  // ── Data state ────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<PopulatedAppointmentType[]>([]);
  const [stats, setStats] = useState<WorkTrackerStats | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingEmployers, setLoadingEmployers] = useState(true);
  const [loadingAppointmentTypes, setLoadingAppointmentTypes] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Month navigation ──────────────────────────────────────────────────────
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth() + 1); // 1-indexed

  // ── Modal state ───────────────────────────────────────────────────────────
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [showEmployerModal, setShowEmployerModal] = useState(false);
  const [editingEmployer, setEditingEmployer] = useState<Employer | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAppointmentTypeModal, setShowAppointmentTypeModal] = useState(false);
  const [editingAppointmentType, setEditingAppointmentType] = useState<PopulatedAppointmentType | null>(null);

  // ── Entry form state (for voice command pre-filling) ────────────────────
  const [entryType, setEntryType] = useState<WorkEntryType>('shift');
  const [entryEmployerId, setEntryEmployerId] = useState('');
  const [entryAppointmentTypeId, setEntryAppointmentTypeId] = useState('');
  const [entrySubLocationId, setEntrySubLocationId] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryStartTime, setEntryStartTime] = useState('09:00');
  const [entryEndTime, setEntryEndTime] = useState('17:00');
  const [entryNotes, setEntryNotes] = useState('');

  // ── Inline action state (delete confirm, remind loading) ──────────────────
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [deletingEmployerId, setDeletingEmployerId] = useState<string | null>(null);
  const [deletingAppointmentTypeId, setDeletingAppointmentTypeId] = useState<string | null>(null);

  // ── Voice command state ───────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [isMagicParsing, setIsMagicParsing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [showVoicePreview, setShowVoicePreview] = useState(false);
  const [remindLoadingId, setRemindLoadingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedEmployers, setExpandedEmployers] = useState<Set<string>>(new Set());
  const voiceRecognitionRef = useRef<any>(null);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const month = `${viewYear}-${padZero(viewMonth)}`;
      const data = await getEntries({ month });
      setEntries(data);
    } catch {
      // Silently fail for now
    } finally {
      setLoadingEntries(false);
    }
  }, [viewYear, viewMonth]);

  const fetchEmployers = useCallback(async () => {
    setLoadingEmployers(true);
    try {
      const data = await getEmployers();
      setEmployers(data);
    } catch {
      // Silently fail
    } finally {
      setLoadingEmployers(false);
    }
  }, []);

  const fetchAppointmentTypes = useCallback(async () => {
    setLoadingAppointmentTypes(true);
    try {
      const data = await getAppointmentTypes();
      setAppointmentTypes(data);
    } catch {
      // Silently fail
    } finally {
      setLoadingAppointmentTypes(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getStats();
      setStats(data);
    } catch {
      // Silently fail
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchEmployers(); }, [fetchEmployers]);
  useEffect(() => { fetchAppointmentTypes(); }, [fetchAppointmentTypes]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
    else setViewMonth((m) => m + 1);
  };

  // ── Entry actions ─────────────────────────────────────────────────────────
  const handleToggleDone = async (entry: WorkEntry) => {
    setTogglingId(entry._id);
    try {
      const newStatus: WorkEntryStatus = entry.status === 'planned' ? 'done' : 'planned';
      const updated = await updateEntry(entry._id, { status: newStatus });
      setEntries((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
      fetchStats();
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (deletingEntryId !== id) { setDeletingEntryId(id); return; } // first click = confirm
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
      setDeletingEntryId(null);
      fetchStats();
    } catch { /* ignore */ }
  };

  const handleCreateReminder = async (entry: WorkEntry) => {
    setRemindLoadingId(entry._id);
    try {
      await createReminder(entry._id);
      setEntries((prev) => prev.map((e) => e._id === entry._id ? { ...e, reminderCreated: true } : e));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to create reminder. Make sure Google Calendar is connected in Settings.');
    } finally {
      setRemindLoadingId(null);
    }
  };

  const handleEntrySaved = (entry: WorkEntry) => {
    setShowEntryModal(false);
    setEditingEntry(null);
    // Reset pre-filled values
    setEntryType('shift');
    setEntryEmployerId('');
    setEntryAppointmentTypeId('');
    setEntrySubLocationId('');
    setEntryTitle('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryStartTime('09:00');
    setEntryEndTime('17:00');
    setEntryNotes('');
    setEntries((prev) => {
      const exists = prev.find((e) => e._id === entry._id);
      if (exists) return prev.map((e) => (e._id === entry._id ? entry : e));
      // Check if the saved entry falls in current view month
      const entryDate = new Date(entry.date);
      if (entryDate.getUTCFullYear() === viewYear && entryDate.getUTCMonth() + 1 === viewMonth) {
        return [...prev, entry].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      }
      return prev;
    });
    fetchStats();
  };

  const handleVoiceCommand = () => {
    // If already listening, stop it
    if (isListening && voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    // Don't start if parsing
    if (isMagicParsing) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Speech recognition is not supported in this browser. Please try Chrome or Edge.');

    // Reset transcript and show preview
    setVoiceTranscript('');
    setShowVoicePreview(true);

    const recognition = new SpeechRecognition();
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.interimResults = true; // Enable interim results for live preview

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update the transcript state with both final and interim results
      setVoiceTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (e: any) => {
      setIsListening(false);
      if (e.error !== 'no-speech') console.error('Speech recognition error:', e.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    voiceRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleVoiceConfirm = async () => {
    if (!voiceTranscript.trim()) return;

    setIsListening(false);
    setIsMagicParsing(true);
    setShowVoicePreview(false);

    try {
      const parsed = await parseMagicPrompt({
        text: voiceTranscript,
        today: new Date().toISOString(),
        employers: employers.map(e => ({ _id: e._id, name: e.name, subLocations: e.subLocations })),
        appointmentTypes
      });

      // Open modal
      setEditingEntry(null);
      if (parsed.type) setEntryType(parsed.type === 'appointment' ? 'appointment' : 'shift');
      setEntryEmployerId(parsed.employerId || '');
      setEntryAppointmentTypeId(parsed.appointmentTypeId || '');
      setEntrySubLocationId(parsed.subLocationId || '');
      if (parsed.title) setEntryTitle(parsed.title);
      if (parsed.date) setEntryDate(parsed.date);
      if (parsed.startTime) setEntryStartTime(parsed.startTime);
      if (parsed.endTime) setEntryEndTime(parsed.endTime);
      if (parsed.notes) setEntryNotes(parsed.notes);
      setShowEntryModal(true);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to parse voice command.');
    } finally {
      setIsMagicParsing(false);
      setVoiceTranscript('');
    }
  };

  const handleVoiceCancel = () => {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
    }
    setIsListening(false);
    setShowVoicePreview(false);
    setVoiceTranscript('');
  };

  // ── Employer actions ──────────────────────────────────────────────────────
  const handleEmployerSaved = (emp: Employer) => {
    setShowEmployerModal(false);
    setEditingEmployer(null);
    setEmployers((prev) => {
      const exists = prev.find((e) => e._id === emp._id);
      if (exists) return prev.map((e) => (e._id === emp._id ? emp : e));
      return [...prev, emp];
    });
    fetchStats();
  };

  const handleDeleteEmployer = async (id: string) => {
    if (deletingEmployerId !== id) { setDeletingEmployerId(id); return; }
    try {
      await deleteEmployer(id);
      setEmployers((prev) => prev.filter((e) => e._id !== id));
      setDeletingEmployerId(null);
      fetchStats();
      fetchEntries();
    } catch { /* ignore */ }
  };

  const handleSubLocationsChanged = (empId: string, subs: SubLocation[]) => {
    setEmployers((prev) => prev.map((e) => e._id === empId ? { ...e, subLocations: subs } : e));
  };

  // ── AppointmentType actions ────────────────────────────────────────────────
  const handleAppointmentTypeSaved = (apt: PopulatedAppointmentType) => {
    setShowAppointmentTypeModal(false);
    setEditingAppointmentType(null);
    setAppointmentTypes((prev) => {
      const exists = prev.find((e) => e._id === apt._id);
      if (exists) return prev.map((e) => (e._id === apt._id ? apt : e));
      return [...prev, apt].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleDeleteAppointmentType = async (id: string) => {
    if (deletingAppointmentTypeId !== id) { setDeletingAppointmentTypeId(id); return; }
    try {
      await deleteAppointmentType(id);
      setAppointmentTypes((prev) => prev.filter((e) => e._id !== id));
      setDeletingAppointmentTypeId(null);
      fetchEntries(); // Reload entries since appointment types might have been removed
    } catch { /* ignore */ }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const monthHours = Math.round(entries.reduce((s, e) => s + (e.type === 'shift' ? e.hours : 0), 0) * 10) / 10;
  const monthPlanned = entries.filter((e) => e.status === 'planned' && e.type === 'shift').length;
  const monthDone = entries.filter((e) => e.status === 'done' && e.type === 'shift').length;
  const monthAppointments = entries.filter((e) => e.type === 'appointment').length;
  const monthEmployers = new Set(entries.map((e) => e.employerId?._id).filter(Boolean)).size;
  const monthLabel = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`;

  const grouped = groupEntriesByDate(entries);
  const plannedGrouped = groupEntriesByDate(entries.filter((e) => e.status === 'planned'));
  const doneGrouped = groupEntriesByDate(entries.filter((e) => e.status === 'done'));
  const sortedDateKeys = Array.from(grouped.keys()).sort();
  const plannedDateKeys = Array.from(plannedGrouped.keys()).sort(); // ascending — soonest first
  const doneDateKeys = Array.from(doneGrouped.keys()).sort().reverse(); // descending — most recent first

  // Per-employer summary from entries in current view
  type EmployerSummary = { totalHours: number; planned: number; done: number; lastDate: string | null };
  const employerSummary = new Map<string, EmployerSummary>();
  for (const entry of entries) {
    if (entry.type === 'shift' && entry.employerId) {
      const eid = entry.employerId._id;
      const cur = employerSummary.get(eid) ?? { totalHours: 0, planned: 0, done: 0, lastDate: null };
      cur.totalHours += entry.hours;
      if (entry.status === 'planned') cur.planned++; else cur.done++;
      if (!cur.lastDate || entry.date > cur.lastDate) cur.lastDate = entry.date;
      employerSummary.set(eid, cur);
    }
  }



  const renderDayCard = (dateKey: string, dayEntries: WorkEntry[]) => {
    const dayHours = dayEntries.reduce((sum, e) => sum + (e.type === 'shift' ? e.hours : 0), 0);
    const allDone = dayEntries.every((e) => e.status === 'done');
    return (
      <div key={dateKey} className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(dateKey)}
          </span>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: allDone ? 'rgba(45,212,160,0.1)' : 'var(--accent-bg)', color: allDone ? 'var(--jade)' : 'var(--accent)', border: `1px solid ${allDone ? 'rgba(45,212,160,0.2)' : 'var(--accent-dim)'}` }}>
            {dayHours}h
          </span>
        </div>
        <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {dayEntries.map((entry) => {
            const isDone = entry.status === 'done';
            const isToggling = togglingId === entry._id;
            const isConfirmDelete = deletingEntryId === entry._id;
            const isReminding = remindLoadingId === entry._id;
            return (
              <li key={entry._id} className="flex items-start gap-3 px-4 py-3 transition-colors group" style={{ background: isDone ? 'rgba(45,212,160,0.02)' : 'transparent' }}>
                <button
                  onClick={() => !isToggling && handleToggleDone(entry)}
                  className="mt-0.5 shrink-0 transition-all"
                  style={{ color: isDone ? 'var(--jade)' : 'var(--text-muted)', opacity: isToggling ? 0.5 : 1 }}
                  title={isDone ? 'Mark as planned' : 'Mark as done'}
                >
                  {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.type === 'shift' && entry.employerId ? (
                      <EmployerAvatar employer={entry.employerId} size={22} />
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarDays size={12} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <span className="text-sm font-medium truncate" style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {entry.type === 'appointment' && entry.appointmentTypeId ? entry.appointmentTypeId.name : entry.employerId?.name || 'Unknown'}
                      {entry.title && <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>&mdash; {entry.title}</span>}
                    </span>
                    {entry.subLocationName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <MapPin size={9} />{entry.subLocationName}
                      </span>
                    )}
                    <span className={`badge ${entry.type === 'shift' ? 'badge-gold' : 'badge-ink'} text-[10px]`}>{entry.type}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{entry.startTime} &ndash; {entry.endTime}</span>
                    <span className="font-mono text-xs font-semibold" style={{ color: isDone ? 'var(--jade)' : 'var(--accent)' }}>{entry.hours}h</span>
                    {entry.breakMinutes > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>({entry.breakMinutes}m break)</span>
                    )}
                    {(entry.paidKilometers ?? 0) > 0 && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>({entry.paidKilometers} km)</span>
                    )}
                    {entry.notes && (
                      <span className="text-xs truncate max-w-[220px]" style={{ color: 'var(--text-muted)' }} title={entry.notes}>{entry.notes}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => !entry.reminderCreated && !isReminding && handleCreateReminder(entry)}
                    disabled={entry.reminderCreated || isReminding}
                    title={entry.reminderCreated ? 'Reminder added to Google Calendar' : 'Add 1-day reminder to Google Calendar'}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: entry.reminderCreated ? 'var(--jade)' : 'var(--text-muted)', background: 'transparent', cursor: entry.reminderCreated ? 'default' : 'pointer', opacity: isReminding ? 0.5 : 1 }}
                    onMouseEnter={(e) => { if (!entry.reminderCreated) (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { if (!entry.reminderCreated) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    {entry.reminderCreated ? <CheckCircle2 size={16} /> : isReminding ? <span className="animate-spin inline-block"><CalendarDays size={16} /></span> : <CalendarDays size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditingEntry(entry); setShowEntryModal(true); }}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    title="Edit"
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry._id)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: isConfirmDelete ? 'var(--rose)' : 'var(--text-muted)' }}
                    title={isConfirmDelete ? 'Click again to confirm delete' : 'Delete'}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--rose)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = isConfirmDelete ? 'var(--rose)' : 'var(--text-muted)'}
                  >
                    {isConfirmDelete ? <span className="text-[10px] font-mono font-bold px-1">confirm?</span> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-2" style={{ background: 'var(--bg-base)' }}>
      <div className="py-6 md:py-8 space-y-6 md:space-y-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Time Tracker
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Plan and log your working hours across employers.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl self-start sm:self-auto" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            {[
              { key: 'timelog', label: 'Time Log', icon: <Clock size={15} /> },
              { key: 'employers', label: 'Employers', icon: <Building2 size={15} /> },
              { key: 'appointments', label: 'Appointments', icon: <CalendarDays size={15} /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-raised)' : 'transparent',
                  border: activeTab === tab.key ? '1px solid var(--border-bright)' : '1px solid transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? '0 1px 4px rgba(14,14,23,0.4)' : 'none',
                }}
              >
                <span style={{ color: activeTab === tab.key ? 'var(--accent)' : 'inherit' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats bar ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4">
          <StatCard
            label="Total hours"
            value={loadingEntries ? '—' : `${monthHours}h`}
            sub={loadingEntries ? undefined : `${entries.length} entries`}
            icon={<Clock size={18} />}
            accent
          />
          <StatCard
            label="Employers"
            value={loadingEntries ? '—' : monthEmployers}
            sub={`${employers.length} registered`}
            icon={<Building2 size={18} />}
          />
          <StatCard
            label="Shifts"
            value={loadingEntries ? '—' : `${monthPlanned + monthDone}`}
            sub={`${monthPlanned} planned · ${monthDone} done`}
            icon={<Briefcase size={18} />}
          />
          <StatCard
            label="Appointments"
            value={loadingEntries ? '—' : monthAppointments}
            sub={monthLabel}
            icon={<CalendarDays size={18} />}
          />
        </div>

        {/* ═══════ TIME LOG TAB ════════════════════════════════════════════ */}
        {activeTab === 'timelog' && (
          <div className="space-y-6">

            {/* Month navigator + Actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="btn-ghost p-2 rounded-lg"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-semibold text-sm min-w-[130px] text-center" style={{ color: 'var(--text-primary)' }}>
                  {MONTH_NAMES[viewMonth - 1]} {viewYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="btn-ghost p-2 rounded-lg"
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleVoiceCommand}
                  disabled={isMagicParsing}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-all"
                  style={{
                    background: isListening ? 'var(--rose-bg)' : isMagicParsing ? 'var(--amber-bg)' : 'var(--bg-elevated)',
                    color: isListening ? 'var(--rose)' : isMagicParsing ? 'var(--amber)' : 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                  title={isListening ? 'Click to stop listening' : 'Use voice to add entry'}
                >
                  {isMagicParsing ? <span className="animate-spin"><Clock size={15} /></span> : <Mic size={15} className={isListening ? 'animate-pulse' : ''} />}
                  <span className="hidden sm:inline">{isListening ? 'Stop' : isMagicParsing ? 'Parsing…' : 'AI Voice Add'}</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-all"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                  title="Import schedule with AI"
                >
                  <Sparkles size={15} />
                  <span className="hidden lg:inline">Import schedule</span>
                </button>
                <button
                  onClick={() => {
                    setEditingEntry(null);
                    // Reset pre-filled values to defaults
                    setEntryType('shift');
                    setEntryEmployerId('');
                    setEntryAppointmentTypeId('');
                    setEntrySubLocationId('');
                    setEntryTitle('');
                    setEntryDate(new Date().toISOString().split('T')[0]);
                    setEntryStartTime('09:00');
                    setEntryEndTime('17:00');
                    setEntryNotes('');
                    setShowEntryModal(true);
                  }}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add entry</span>
                </button>
              </div>
            </div>

            {/* Entry list */}
            <div className="space-y-4">
              {loadingEntries ? (
                <div className="h-64 flex items-center justify-center card">
                  <Spinner size="lg" />
                </div>
              ) : entries.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No entries for {MONTH_NAMES[viewMonth - 1]} {viewYear}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add your planned or worked hours above.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Planned section ── */}
                  {plannedDateKeys.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="label-overline flex items-center gap-1.5">
                          <Circle size={10} /> Planned
                        </p>
                        <span className="badge badge-ember text-[10px]">{entries.filter((e) => e.status === 'planned').length}</span>
                      </div>
                      <div className="space-y-3 animate-stagger">
                        {plannedDateKeys.map((dk) => renderDayCard(dk, plannedGrouped.get(dk)!))}
                      </div>
                    </div>
                  )}

                  {/* ── Done section ── */}
                  {doneDateKeys.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="label-overline flex items-center gap-1.5">
                          <CheckCircle2 size={10} /> Done
                        </p>
                        <span className="badge badge-jade text-[10px]">{entries.filter((e) => e.status === 'done').length}</span>
                      </div>
                      <div className="space-y-3 animate-stagger">
                        {doneDateKeys.map((dk) => renderDayCard(dk, doneGrouped.get(dk)!))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Employer summary accordion for this month */}
            {entries.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Workplace breakdown — {MONTH_NAMES[viewMonth - 1]}
                </h2>
                <div className="space-y-2">
                  {Array.from(employerSummary.entries()).map(([empId, summary]) => {
                    const emp = employers.find((e) => e._id === empId);
                    if (!emp) return null;
                    const isOpen = expandedEmployers.has(empId);

                    return (
                      <div key={empId} className="card overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                          style={{ background: isOpen ? 'var(--bg-elevated)' : 'transparent' }}
                          onClick={() => {
                            setExpandedEmployers((prev) => {
                              const next = new Set(prev);
                              if (isOpen) next.delete(empId); else next.add(empId);
                              return next;
                            });
                          }}
                        >
                          <EmployerAvatar employer={emp} size={28} />
                          <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{emp.name}</span>
                          <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>{summary.totalHours}h</span>
                          <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-2 grid grid-cols-3 gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <div>
                              <p className="label-overline">Planned</p>
                              <p className="font-mono text-lg font-bold mt-0.5" style={{ color: 'var(--ember)' }}>{summary.planned}</p>
                            </div>
                            <div>
                              <p className="label-overline">Done</p>
                              <p className="font-mono text-lg font-bold mt-0.5" style={{ color: 'var(--jade)' }}>{summary.done}</p>
                            </div>
                            <div>
                              <p className="label-overline">Last entry</p>
                              <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                {summary.lastDate ? formatDate(summary.lastDate) : '—'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ EMPLOYERS TAB ═══════════════════════════════════════════ */}
        {activeTab === 'employers' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {employers.length === 0 ? 'No employers added yet.' : `${employers.length} employer${employers.length !== 1 ? 's' : ''} registered`}
              </p>
              <button
                onClick={() => { setEditingEmployer(null); setShowEmployerModal(true); }}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus size={16} />
                Add employer
              </button>
            </div>

            {loadingEmployers ? (
              <div className="h-64 flex items-center justify-center card w-full">
                <Spinner size="lg" />
              </div>
            ) : employers.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Building2 size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No employers yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add your employers to start logging hours.</p>
                </div>
                <button onClick={() => { setEditingEmployer(null); setShowEmployerModal(true); }} className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add first employer
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {employers.map((emp) => (
                  <EmployerCard
                    key={emp._id}
                    emp={emp as Employer & { totalHours: number; entryCount: number }}
                    deletingEmployerId={deletingEmployerId}
                    onEdit={() => { setEditingEmployer(emp); setShowEmployerModal(true); }}
                    onDelete={() => handleDeleteEmployer(emp._id)}
                    onSubLocationsChanged={handleSubLocationsChanged}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ APPOINTMENTS TAB ════════════════════════════════════════════ */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Appointment Types</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage appointment types you use frequently.</p>
              </div>
              <button onClick={() => { setEditingAppointmentType(null); setShowAppointmentTypeModal(true); }} className="btn-primary flex items-center gap-2 text-sm max-w-fit">
                <Plus size={16} /> <span className="hidden sm:inline">Add type</span>
              </button>
            </div>

            {loadingAppointmentTypes ? (
              <div className="h-64 flex items-center justify-center card w-full">
                <Spinner size="lg" />
              </div>
            ) : appointmentTypes.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <CalendarDays size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No appointment types yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create appointment types like "Doctor" or "Meetings".</p>
                </div>
                <button onClick={() => { setEditingAppointmentType(null); setShowAppointmentTypeModal(true); }} className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add first appointment type
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {appointmentTypes.map((apt) => (
                  <div key={apt._id} className="card p-5 group flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', color: 'var(--text-primary)', flexShrink: 0, fontWeight: 600 }}>
                          {apt.name.substring(0, 2).toUpperCase()}
                        </div>
                        <h3 className="font-semibold text-sm truncate pr-2 w-full" style={{ color: 'var(--text-primary)' }}>
                          {apt.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => { setEditingAppointmentType(apt); setShowAppointmentTypeModal(true); }}
                        className="btn-ghost flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAppointmentType(apt._id)}
                        className="btn-ghost flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5"
                        style={{ color: deletingAppointmentTypeId === apt._id ? 'var(--ember)' : 'inherit', background: deletingAppointmentTypeId === apt._id ? 'rgba(255,82,82,0.1)' : 'transparent' }}
                      >
                        {deletingAppointmentTypeId === apt._id ? 'Confirm?' : <><Trash2 size={12} /> Delete</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showImportModal && (
        <ScheduleImportModal
          employers={employers}
          onClose={() => setShowImportModal(false)}
          onDone={() => { setShowImportModal(false); fetchEntries(); fetchStats(); setActiveTab('timelog'); }}
        />
      )}

      {showEntryModal && (
        <EntryModal
          employers={employers}
          appointmentTypes={appointmentTypes}
          editEntry={editingEntry}
          preFilled={editingEntry ? undefined : {
            type: entryType,
            employerId: entryEmployerId,
            appointmentTypeId: entryAppointmentTypeId,
            subLocationId: entrySubLocationId,
            title: entryTitle,
            date: entryDate,
            startTime: entryStartTime,
            endTime: entryEndTime,
            notes: entryNotes,
          }}
          onClose={() => { setShowEntryModal(false); setEditingEntry(null); }}
          onSaved={handleEntrySaved}
        />
      )}

      {showEmployerModal && (
        <EmployerModal
          editEmployer={editingEmployer}
          onClose={() => { setShowEmployerModal(false); setEditingEmployer(null); }}
          onSaved={handleEmployerSaved}
        />
      )}

      {showAppointmentTypeModal && (
        <AppointmentTypeModal
          editAppointmentType={editingAppointmentType}
          onClose={() => { setShowAppointmentTypeModal(false); setEditingAppointmentType(null); }}
          onSaved={handleAppointmentTypeSaved}
        />
      )}

      {showVoicePreview && (
        <VoicePreviewModal
          transcript={voiceTranscript}
          isListening={isListening}
          isParsing={isMagicParsing}
          onConfirm={handleVoiceConfirm}
          onCancel={handleVoiceCancel}
        />
      )}
    </div>
  );
};

// ── AppointmentTypeModal Component ───────────────────────────────────────────
interface AppointmentTypeModalProps {
  editAppointmentType?: PopulatedAppointmentType | null;
  onClose: () => void;
  onSaved: (apt: PopulatedAppointmentType) => void;
}
const AppointmentTypeModal: React.FC<AppointmentTypeModalProps> = ({ editAppointmentType, onClose, onSaved }) => {
  const [name, setName] = useState(editAppointmentType?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter a name.');
    setSaving(true);
    setError('');
    try {
      let saved;
      if (editAppointmentType) {
        saved = await updateAppointmentType(editAppointmentType._id, { name });
      } else {
        saved = await createAppointmentType({ name });
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save appointment type.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-md animate-scale-in bg-white dark:bg-gray-800 shadow-xl border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {editAppointmentType ? 'Edit appointment type' : 'Add appointment type'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md transition-colors hover:bg-[var(--bg-elevated)]" style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="label-overline mb-2 block">Name</label>
            <input
              className="input-base w-full"
              type="text"
              placeholder="e.g. Doctor, Meeting..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert-error flex items-center gap-2 text-sm"><AlertCircle size={15} /> {error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : editAppointmentType ? 'Save changes' : 'Add type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── VoicePreviewModal Component ────────────────────────────────────────────
const VoicePreviewModal: React.FC<{
  transcript: string;
  isListening: boolean;
  isParsing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ transcript, isListening, isParsing, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(14,14,23,0.82)', backdropFilter: 'blur(4px)' }}>
      <div className="card-elevated w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: isListening ? 'var(--rose-bg)' : 'var(--accent-bg)',
                border: `1px solid ${isListening ? 'var(--rose-dim)' : 'var(--accent-dim)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isListening ? 'var(--rose)' : 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {isParsing ? <span className="animate-spin"><Clock size={20} /></span> : <Mic size={20} className={isListening ? 'animate-pulse' : ''} />}
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isListening ? 'Listening...' : isParsing ? 'Processing...' : 'Voice Command'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {isListening ? 'Speak your command' : isParsing ? 'AI is parsing your command' : 'Review and edit before sending'}
              </p>
            </div>
          </div>
          <button className="btn-ghost p-1.5 rounded-lg" onClick={onCancel} disabled={isParsing}>
            <X size={18} />
          </button>
        </div>

        {/* Transcript display */}
        <div className="p-6">
          <div
            className="w-full p-4 rounded-lg min-h-[120px]"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              lineHeight: '1.6',
            }}
          >
            {transcript || (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {isListening ? 'Listening...' : 'No speech detected yet'}
              </span>
            )}
          </div>
          {isListening && (
            <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className="animate-pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
              Speak now. The transcript will appear above.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={isParsing}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={onConfirm}
            disabled={isParsing || !transcript.trim()}
          >
            {isParsing ? (
              <>
                <span className="animate-spin"><Clock size={16} /></span>
                Processing...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Send to AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkTrackerPage;
