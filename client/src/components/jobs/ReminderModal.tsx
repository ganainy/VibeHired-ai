// client/src/components/jobs/ReminderModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { parseReminderApi, addReminderApi, IReminder, ParsedReminder, AddReminderPayload } from '../../services/jobApi';
import Spinner from '../common/Spinner';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

// Map app language codes to BCP-47 speech API codes
function toSpeechLang(lang?: string): string {
 const map: Record<string, string> = {
 de: 'de-DE',
 en: 'en-US',
 };
 return (lang && map[lang]) ? map[lang] : 'en-US';
}

const VOICE_LANGUAGES = [
 { value: 'en-US', label: 'English' },
 { value: 'de-DE', label: 'Deutsch' },
 { value: 'fr-FR', label: 'Français' },
 { value: 'es-ES', label: 'Español' },
 { value: 'ar-SA', label: 'العربية' },
];

interface ReminderModalProps {
 isOpen: boolean;
 onClose: () => void;
 jobId: string;
 jobTitle: string;
 companyName: string;
 googleConnected: boolean;
 language?: string;
 onReminderAdded: (reminder: IReminder) => void;
}

type Phase = 'input' | 'preview';

// ── Icons ────────────────────────────────────────────────────────────────────
const CalendarIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
 <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
 </svg>
);

const SparklesIcon = () => (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
 </svg>
);

const MicIcon = () => (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5a7.5 7.5 0 01-15 0" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75v3M8.25 21.75h7.5" />
 </svg>
);

const StopIcon = () => (
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
 <rect x="6" y="6" width="12" height="12" rx="2" />
 </svg>
);

const BackIcon = () => (
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
 </svg>
);

// ── Step progress indicator ───────────────────────────────────────────────────
const Stepper: React.FC<{ phase: Phase }> = ({ phase }) => (
 <div className="flex items-center px-5 py-3 border-b border-[var(--border-subtle)] bg-elevated/60">
 <div className="flex items-center gap-2">
 <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all ${
 phase === 'input'
? 'bg-warm text-white shadow-sm shadow-amber-500/25'
  : 'bg-green text-white'
  }`}>
  {phase === 'input' ? '1' : (
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
 </svg>
 )}
 </div>
<span className={`text-xs font-medium ${
  phase === 'input' ? 'text-primary-color' : 'text-green'
  }`}>Describe</span>
 </div>
 <div className={`flex-1 mx-3 h-px transition-colors ${
 phase === 'preview' ? 'bg-green' : 'bg-[var(--bg-raised)]'
 }`} />
 <div className="flex items-center gap-2">
 <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all ${
 phase === 'preview'
? 'bg-warm text-white shadow-sm shadow-amber-500/25'
  : 'bg-[var(--bg-raised)] text-muted-color'
 }`}>2</div>
<span className={`text-xs font-medium ${
  phase === 'preview' ? 'text-primary-color' : 'text-muted-color'
  }`}>Review &amp; Save</span>
 </div>
 </div>
);

// ── Listening wave animation ──────────────────────────────────────────────────
const ListeningWave = () => (
 <span className="flex items-end gap-[2px] h-3.5">
 {[0.5, 1, 0.7, 1, 0.5].map((h, i) => (
 <span
 key={i}
 className="w-[3px] rounded-full bg-error animate-bounce"
 style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s`, animationDuration: '0.65s' }}
 />
 ))}
 </span>
);

const ReminderModal: React.FC<ReminderModalProps> = ({
 isOpen,
 onClose,
 jobId,
 jobTitle,
 companyName,
 googleConnected,
 language,
 onReminderAdded,
}) => {
 const [selectedLang, setSelectedLang] = useState(() => toSpeechLang(language));
 const [phase, setPhase] = useState<Phase>('input');
 const [naturalText, setNaturalText] = useState('');
 const [parsed, setParsed] = useState<ParsedReminder | null>(null);

 // Editable parsed fields
 const [editTitle, setEditTitle] = useState('');
 const [editDescription, setEditDescription] = useState('');
 const [editDateTime, setEditDateTime] = useState('');
 const [editNotificationMins, setEditNotificationMins] = useState(30);

 const [isParsing, setIsParsing] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const textareaRef = useRef<HTMLTextAreaElement>(null);
 const stt = useSpeechRecognition();

 // Sync speech transcript → naturalText
 useEffect(() => {
 if (stt.transcript) {
 setNaturalText(stt.transcript);
 }
 }, [stt.transcript]);

 useEffect(() => {
 if (isOpen) {
 setPhase('input');
 setNaturalText('');
 setParsed(null);
 setError(null);
 stt.stopListening();
 stt.resetTranscript();
 setSelectedLang(toSpeechLang(language));
 setTimeout(() => textareaRef.current?.focus(), 100);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isOpen]);

 const handleToggleMic = () => {
 if (stt.isListening) {
 stt.stopListening();
 } else {
 stt.resetTranscript();
 setNaturalText('');
 stt.startListening(selectedLang);
 }
 };

 const handleParse = async () => {
 if (!naturalText.trim()) return;
 setIsParsing(true);
 setError(null);
 try {
 const result = await parseReminderApi(jobId, naturalText.trim());
 setParsed(result);
 setEditTitle(result.title);
 setEditDescription(result.description);
 // Convert ISO to local datetime-local input value (YYYY-MM-DDTHH:mm)
 const dt = new Date(result.dateTimeISO);
 const localISO = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
 .toISOString()
 .slice(0, 16);
 setEditDateTime(localISO);
 setEditNotificationMins(result.notificationMinutesBefore);
 setPhase('preview');
 } catch (err: any) {
 setError(err?.response?.data?.message || err?.message || 'AI parsing failed. Try rephrasing.');
 } finally {
 setIsParsing(false);
 }
 };

 const handleSave = async () => {
 setIsSaving(true);
 setError(null);
 try {
 // Convert local datetime-local value back to ISO
 const dateTimeISO = new Date(editDateTime).toISOString();
 const payload: AddReminderPayload = {
 naturalText,
 title: editTitle,
 description: editDescription,
 dateTimeISO,
 notificationMinutesBefore: editNotificationMins,
 };
 const result = await addReminderApi(jobId, payload);
 onReminderAdded(result.reminder);
 onClose();
 } catch (err: any) {
 setError(err?.response?.data?.message || err?.message || 'Failed to save reminder.');
 } finally {
 setIsSaving(false);
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Escape') onClose();
 };

 if (!isOpen) return null;

 const inputCls = "w-full px-3 py-2.5 border border-theme rounded-lg bg-white text-primary-color text-sm placeholder-muted-color focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors disabled:opacity-60";

 return (
 <div
 className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex justify-center items-center z-50 p-4"
 onClick={onClose}
 >
 <div
 className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
 onClick={(e) => e.stopPropagation()}
 onKeyDown={handleKeyDown}
 >
 {/* ── Header ── */}
 <div className="flex justify-between items-start px-5 pt-5 pb-4">
 <div className="flex items-start gap-3">
 <div className="mt-0.5 p-2 rounded-xl bg-[var(--ember-bg)] text-ember flex-shrink-0">
 <CalendarIcon className="w-5 h-5" />
 </div>
 <div>
<h2 className="text-base font-semibold text-primary-color leading-tight">
  Add Reminder
  </h2>
  <p className="text-xs text-muted-color mt-0.5 truncate max-w-[280px]">
 {jobTitle} · {companyName}
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-1.5 rounded-lg text-muted-color hover:text-secondary-color hover:bg-[var(--bg-raised)] transition-colors"
 aria-label="Close"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* ── Step indicator ── */}
 <Stepper phase={phase} />

 {/* ── Banners ── */}
 <div className="px-5">
 {!googleConnected && (
 <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-[var(--ember-bg)] border border-[var(--ember)] text-xs text-ember">
 <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span>
 <a href="/settings?googleCalendar" className="underline font-semibold">Connect Google Calendar</a>{' '}
 to auto-sync. You can still save without syncing.
 </span>
 </div>
 )}
 {error && (
 <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-[var(--rose-bg)] border border-error text-xs text-error">
 <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
 </svg>
 {error}
 </div>
 )}
 </div>

 {/* ══ Phase 1 — Describe ══ */}
 {phase === 'input' && (
 <div className="px-5 pt-4 pb-5 space-y-4">
 <div className="space-y-1.5">
 <label className="block text-sm font-medium text-secondary-color">
 What do you want to be reminded about?
 </label>

 {/* Textarea with embedded voice bar */}
 <div className={`rounded-xl border overflow-hidden transition-all ${
 stt.isListening
? 'border-error ring-2 ring-red-400/20'
  : 'border-theme focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20'
 }`}>
 <textarea
 ref={textareaRef}
 value={naturalText}
 onChange={(e) => {
 setNaturalText(e.target.value);
 if (stt.isListening) stt.stopListening();
 }}
 rows={4}
 placeholder={
 stt.isListening
 ? 'Listening — speak now…'
 : 'e.g. "Send a follow-up email if I haven\'t heard back in one week"'
 }
 className="w-full px-4 py-3 bg-white text-primary-color text-sm placeholder-muted-color focus:outline-none resize-none"
 disabled={isParsing}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleParse();
 }}
 />

 {/* Voice control bar */}
 {stt.isSupported && (
 <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)] bg-elevated/80">
 {/* Language selector */}
 <div className="flex items-center gap-1.5 text-secondary-color">
 <MicIcon />
 <select
 value={selectedLang}
 onChange={(e) => {
 setSelectedLang(e.target.value);
 if (stt.isListening) stt.stopListening();
 }}
 disabled={isParsing}
 className="text-xs bg-transparent border-none focus:outline-none focus:ring-0 text-secondary-color cursor-pointer disabled:opacity-40"
 >
 {VOICE_LANGUAGES.map((l) => (
 <option key={l.value} value={l.value}>{l.label}</option>
 ))}
 </select>
 </div>

 {/* Listening state + toggle */}
 <div className="flex items-center gap-2">
 {stt.isListening && (
 <span className="flex items-center gap-1.5 text-xs font-medium text-error">
 <ListeningWave />
 Listening
 </span>
 )}
 <button
 type="button"
 onClick={handleToggleMic}
 disabled={isParsing}
 title={stt.isListening ? 'Stop recording' : 'Speak your reminder'}
 className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
 stt.isListening
? 'bg-error hover:bg-red-700 text-white'
  : 'bg-white border border-theme text-secondary-color hover:border-gold hover:text-ember'
 } disabled:opacity-40`}
 >
 {stt.isListening ? <><StopIcon /> Stop</> : <><MicIcon /> Speak</>}
 </button>
 </div>
 </div>
 )}
 </div>

<p className="text-[11px] text-muted-color pl-1">
  Be specific with dates — "next Monday at 10am" or "in 3 days" ·{' '}
  <kbd className="px-1 py-0.5 rounded bg-[var(--bg-raised)] font-mono text-[10px]">Ctrl+Enter</kbd> to parse
  </p>
 </div>

 <div className="flex justify-end gap-2 pt-1">
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm text-secondary-color hover:text-primary-color rounded-lg hover:bg-[var(--bg-raised)] transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleParse}
 disabled={isParsing || !naturalText.trim()}
className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-warm hover:bg-gold-dark text-white shadow-sm shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
  >
  {isParsing ? (
  <><Spinner size="sm" /> Parsing…</>
 ) : (
 <><SparklesIcon /> Parse with AI</>
 )}
 </button>
 </div>
 </div>
 )}

 {/* ══ Phase 2 — Review & Save ══ */}
 {phase === 'preview' && parsed && (
 <div className="px-5 pt-4 pb-5 space-y-4">
 {/* Original text context */}
<div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-elevated border border-[var(--border-subtle)]">
  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-color" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
 </svg>
 <p className="text-xs text-secondary-color italic line-clamp-2">&ldquo;{naturalText}&rdquo;</p>
 </div>

 {/* Form fields */}
 <div className="space-y-3">
 <div>
 <label className="block text-xs font-semibold text-secondary-color uppercase tracking-wide mb-1.5">Event title</label>
 <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputCls} disabled={isSaving} />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-semibold text-secondary-color uppercase tracking-wide mb-1.5">Date &amp; time</label>
 <input type="datetime-local" value={editDateTime} onChange={(e) => setEditDateTime(e.target.value)} className={inputCls} disabled={isSaving} />
 </div>
 <div>
 <label className="block text-xs font-semibold text-secondary-color uppercase tracking-wide mb-1.5">Notify before</label>
 <select value={editNotificationMins} onChange={(e) => setEditNotificationMins(Number(e.target.value))} className={inputCls} disabled={isSaving}>
 <option value={0}>At event time</option>
 <option value={10}>10 min</option>
 <option value={30}>30 min</option>
 <option value={60}>1 hour</option>
 <option value={1440}>1 day</option>
 </select>
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
 Description <span className="normal-case font-normal text-muted-color">(optional)</span>
 </label>
 <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} disabled={isSaving} />
 </div>
 </div>

 {/* Date summary pill */}
 {editDateTime && (
 <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ember-bg)] border border-[var(--ember)] text-xs text-ember">
 <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
 {new Date(editDateTime).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
 </div>
 )}

 {googleConnected && (
 <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--jade-bg)] border border-green text-xs text-green">
 <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 Will be synced to your Google Calendar
 </div>
 )}

 <div className="flex items-center justify-between gap-3 pt-1">
 <button
 onClick={() => { setPhase('input'); setError(null); }}
 disabled={isSaving}
 className="flex items-center gap-1.5 text-sm text-secondary-color hover:text-primary-color disabled:opacity-40 transition-colors"
 >
 <BackIcon /> Edit text
 </button>
 <div className="flex items-center gap-2">
 <button
 onClick={onClose}
 disabled={isSaving}
 className="px-4 py-2 text-sm text-secondary-color hover:text-primary-color rounded-lg hover:bg-[var(--bg-raised)] transition-colors disabled:opacity-40"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={isSaving || !editTitle.trim() || !editDateTime}
 className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-warm hover:bg-gold-dark text-white shadow-sm shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 >
 {isSaving ? (
 <><Spinner size="sm" /> Saving…</>
 ) : (
 <><CalendarIcon className="w-4 h-4" /> Add Reminder</>
 )}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default ReminderModal;
