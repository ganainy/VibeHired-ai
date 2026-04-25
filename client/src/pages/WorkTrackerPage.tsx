// client/src/pages/WorkTrackerPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Button } from '../components/common';
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
 Info,
} from 'lucide-react';
import {
 getEntries,
 getStats,
 createEntry,
 updateEntry,
 deleteEntry,
 createReminder,
 deleteReminder,
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
import {
 getGoogleCalendarStatus,
 listUpcomingEvents,
 CalendarEvent,
} from '../services/googleCalendarApi';
import Spinner from '../components/common/Spinner';
import { parseApiErrorMessage } from '../utils/parseApiError';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAuth } from '../context/AuthContext';
import TourBanner from '../components/onboarding/TourBanner';
import { usePageTour } from '../hooks/usePageTour';

// Helpers 

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

// Calendar integration helpers 

type TimeLogItem =
 | { kind: 'entry'; data: WorkEntry }
 | { kind: 'calendar'; data: CalendarEvent };

function getCalEventDateKey(event: CalendarEvent): string {
 const raw = event.start.dateTime || event.start.date || '';
 return raw.split('T')[0];
}

function getCalEventStartTime(event: CalendarEvent): string {
 if (!event.start.dateTime) return '00:00';
 const d = new Date(event.start.dateTime);
 return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatCalendarTime(dateTimeStr: string): string {
 return new Date(dateTimeStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function groupItemsByDate(
 entries: WorkEntry[],
 calendarEvents: CalendarEvent[],
): Map<string, TimeLogItem[]> {
 const map = new Map<string, TimeLogItem[]>();

 for (const entry of entries) {
 const key = entry.date.split('T')[0];
 if (!map.has(key)) map.set(key, []);
 map.get(key)!.push({ kind: 'entry', data: entry });
 }

 for (const event of calendarEvents) {
 const key = getCalEventDateKey(event);
 if (!key) continue;
 if (!map.has(key)) map.set(key, []);
 map.get(key)!.push({ kind: 'calendar', data: event });
 }

 // Sort items within each day by start time ascending
 for (const items of map.values()) {
 items.sort((a, b) => {
 const aTime = a.kind === 'entry' ? a.data.startTime : getCalEventStartTime(a.data);
 const bTime = b.kind === 'entry' ? b.data.startTime : getCalEventStartTime(b.data);
 return aTime.localeCompare(bTime);
 });
 }

 return map;
}

// Sub-components 

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
 <span style={{ color: 'var(--text-muted)' }}>Select employer</span>
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
 <span className="truncate flex-1" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Select employer</span>
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
 className="card flex items-start gap-4 p-3 sm:p-5"
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

// AI Schedule Import Modal 

type ImportStep = 'upload' | 'review' | 'saving' | 'done';

interface ReviewEntry {
 id: string;
 date: string;
 startTime: string;
 endTime: string;
 startTimeInferred?: boolean;
 endTimeInferred?: boolean;
 notes: string;
 type: WorkEntryType;
 selected: boolean;
}

interface ScheduleImportModalProps {
 employers: Employer[];
 appointmentTypes: PopulatedAppointmentType[];
 onClose: () => void;
 onDone: () => void;
}

const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({ employers, appointmentTypes, onClose, onDone }) => {
 const { refreshUsage } = useAuth();
 const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
 const VOICE_LANGUAGE_OPTIONS = [
 { value: 'en-US', label: 'English (US)' },
 { value: 'en-GB', label: 'English (UK)' },
 { value: 'ar-EG', label: 'Arabic (Egypt)' },
 { value: 'de-DE', label: 'German' },
 { value: 'fr-FR', label: 'French' },
 { value: 'es-ES', label: 'Spanish' },
 { value: 'it-IT', label: 'Italian' },
 { value: 'pt-PT', label: 'Portuguese' },
 { value: 'nl-NL', label: 'Dutch' },
 { value: 'tr-TR', label: 'Turkish' },
 ] as const;
 const [step, setStep] = useState<ImportStep>('upload');
 const importMode: 'auto' = 'auto';
 const [employerId, setEmployerId] = useState(employers[0]?._id ?? '');
 const [appointmentTypeId, setAppointmentTypeId] = useState(appointmentTypes[0]?._id ?? '');
 const [subLocationId, setSubLocationId] = useState('');
 const [inputMode, setInputMode] = useState<'file' | 'text' | 'voice'>('file');
 const [file, setFile] = useState<File | null>(null);
 const [scheduleText, setScheduleText] = useState('');
 const [voiceLanguage, setVoiceLanguage] = useState(() => {
 const pageLanguage = document.documentElement.lang || 'en-US';
 return VOICE_LANGUAGE_OPTIONS.some((option) => option.value === pageLanguage) ? pageLanguage : 'en-US';
 });
 const [inferredStartOverride, setInferredStartOverride] = useState('09:00');
 const [inferredEndOverride, setInferredEndOverride] = useState('17:00');
 const [dragOver, setDragOver] = useState(false);
 const [parsing, setParsing] = useState(false);
 const [importError, setImportError] = useState('');
 const [entries, setEntries] = useState<ReviewEntry[]>([]);
 const [savedCount, setSavedCount] = useState(0);
 const [isVoiceRecording, setIsVoiceRecording] = useState(false);
 const [voiceError, setVoiceError] = useState('');
 const [micLevel, setMicLevel] = useState(0);
 const [micDetected, setMicDetected] = useState<boolean | null>(null);
 const [showMicHint, setShowMicHint] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const voiceRecognitionRef = useRef<any>(null);
 const audioContextRef = useRef<AudioContext | null>(null);
 const analyserRef = useRef<AnalyserNode | null>(null);
 const mediaStreamRef = useRef<MediaStream | null>(null);
 const meterIntervalRef = useRef<number | null>(null);
 const lowInputMsRef = useRef(0);

 const today = new Date().toISOString().split('T')[0];
 const selectedEmployerImport = employers.find((e) => e._id === employerId);
 const selectedAppointmentTypeImport = appointmentTypes.find((t) => t._id === appointmentTypeId);
 const hasSubLocationsImport = (selectedEmployerImport?.subLocations?.length ?? 0) > 0;
 const selectedCount = entries.filter((e) => e.selected).length;
 const hasInferredTimes = entries.some((entry) => entry.startTimeInferred || entry.endTimeInferred);

 useEffect(() => {
 if (!employerId && employers.length === 1) {
 setEmployerId(employers[0]._id);
 return;
 }
 if (employerId && !employers.some((employer) => employer._id === employerId)) {
 setEmployerId(employers[0]?._id ?? '');
 setSubLocationId('');
 }
 }, [employerId, employers]);

 useEffect(() => {
 if (!appointmentTypeId && appointmentTypes.length === 1) {
 setAppointmentTypeId(appointmentTypes[0]._id);
 return;
 }
 if (appointmentTypeId && !appointmentTypes.some((type) => type._id === appointmentTypeId)) {
 setAppointmentTypeId(appointmentTypes[0]?._id ?? '');
 }
 }, [appointmentTypeId, appointmentTypes]);

 const handleEmployerChangeImport = (id: string) => { setEmployerId(id); setSubLocationId(''); };
 const handleAppointmentTypeChangeImport = (id: string) => { setAppointmentTypeId(id); };

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

 const cleanupVoiceMeter = () => {
 if (meterIntervalRef.current) {
 window.clearInterval(meterIntervalRef.current);
 meterIntervalRef.current = null;
 }
 if (mediaStreamRef.current) {
 mediaStreamRef.current.getTracks().forEach((track) => track.stop());
 mediaStreamRef.current = null;
 }
 if (audioContextRef.current) {
 audioContextRef.current.close().catch(() => undefined);
 audioContextRef.current = null;
 }
 analyserRef.current = null;
 setMicLevel(0);
 };

 const stopVoiceRecording = () => {
 if (voiceRecognitionRef.current) {
 voiceRecognitionRef.current.stop();
 }
 setIsVoiceRecording(false);
 cleanupVoiceMeter();
 };

 const startVoiceRecording = async () => {
 if (!SpeechRecognition) {
 setVoiceError('Voice capture is not supported in this browser. Use Chrome or Edge.');
 return;
 }

 setInputMode('voice');
 setVoiceError('');
 setShowMicHint(false);
 setMicDetected(null);
 lowInputMsRef.current = 0;

 try {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 mediaStreamRef.current = stream;
 setMicDetected(true);

 const audioContext = new AudioContext();
 audioContextRef.current = audioContext;
 const source = audioContext.createMediaStreamSource(stream);
 const analyser = audioContext.createAnalyser();
 analyser.fftSize = 256;
 analyser.smoothingTimeConstant = 0.85;
 source.connect(analyser);
 analyserRef.current = analyser;

 const SpeechRecognitionClass = SpeechRecognition;
 const recognition = new SpeechRecognitionClass();
 recognition.lang = voiceLanguage;
 recognition.interimResults = true;
 recognition.continuous = true;

 recognition.onstart = () => setIsVoiceRecording(true);
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
 const nextText = `${finalTranscript}${interimTranscript}`.trim();
 if (nextText) {
 setScheduleText(nextText);
 setShowMicHint(false);
 lowInputMsRef.current = 0;
 }
 };
 recognition.onerror = (event: any) => {
 setIsVoiceRecording(false);
 cleanupVoiceMeter();
 if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
 setVoiceError('Microphone permission was denied. Allow mic access in Chrome site settings.');
 setMicDetected(false);
 setShowMicHint(true);
 }
 };
 recognition.onend = () => {
 setIsVoiceRecording(false);
 cleanupVoiceMeter();
 };

 voiceRecognitionRef.current = recognition;
 recognition.start();

 meterIntervalRef.current = window.setInterval(() => {
 if (!analyserRef.current) return;
 const data = new Uint8Array(analyserRef.current.frequencyBinCount);
 analyserRef.current.getByteTimeDomainData(data);
 let sumSquares = 0;
 for (let i = 0; i < data.length; i++) {
 const normalized = (data[i] - 128) / 128;
 sumSquares += normalized * normalized;
 }
 const rms = Math.sqrt(sumSquares / data.length);
 const level = Math.min(100, Math.round(rms * 300));
 setMicLevel(level);

 if (isVoiceRecording && level < 4) {
 lowInputMsRef.current += 120;
 if (lowInputMsRef.current >= 2500) {
 setShowMicHint(true);
 }
 } else {
 lowInputMsRef.current = 0;
 setShowMicHint(false);
 }
 }, 120);
 } catch {
 setMicDetected(false);
 setShowMicHint(true);
 setVoiceError('No microphone input was detected. Check Chrome microphone settings and select the correct device.');
 cleanupVoiceMeter();
 }
 };

 useEffect(() => {
 return () => {
 stopVoiceRecording();
 };
 }, []);

 const handleParse = async () => {
 if (!employerId && !appointmentTypeId) {
 return setImportError('Select at least one default: Employer or Appointment Type.');
 }
 if (inputMode === 'file' && !file) return setImportError('Upload a schedule file.');
 if ((inputMode === 'text' || inputMode === 'voice') && !scheduleText.trim()) return setImportError('Provide schedule text before extracting.');
 setParsing(true);
 setImportError('');
 try {
 const fd = new FormData();
 if (inputMode === 'file' && file) fd.append('file', file);
 if (inputMode === 'text' || inputMode === 'voice') fd.append('text', scheduleText);
 const result = await parseSchedule(fd, importMode);
 try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
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
 startTimeInferred: Boolean(e.startTimeInferred),
 endTimeInferred: Boolean(e.endTimeInferred),
 notes: e.notes ?? '',
 // Use AI-detected type. If missing, fallback to whichever default is available.
 type: e.type || (!employerId && appointmentTypeId ? 'appointment' : 'shift'),
 selected: true,
 })),
 );
 setStep('review');
 } catch (err: any) {
 setImportError(parseApiErrorMessage(err));
 } finally {
 setParsing(false);
 }
 };

 const handleImportConfirm = async () => {
 const toSave = entries.filter((e) => e.selected);
 if (toSave.length === 0) return setImportError('Select at least one entry.');
 setStep('saving');
 try {
 const result = await confirmScheduleImport({
 employerId: employerId || undefined,
 appointmentTypeId: appointmentTypeId || undefined,
 entries: toSave.map((e) => ({
 date: e.date,
 startTime: e.startTime,
 endTime: e.endTime,
 type: e.type,
 notes: e.notes || null,
 subLocationId: subLocationId || undefined,
 })),
 });
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
 {step === 'review' && `Review ${entries.length} extracted entr${entries.length === 1 ? 'y' : 'ies'} edit or deselect before saving`}
 {step === 'saving' && 'Saving'}
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

 {/* STEP: UPLOAD */}
 {step === 'upload' && (
 <div className="p-5 space-y-5">
 {importError && (
 <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-dim)', color: 'var(--rose)' }}>
 <AlertCircle size={16} className="shrink-0 mt-0.5" />{importError}
 </div>
 )}

 {/* Unified smart mode */}
 <div>
 <label className="label-overline mb-2 block">Import mode</label>
 <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-raised)' }}>
 <div
 className="px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5"
 style={{
 background: 'var(--bg-surface)',
 color: 'var(--text-primary)',
 border: '1px solid var(--border)',
 }}
 >
 <Sparkles size={12} />Smart import (Shifts + Appointments)
 </div>
 </div>
 <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
 AI will detect each row as either a shift or an appointment automatically.
 </p>
 </div>

 <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
 <div>
 <label className="label-overline mb-2 block whitespace-nowrap">Default Employer</label>
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

 <div
 className="hidden sm:flex items-center justify-center pb-2"
 aria-hidden="true"
 >
 <span
 className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.08em]"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-muted)',
 }}
 >
 OR
 </span>
 </div>

 <div>
 <label className="label-overline mb-2 block whitespace-nowrap">Default Appointment Type</label>
 {appointmentTypes.length === 0 ? (
 <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No appointment types yet. Add one in the Appointments tab.</p>
 ) : (
 <select
 className="input-base w-full"
 value={appointmentTypeId}
 onChange={(e) => handleAppointmentTypeChangeImport(e.target.value)}
 >
 {appointmentTypes.map((apt) => (
 <option key={apt._id} value={apt._id}>{apt.name}</option>
 ))}
 </select>
 )}
 </div>
 </div>

 {hasSubLocationsImport && (
 <div>
 <label className="label-overline mb-2 block">
 <MapPin size={10} className="inline mr-1" />Sub-location (optional)
 </label>
 <select className="input-base w-full" value={subLocationId} onChange={(e) => setSubLocationId(e.target.value)}>
 <option value="">None general</option>
 {selectedEmployerImport!.subLocations.map((sl) => (
 <option key={sl._id} value={sl._id}>{sl.name}</option>
 ))}
 </select>
 </div>
 )}

 {/* Validation message */}
 {!employerId && !appointmentTypeId && (
 <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-dim)', color: 'var(--rose)' }}>
 <AlertCircle size={14} className="shrink-0 mt-0.5" />
 <span>
 Select at least one default (Employer or Appointment Type) before extracting.
 </span>
 </div>
 )}

 {/* Default times */}
 <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
 <Info size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
 <span>
 We will try to detect as much information as possible from your input. If anything is missing, you will be asked to provide it manually.
 </span>
 </div>

 {/* Input mode toggle */}
 <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-raised)' }}>
 {(['file', 'text', 'voice'] as const).map((mode) => (
 <button
 key={mode}
 onClick={() => {
 setInputMode(mode);
 if (mode !== 'voice') {
 stopVoiceRecording();
 setVoiceError('');
 setShowMicHint(false);
 }
 }}
 className="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5"
 style={{
 background: inputMode === mode ? 'var(--bg-surface)' : 'transparent',
 color: inputMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
 border: inputMode === mode ? '1px solid var(--border)' : '1px solid transparent',
 }}
 >
 {mode === 'file' ? <Upload size={12} /> : mode === 'text' ? <FileText size={12} /> : <Mic size={12} />}
 {mode === 'file' ? 'Image / PDF' : mode === 'text' ? 'Paste text' : 'Voice'}
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
 <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB {file.type}</p>
 <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs mt-2 underline" style={{ color: 'var(--text-muted)' }}>Remove</button>
 </div>
 </>
 ) : (
 <>
 <Upload size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
 <div className="text-center">
 <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Drag & drop or click to upload</p>
 <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Images (JPG, PNG, WebP) or PDF up to 10 MB</p>
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
 placeholder={`Paste your work schedule here\n\nExample:\nMon 02/03 - 09:00-17:00\nWed 04/03 - 14:00-22:00\nFri 06/03 - Night shift 22:00-06:00`}
 value={scheduleText}
 onChange={(e) => setScheduleText(e.target.value)}
 style={{ resize: 'vertical', lineHeight: 1.6 }}
 />
 )}

 {/* Voice input */}
 {inputMode === 'voice' && (
 <div className="space-y-3">
 <div className="rounded-xl p-4" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
 <div className="mb-3">
 <label className="label-overline mb-2 block">Voice language</label>
 <select
 className="input-base w-full text-xs"
 value={voiceLanguage}
 onChange={(e) => setVoiceLanguage(e.target.value)}
 disabled={isVoiceRecording}
 >
 {VOICE_LANGUAGE_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>{option.label}</option>
 ))}
 </select>
 </div>

 <div className="flex flex-wrap items-center gap-2 mb-3">
 <button
 onClick={startVoiceRecording}
 disabled={isVoiceRecording}
 className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
 >
 <Mic size={13} /> Start recording
 </button>
 <button
 onClick={stopVoiceRecording}
 disabled={!isVoiceRecording}
 className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
 >
 Stop recording
 </button>
 <span className="text-xs font-medium" style={{ color: micDetected === false ? 'var(--rose)' : 'var(--text-secondary)' }}>
 {micDetected === false ? 'Microphone not detected' : micDetected === true ? 'Microphone detected' : 'Checking microphone'}
 </span>
 </div>

 <div className="mb-2">
 <div className="w-full h-2 rounded-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
 <div
 className="h-full rounded-full transition-all"
 style={{
 width: `${micLevel}%`,
 background: micLevel > 35 ? 'var(--jade)' : micLevel > 8 ? 'var(--accent)' : 'var(--text-muted)',
 }}
 />
 </div>
 <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
 Input level meter {isVoiceRecording ? '(listening now)' : '(start recording to test)'}
 </p>
 </div>

 {(showMicHint || voiceError) && (
 <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-dim)', color: 'var(--rose)' }}>
 {voiceError || 'No microphone input detected. You may be using the wrong microphone. Check Chrome settings and choose the correct device.'}
 </div>
 )}
 </div>

 <textarea
 className="input-base w-full font-mono text-xs"
 rows={8}
 placeholder="Your transcribed schedule will appear here. You can edit it before extracting with AI."
 value={scheduleText}
 onChange={(e) => setScheduleText(e.target.value)}
 style={{ resize: 'vertical', lineHeight: 1.6 }}
 />
 </div>
 )}
 </div>
 )}

 {/* STEP: REVIEW */}
 {step === 'review' && (
 <div className="p-5 space-y-3">
 {importError && (
 <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-dim)', color: 'var(--rose)' }}>
 <AlertCircle size={16} className="shrink-0 mt-0.5" />{importError}
 </div>
 )}
 {hasInferredTimes && (
 <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
 <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
 Some entries are missing clear start/end times from your upload. Please confirm them.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
 <div>
 <label className="label-overline mb-1 block">Default start (missing only)</label>
 <input
 type="time"
 className="input-base w-full"
 value={inferredStartOverride}
 onChange={(e) => setInferredStartOverride(e.target.value)}
 />
 </div>
 <div>
 <label className="label-overline mb-1 block">Default end (missing only)</label>
 <input
 type="time"
 className="input-base w-full"
 value={inferredEndOverride}
 onChange={(e) => setInferredEndOverride(e.target.value)}
 />
 </div>
 <button
 type="button"
 className="btn-secondary text-xs px-3 py-2"
 onClick={() => {
 setEntries((prev) => prev.map((entry) => ({
 ...entry,
 startTime: entry.startTimeInferred ? inferredStartOverride : entry.startTime,
 endTime: entry.endTimeInferred ? inferredEndOverride : entry.endTime,
 startTimeInferred: false,
 endTimeInferred: false,
 })));
 }}
 >
 Apply to missing
 </button>
 </div>
 </div>
 )}
 <div className="flex items-center justify-between">
 <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedCount} of {entries.length} selected Edit or deselect rows before confirming</p>
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
 <td className="p-1.5">
 <input
 type="time"
 className="input-base text-xs p-1 h-7"
 style={entry.startTimeInferred ? { borderColor: 'var(--amber)', background: 'rgba(251,191,36,0.06)' } : undefined}
 value={entry.startTime}
 onChange={(e) => patchReviewEntry(entry.id, { startTime: e.target.value, startTimeInferred: false })}
 />
 </td>
 <td className="p-1.5">
 <input
 type="time"
 className="input-base text-xs p-1 h-7"
 style={entry.endTimeInferred ? { borderColor: 'var(--amber)', background: 'rgba(251,191,36,0.06)' } : undefined}
 value={entry.endTime}
 onChange={(e) => patchReviewEntry(entry.id, { endTime: e.target.value, endTimeInferred: false })}
 />
 </td>
 <td className="p-2"><span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{hrs}h</span></td>
 <td className="p-1.5">
 <select className="input-base text-xs p-1 h-7" value={entry.type} onChange={(e) => patchReviewEntry(entry.id, { type: e.target.value as WorkEntryType })}>
 <option value="shift">Shift</option>
 <option value="appointment">Appt</option>
 </select>
 </td>
 <td className="p-2"><span className={`badge ${isPast ? 'badge-jade' : 'badge-ember'} text-[10px]`}>{isPast ? 'done' : 'planned'}</span></td>
 <td className="p-1.5"><input type="text" className="input-base text-xs p-1 h-7 w-28" value={entry.notes} placeholder="" onChange={(e) => patchReviewEntry(entry.id, { notes: e.target.value })} /></td>
 <td className="p-1.5"><button onClick={() => removeReviewEntry(entry.id)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }} title="Remove row"><X size={12} /></button></td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* STEP: SAVING */}
 {step === 'saving' && (
 <div className="flex flex-col items-center justify-center py-20 gap-4">
 <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
 <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Saving entries</p>
 </div>
 )}

 {/* STEP: DONE */}
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
 {step === 'done' ? 'Close' : step === 'review' ? ' Back' : 'Cancel'}
 </button>

 {step === 'upload' && (
 <button
 onClick={handleParse}
 disabled={parsing || (!employerId && !appointmentTypeId) || (inputMode === 'file' ? !file : !scheduleText.trim())}
 className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40"
 >
 {parsing
 ? <><div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />Extracting</>
 : <><Sparkles size={15} />Extract with AI<span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>1 Credit</span></>}
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

// Add/Edit Entry Modal 

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
 const [addToCalendar, setAddToCalendar] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [calendarWarning, setCalendarWarning] = useState('');

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

 useEffect(() => {
 if ((editEntry?.employerId?._id || preFilled?.employerId)) return;
 if (!employerId && employers.length === 1) {
 setEmployerId(employers[0]._id);
 return;
 }
 if (employerId && !employers.some((employer) => employer._id === employerId)) {
 setEmployerId(employers[0]?._id ?? '');
 setSubLocationId('');
 }
 }, [editEntry?.employerId?._id, preFilled?.employerId, employerId, employers]);

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
 addToCalendar,
 };
 let saved: WorkEntry;
 let calendarCreated = false;
 if (editEntry) {
 saved = await updateEntry(editEntry._id, payload);
 } else {
 const result = await createEntry(payload);
 saved = result;
 // @ts-ignore - calendarEventCreated may be in response
 calendarCreated = result.calendarEventCreated;
 }
 // Show warning if calendar event wasn't created but was requested
 if (addToCalendar && !calendarCreated) {
 setCalendarWarning('Calendar event could not be created. Make sure Google Calendar is connected in Settings.');
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
 <option value="">None general</option>
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
 placeholder={type === 'shift' ? 'e.g. Morning shift, Night shift' : 'e.g. Team standup, Doctor'}
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
 {isNotesListening ? 'Recording' : 'Voice input'}
 </button>
 )}
 </div>
 <textarea
 className="input-base w-full resize-none"
 rows={3}
 placeholder="Any notes about this entry"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 />
 </div>

 {/* Add to Calendar toggle */}
 <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--accent-bg)' }}>
 <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
 </div>
 <div>
 <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Add to Calendar</p>
 <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create a calendar event for this entry</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setAddToCalendar(!addToCalendar)}
className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`} style={{ backgroundColor: addToCalendar ? 'var(--accent)' : 'var(--bg-elevated)' }}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addToCalendar ? 'translate-x-6' : 'translate-x-1'}`}
 />
 </button>
 </div>

 {error && (
 <div className="alert-error flex items-center gap-2 text-sm">
 <AlertCircle size={15} /> {error}
 </div>
 )}

 {calendarWarning && (
 <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
 <CalendarDays size={15} /> {calendarWarning}
 </div>
 )}

 <div className="flex gap-3 pt-1">
 <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
 <button type="submit" className="btn-primary flex-1" disabled={saving || employers.length === 0}>
 {saving ? 'Saving' : editEntry ? 'Save changes' : 'Add entry'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

// Employer Card (with inline sub-location management) 

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
 <div className="card-elevated p-3 sm:p-5 flex flex-col gap-4 group">
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
 title={isConfirmDelete ? 'Click again to confirm will delete all entries' : 'Delete employer'}
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
 placeholder="Add department / sub-location"
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

// Add/Edit Employer Modal 

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
 placeholder="e.g. Starbucks, NHS Trust, Freelance"
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
 <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PNG, JPG, WebP max 5 MB</p>
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
 {saving ? 'Saving' : editEmployer ? 'Save changes' : 'Add employer'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

// Main Page 

const WorkTrackerPage: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'timelog' | 'employers' | 'appointments'>('timelog');
 const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'shifts' | 'appointments' | 'calendar'>('all');

 // Data state 
 const [entries, setEntries] = useState<WorkEntry[]>([]);
 const [employers, setEmployers] = useState<Employer[]>([]);

 const { showTour: showWorkTour, dismiss: dismissWorkTour } = usePageTour('work-tracker');

 const [appointmentTypes, setAppointmentTypes] = useState<PopulatedAppointmentType[]>([]);
 const [stats, setStats] = useState<WorkTrackerStats | null>(null);
 const [loadingEntries, setLoadingEntries] = useState(true);
 const [loadingEmployers, setLoadingEmployers] = useState(true);
 const [loadingAppointmentTypes, setLoadingAppointmentTypes] = useState(true);
 const [loadingStats, setLoadingStats] = useState(true);

 // Calendar events (inline in Time Log) 
 const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
 const [calendarConnected, setCalendarConnected] = useState(false);
 const [loadingCalendarEvents, setLoadingCalendarEvents] = useState(false);
 const showMockWorkTour = showWorkTour && entries.length === 0 && calendarEvents.length === 0 && !loadingCalendarEvents && !loadingEntries;

 // Month navigation 
 const now = new Date();
 const [viewYear, setViewYear] = useState(now.getUTCFullYear());
 const [viewMonth, setViewMonth] = useState(now.getUTCMonth() + 1); // 1-indexed

 // Modal state 
 const [showEntryModal, setShowEntryModal] = useState(false);
 const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
 const [showEmployerModal, setShowEmployerModal] = useState(false);
 const [editingEmployer, setEditingEmployer] = useState<Employer | null>(null);
 const [showImportModal, setShowImportModal] = useState(false);
 const [showAppointmentTypeModal, setShowAppointmentTypeModal] = useState(false);
 const [editingAppointmentType, setEditingAppointmentType] = useState<PopulatedAppointmentType | null>(null);

 // Entry form state 
 const [entryType, setEntryType] = useState<WorkEntryType>('shift');
 const [entryEmployerId, setEntryEmployerId] = useState('');
 const [entryAppointmentTypeId, setEntryAppointmentTypeId] = useState('');
 const [entrySubLocationId, setEntrySubLocationId] = useState('');
 const [entryTitle, setEntryTitle] = useState('');
 const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
 const [entryStartTime, setEntryStartTime] = useState('09:00');
 const [entryEndTime, setEntryEndTime] = useState('17:00');
 const [entryNotes, setEntryNotes] = useState('');

 // Inline action state (delete confirm, remind loading) 
 const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
 const [deletingEmployerId, setDeletingEmployerId] = useState<string | null>(null);
 const [deletingAppointmentTypeId, setDeletingAppointmentTypeId] = useState<string | null>(null);

 const [remindLoadingId, setRemindLoadingId] = useState<string | null>(null);
 const [reminderFeedback, setReminderFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string; showConnectAction?: boolean } | null>(null);
 const [togglingId, setTogglingId] = useState<string | null>(null);
 const [expandedEmployers, setExpandedEmployers] = useState<Set<string>>(new Set());

 useEffect(() => {
 if (!entryEmployerId && employers.length === 1) {
 setEntryEmployerId(employers[0]._id);
 return;
 }
 if (entryEmployerId && !employers.some((employer) => employer._id === entryEmployerId)) {
 setEntryEmployerId(employers[0]?._id ?? '');
 setEntrySubLocationId('');
 }
 }, [entryEmployerId, employers]);

 const getReminderErrorFeedback = (err: unknown): { message: string; showConnectAction: boolean } => {
 const apiMessage = parseApiErrorMessage(err);
 const normalized = apiMessage.toLowerCase();
 const notConnected = normalized.includes('google calendar is not connected')
 || normalized.includes('calendar is not connected')
 || normalized.includes('reconnect')
 || normalized.includes('oauth');

 if (notConnected) {
 return {
 message: 'Google Calendar is not connected. Connect your account in Settings to add reminders.',
 showConnectAction: true,
 };
 }

 return {
 message: apiMessage || 'Failed to manage reminder. Please try again.',
 showConnectAction: false,
 };
 };

 // Fetch data 
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

 const fetchCalendarEvents = useCallback(async () => {
 setLoadingCalendarEvents(true);
 try {
 const status = await getGoogleCalendarStatus();
 setCalendarConnected(status.connected);
 if (!status.connected) {
 setCalendarEvents([]);
 return;
 }
 // Build month-scoped timeMin / timeMax.
 // Clamp timeMin to start-of-today so past events in the current (or previous) month are never shown.
 const monthStart = new Date(viewYear, viewMonth - 1, 1);
 const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
 const timeMin = (monthStart > todayStart ? monthStart : todayStart).toISOString();
 const timeMax = new Date(viewYear, viewMonth, 0, 23, 59, 59).toISOString();
 const events = await listUpcomingEvents({ maxResults: 100, timeMin, timeMax });
 setCalendarEvents(events);
 } catch {
 // Silently fail calendar integration is optional
 setCalendarEvents([]);
 } finally {
 setLoadingCalendarEvents(false);
 }
 }, [viewYear, viewMonth]);

 useEffect(() => { fetchEntries(); }, [fetchEntries]);
 useEffect(() => { fetchCalendarEvents(); }, [fetchCalendarEvents]);
 useEffect(() => { fetchEmployers(); }, [fetchEmployers]);

 useEffect(() => { fetchAppointmentTypes(); }, [fetchAppointmentTypes]);
 useEffect(() => { fetchStats(); }, [fetchStats]);

 // Month navigation 
 const prevMonth = () => {
 if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
 else setViewMonth((m) => m - 1);
 };
 const nextMonth = () => {
 if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
 else setViewMonth((m) => m + 1);
 };

 // Entry actions 
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
 setReminderFeedback(null);
 try {
 if (!calendarConnected && !loadingCalendarEvents) {
 setReminderFeedback({
 type: 'error',
 message: 'Google Calendar is not connected. Connect your account in Settings to add reminders.',
 showConnectAction: true,
 });
 return;
 }
 await createReminder(entry._id);
 setEntries((prev) => prev.map((e) => e._id === entry._id ? { ...e, reminderCreated: true } : e));
 setReminderFeedback({
 type: 'success',
 message: 'Reminder added to Google Calendar.',
 });
 } catch (err: any) {
 const feedback = getReminderErrorFeedback(err);
 setReminderFeedback({
 type: 'error',
 message: feedback.message,
 showConnectAction: feedback.showConnectAction,
 });
 } finally {
 setRemindLoadingId(null);
 }
 };

 const handleRemoveReminder = async (entry: WorkEntry) => {
 setRemindLoadingId(entry._id);
 setReminderFeedback(null);
 try {
 await deleteReminder(entry._id);
 setEntries((prev) => prev.map((e) => e._id === entry._id ? { ...e, reminderCreated: false, googleCalendarEventId: undefined } : e));
 if (entry.googleCalendarEventId) {
 setCalendarEvents((prev) => prev.filter((ev) => ev.id !== entry.googleCalendarEventId));
 }
 setReminderFeedback({
 type: 'info',
 message: 'Reminder removed from Google Calendar.',
 });
 } catch (err: any) {
 const feedback = getReminderErrorFeedback(err);
 setReminderFeedback({
 type: 'error',
 message: feedback.message,
 showConnectAction: feedback.showConnectAction,
 });
 } finally {
 setRemindLoadingId(null);
 }
 };

 const handleEntrySaved = (entry: WorkEntry) => {
 setShowEntryModal(false);
 setEditingEntry(null);
 // Reset pre-filled values
 setEntryType('shift');
 setEntryEmployerId(employers.length === 1 ? employers[0]._id : '');
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

 // Employer actions 
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

 // AppointmentType actions 
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

 // Computed 
 const monthHours = Math.round(entries.reduce((s, e) => s + (e.type === 'shift' ? e.hours : 0), 0) * 10) / 10;
 const monthDoneHours = Math.round(entries.reduce((s, e) => s + (e.status === 'done' && e.type === 'shift' ? e.hours : 0), 0) * 10) / 10;
 const monthPlanned = entries.filter((e) => e.status === 'planned' && e.type === 'shift').length;
 const monthDone = entries.filter((e) => e.status === 'done' && e.type === 'shift').length;
 const monthAppointments = entries.filter((e) => e.type === 'appointment').length;
 const monthEmployers = new Set(entries.map((e) => e.employerId?._id).filter(Boolean)).size;
 const monthLabel = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`;

 const grouped = groupEntriesByDate(entries);
 // Apply type filter to planned/done groups
 const filteredEntries = entryTypeFilter === 'all' ? entries
 : entryTypeFilter === 'shifts' ? entries.filter((e) => e.type === 'shift')
 : entryTypeFilter === 'appointments' ? entries.filter((e) => e.type === 'appointment')
 : []; // 'calendar' no work entries
 const filteredCalendarEvents = (entryTypeFilter === 'all' || entryTypeFilter === 'calendar') ? calendarEvents : [];
 // Planned: work entries + calendar events for the month
 const plannedGrouped = groupItemsByDate(filteredEntries.filter((e) => e.status === 'planned'), filteredCalendarEvents);
 // Done: work entries only (calendar events have no status)
 const doneGrouped = groupItemsByDate(filteredEntries.filter((e) => e.status === 'done'), []);
 const sortedDateKeys = Array.from(grouped.keys()).sort();
 const plannedDateKeys = Array.from(plannedGrouped.keys()).sort(); // ascending soonest first
 const doneDateKeys = Array.from(doneGrouped.keys()).sort().reverse(); // descending most recent first

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



 const renderDayCard = (dateKey: string, dayItems: TimeLogItem[]) => {
 const workEntries = dayItems.filter((i): i is { kind: 'entry'; data: WorkEntry } => i.kind === 'entry');
 const dayHours = workEntries.reduce((sum, i) => sum + (i.data.type === 'shift' ? i.data.hours : 0), 0);
 const allDone = workEntries.length > 0 && workEntries.every((i) => i.data.status === 'done');
 return (
 <div key={dateKey} className="card overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
 <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
 {formatDate(dateKey)}
 </span>
 {dayHours > 0 && (
 <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: allDone ? 'rgba(45,212,160,0.1)' : 'var(--accent-bg)', color: allDone ? 'var(--jade)' : 'var(--accent)', border: `1px solid ${allDone ? 'rgba(45,212,160,0.2)' : 'var(--accent-dim)'}` }}>
 {dayHours}h
 </span>
 )}
 </div>
 <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
 {dayItems.map((item) => {
 if (item.kind === 'calendar') {
 const event = item.data;
 const startStr = event.start.dateTime ? formatCalendarTime(event.start.dateTime) : null;
 const endStr = event.end.dateTime ? formatCalendarTime(event.end.dateTime) : null;
 return (
 <li key={`cal-${event.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors" style={{ background: 'rgba(99,102,241,0.025)' }}>
 {/* Spacer matching the toggle button width calendar rows are read-only */}
 <div className="mt-0.5 shrink-0 flex items-center justify-center" style={{ width: 20, height: 20, color: 'var(--accent)', opacity: 0.55 }}>
 <CalendarDays size={15} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
 {event.summary || '(No title)'}
 </span>
 <span
 className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
 style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)', color: 'var(--accent)' }}
 >
 <CalendarDays size={9} /> Google Calendar
 </span>
 </div>
 <div className="flex items-center gap-3 mt-1 flex-wrap">
 {startStr && endStr ? (
 <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
 {startStr} &ndash; {endStr}
 </span>
 ) : !event.start.dateTime ? (
 <span className="text-xs" style={{ color: 'var(--text-muted)' }}>All day</span>
 ) : null}
 {event.location && (
 <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
 <MapPin size={10} />{event.location}
 </span>
 )}
 </div>
 </div>
 {/* No action buttons read-only calendar rows */}
 <div style={{ width: 28 }} />
 </li>
 );
 }

 // Work entry row (unchanged) 
 const entry = item.data;
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
 onClick={() => entry.reminderCreated ? handleRemoveReminder(entry) : (!isReminding && handleCreateReminder(entry))}
 disabled={isReminding}
 title={entry.reminderCreated ? 'Click to remove reminder from Google Calendar' : 'Add 1-day reminder to Google Calendar'}
 className="p-1.5 rounded-lg transition-all"
 style={{ color: entry.reminderCreated ? 'var(--jade)' : 'var(--text-muted)', background: 'transparent', cursor: isReminding ? 'not-allowed' : 'pointer', opacity: isReminding ? 0.5 : 1 }}
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

 // Render 
 return (
 <div className="h-full overflow-y-auto custom-scrollbar px-2" style={{ background: 'var(--bg-base)' }}>
 <div className="py-6 md:py-8 space-y-6 md:space-y-8">

 {/* Page header */}
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
 <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl self-start sm:self-auto" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
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

 {/* Stats bar */}
 <div className="flex flex-wrap gap-4">
 <StatCard
 label="Total hours"
 value={loadingEntries ? '' : showMockWorkTour ? '24h' : `${monthHours}h`}
 sub={loadingEntries ? undefined : showMockWorkTour ? '16h done 4 entries' : `${monthDoneHours}h done ${entries.length} entries`}
 icon={<Clock size={18} />}
 accent
 />
 <StatCard
 label="Employers"
 value={loadingEntries ? '' : showMockWorkTour ? 2 : monthEmployers}
 sub={showMockWorkTour ? '2 registered' : `${employers.length} registered`}
 icon={<Building2 size={18} />}
 />
 <StatCard
 label="Shifts"
 value={loadingEntries ? '' : showMockWorkTour ? '3' : `${monthPlanned + monthDone}`}
 sub={showMockWorkTour ? '1 planned 2 done' : `${monthPlanned} planned ${monthDone} done`}
 icon={<Briefcase size={18} />}
 />
 <StatCard
 label="Appointments"
 value={loadingEntries ? '' : showMockWorkTour ? 1 : monthAppointments}
 sub={monthLabel}
 icon={<CalendarDays size={18} />}
 />
 </div>

 {/* TIME LOG TAB */}
 {activeTab === 'timelog' && (
 <div className="space-y-6">

 {reminderFeedback && (
 <div
 className="rounded-xl px-4 py-3 flex items-start gap-3"
 style={{
 background: reminderFeedback.type === 'success'
 ? 'rgba(45,212,160,0.10)'
 : reminderFeedback.type === 'info'
 ? 'rgba(99,102,241,0.10)'
 : 'rgba(239,68,68,0.10)',
 border: reminderFeedback.type === 'success'
 ? '1px solid rgba(45,212,160,0.30)'
 : reminderFeedback.type === 'info'
 ? '1px solid rgba(99,102,241,0.30)'
 : '1px solid rgba(239,68,68,0.30)',
 }}
 >
 <AlertCircle
 size={16}
 style={{
 color: reminderFeedback.type === 'success'
 ? 'var(--jade)'
 : reminderFeedback.type === 'info'
 ? 'var(--accent)'
 : 'var(--rose)',
 marginTop: 1,
 flexShrink: 0,
 }}
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
 {reminderFeedback.message}
 </p>
 {reminderFeedback.showConnectAction && (
 <a
 href="/settings?googleCalendar"
 className="text-xs font-semibold underline mt-1 inline-block"
 style={{ color: 'var(--accent)' }}
 >
 Connect Google Calendar
 </a>
 )}
 </div>
 <button
 onClick={() => setReminderFeedback(null)}
 className="text-xs opacity-60 hover:opacity-100 transition-opacity"
 style={{ color: 'var(--text-muted)' }}
 aria-label="Dismiss reminder feedback"
 >
 
 </button>
 </div>
 )}

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

 <div className="flex items-center gap-2.5 flex-wrap">
 <Button
 onClick={() => setShowImportModal(true)}
 variant="secondary"
 size="md"
 className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all"
 style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)', border: '1px solid var(--accent-dim)' }}
 title="Import with AI"
 data-onboarding="primary-action"
 >
 <Sparkles size={15} />
 <span className="flex flex-col items-start leading-tight">
 <span className="text-sm font-semibold">Import with AI</span>
 <span className="text-[11px] opacity-80">Parse image, PDF, or pasted text</span>
 </span>
 <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>1 Credit</span>
 </Button>

 <Button
 onClick={() => {
 setEditingEntry(null);
 // Reset pre-filled values to defaults
 setEntryType('shift');
 setEntryEmployerId(employers.length === 1 ? employers[0]._id : '');
 setEntryAppointmentTypeId('');
 setEntrySubLocationId('');
 setEntryTitle('');
 setEntryDate(new Date().toISOString().split('T')[0]);
 setEntryStartTime('09:00');
 setEntryEndTime('17:00');
 setEntryNotes('');
 setShowEntryModal(true);
 }}
 variant="secondary"
 size="md"
 className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
 title="Add manual entry"
 >
 <Plus size={16} />
 <span className="flex flex-col items-start leading-tight">
 <span className="text-sm font-semibold">Manual entry</span>
 <span className="text-[11px] opacity-80">Add one shift or appointment</span>
 </span>
 </Button>
 </div>
 </div>

 {/* Type filter pills */}
 <div className="flex items-center gap-1.5 flex-wrap">
 {([
 { key: 'all', label: 'All', icon: <Clock size={13} /> },
 { key: 'shifts', label: 'Shifts', icon: <Briefcase size={13} /> },
 { key: 'appointments', label: 'Appointments',icon: <CalendarDays size={13} /> },
 { key: 'calendar', label: 'Google Calendar', icon: <Calendar size={13} /> },
 ] as { key: typeof entryTypeFilter; label: string; icon: React.ReactNode }[]).map((f) => (
 <button
 key={f.key}
 onClick={() => setEntryTypeFilter(f.key)}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
 style={{
 background: entryTypeFilter === f.key ? 'var(--accent-bg)' : 'var(--bg-elevated)',
 border: `1px solid ${entryTypeFilter === f.key ? 'var(--accent-dim)' : 'var(--border)'}`,
 color: entryTypeFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
 }}
 >
 {f.icon}{f.label}
 </button>
 ))}
 </div>

 {/* Demo Tour Section */}
 {showMockWorkTour && (
 <div className="space-y-4">
 <TourBanner pageLabel="Time Tracker" onDismiss={dismissWorkTour} />
 <div className="opacity-80 select-none pointer-events-none">

 {/* Planned section */}
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <p className="label-overline flex items-center gap-1.5"><Circle size={10} /> Planned</p>
 <span className="badge badge-ember text-[10px]">1</span>
 </div>
 <div className="space-y-3">
 {/* Day card: planned shift */}
 <div className="card overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Thu, 12 Mar 2026</span>
 <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>demo</span>
 </div>
 <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>8h</span>
 </div>
 <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
 <li className="flex items-start gap-3 px-4 py-3">
 <div className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}><Circle size={20} /></div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <div style={{ width: 22, height: 22, borderRadius: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>AC</div>
 <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Acme Corp</span>
 <span className="font-normal ml-1 text-sm" style={{ color: 'var(--text-muted)' }}>&mdash; Morning Shift</span>
 <span className="badge badge-gold text-[10px]">shift</span>
 </div>
 <div className="flex items-center gap-3 mt-1">
 <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>08:00 &ndash; 16:30</span>
 <span className="font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>8h</span>
 <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>(30m break)</span>
 </div>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><CalendarDays size={16} /></div>
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Pencil size={14} /></div>
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></div>
 </div>
 </li>
 </ul>
 </div>
 </div>
 </div>

 {/* Done section */}
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <p className="label-overline flex items-center gap-1.5"><CheckCircle2 size={10} /> Done</p>
 <span className="badge badge-jade text-[10px]">2</span>
 </div>
 <div className="space-y-3">
 {/* Day card: done shift */}
 <div className="card overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Tue, 10 Mar 2026</span>
 <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>demo</span>
 </div>
 <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(45,212,160,0.1)', color: 'var(--jade)', border: '1px solid rgba(45,212,160,0.2)' }}>8h</span>
 </div>
 <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
 <li className="flex items-start gap-3 px-4 py-3" style={{ background: 'rgba(45,212,160,0.02)' }}>
 <div className="mt-0.5 shrink-0" style={{ color: 'var(--jade)' }}><CheckCircle2 size={20} /></div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <div style={{ width: 22, height: 22, borderRadius: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>AC</div>
 <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>Acme Corp</span>
 <span className="font-normal ml-1 text-sm" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>&mdash; Evening Shift</span>
 <span className="badge badge-gold text-[10px]">shift</span>
 </div>
 <div className="flex items-center gap-3 mt-1">
 <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>14:00 &ndash; 22:30</span>
 <span className="font-mono text-xs font-semibold" style={{ color: 'var(--jade)' }}>8h</span>
 <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>(30m break)</span>
 </div>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--jade)' }}><CheckCircle2 size={16} /></div>
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Pencil size={14} /></div>
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></div>
 </div>
 </li>
 </ul>
 </div>
 {/* Day card: done appointment */}
 <div className="card overflow-hidden">
 <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Mon, 9 Mar 2026</span>
 <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>demo</span>
 </div>
 </div>
 <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
 <li className="flex items-start gap-3 px-4 py-3" style={{ background: 'rgba(45,212,160,0.02)' }}>
 <div className="mt-0.5 shrink-0" style={{ color: 'var(--jade)' }}><CheckCircle2 size={20} /></div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <CalendarDays size={12} style={{ color: 'var(--text-muted)' }} />
 </div>
 <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>Client Strategy Meeting</span>
 <span className="badge badge-ink text-[10px]">appointment</span>
 </div>
 <div className="flex items-center gap-3 mt-1">
 <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>09:00 &ndash; 11:00</span>
 <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>Prep strategy deck beforehand</span>
 </div>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--jade)' }}><CheckCircle2 size={16} /></div>
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Pencil size={14} /></div>
 <div className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></div>
 </div>
 </li>
 </ul>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Entry list */}
 <div className="space-y-4">
 {loadingEntries ? (
 <div className="h-64 flex items-center justify-center card">
 <Spinner size="lg" />
 </div>
 ) : showMockWorkTour ? (
 // Suppress empty state when mock demo data is showing above
 null
 ) : plannedDateKeys.length === 0 && doneDateKeys.length === 0 ? (
 <div className="card flex flex-col items-center justify-center py-12 text-center gap-3">
 <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
 {entryTypeFilter === 'shifts' ? <Briefcase size={20} /> : entryTypeFilter === 'appointments' ? <CalendarDays size={20} /> : entryTypeFilter === 'calendar' ? <Calendar size={20} /> : <Clock size={20} />}
 </div>
 <div>
 <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No {entryTypeFilter === 'all' ? 'entries' : entryTypeFilter} for {MONTH_NAMES[viewMonth - 1]} {viewYear}</p>
 <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Try a different filter or month.</p>
 </div>
 </div>
 ) : (
 <>
 {/* Planned section */}
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

 {/* Done section */}
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
 Workplace breakdown {MONTH_NAMES[viewMonth - 1]}
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
 {summary.lastDate ? formatDate(summary.lastDate) : ''}
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

 {/* EMPLOYERS TAB */}
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

 {/* APPOINTMENTS TAB */}
 {activeTab === 'appointments' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Appointment Types</h2>
 <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage appointment types you use frequently.</p>
 </div>
 <button onClick={() => { setEditingAppointmentType(null); setShowAppointmentTypeModal(true); }} className="btn-primary flex items-center gap-2 text-sm max-w-fit">
 <Plus size={16} /> <span>Add type</span>
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

 {/* Modals */}
 {showImportModal && (
 <ScheduleImportModal
 employers={employers}
 appointmentTypes={appointmentTypes}
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

 </div>
 );
};

// AppointmentTypeModal Component 
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
 <div className="card w-full max-w-md animate-scale-in bg-white shadow-xl border border-[var(--border-subtle)]">
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
 {saving ? 'Saving' : editAppointmentType ? 'Save changes' : 'Add type'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

export default WorkTrackerPage;





