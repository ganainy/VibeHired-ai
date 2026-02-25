// client/src/components/jobs/ReminderModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { parseReminderApi, addReminderApi, IReminder, ParsedReminder, AddReminderPayload } from '../../services/jobApi';
import Spinner from '../common/Spinner';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    jobTitle: string;
    companyName: string;
    googleConnected: boolean;
    onReminderAdded: (reminder: IReminder) => void;
}

type Phase = 'input' | 'preview';

const CalendarIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
    </svg>
);

const SparklesIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
);

function formatDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return iso;
    }
}

const ReminderModal: React.FC<ReminderModalProps> = ({
    isOpen,
    onClose,
    jobId,
    jobTitle,
    companyName,
    googleConnected,
    onReminderAdded,
}) => {
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

    useEffect(() => {
        if (isOpen) {
            setPhase('input');
            setNaturalText('');
            setParsed(null);
            setError(null);
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isOpen]);

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

    return (
        <div
            className="fixed inset-0 bg-black/60 dark:bg-black/80 flex justify-center items-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 dark:text-amber-400">
                            <CalendarIcon />
                        </span>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Add Reminder
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Google Calendar status banner */}
                {!googleConnected && (
                    <div className="mx-5 mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-sm text-amber-800 dark:text-amber-300">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                            Connect Google Calendar in{' '}
                            <a href="/settings?googleCalendar" className="underline font-medium">Settings</a>{' '}
                            to auto-sync reminders. You can still save the reminder without syncing.
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mx-5 mt-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* Phase 1 — Input */}
                {phase === 'input' && (
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Describe your reminder in plain language. AI will convert it to a calendar event.
                        </p>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                What do you want to be reminded about?
                            </label>
                            <textarea
                                ref={textareaRef}
                                value={naturalText}
                                onChange={(e) => setNaturalText(e.target.value)}
                                rows={3}
                                placeholder={`e.g. "Send a follow-up email if I haven't heard back in one week"`}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
                                disabled={isParsing}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleParse();
                                }}
                            />
                            <p className="text-xs text-gray-400 dark:text-gray-500">Ctrl+Enter to parse</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleParse}
                                disabled={isParsing || !naturalText.trim()}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

                {/* Phase 2 — Preview / Edit */}
                {phase === 'preview' && parsed && (
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Review and adjust the parsed reminder before saving.
                        </p>

                        <div className="space-y-3">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Event title
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Date / time */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Date &amp; time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={editDateTime}
                                    onChange={(e) => setEditDateTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Notification timing */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Notify me (minutes before event)
                                </label>
                                <select
                                    value={editNotificationMins}
                                    onChange={(e) => setEditNotificationMins(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                    disabled={isSaving}
                                >
                                    <option value={0}>At time of event</option>
                                    <option value={10}>10 minutes before</option>
                                    <option value={30}>30 minutes before</option>
                                    <option value={60}>1 hour before</option>
                                    <option value={1440}>1 day before</option>
                                </select>
                            </div>
                        </div>

                        {/* Calendar sync info */}
                        {googleConnected && (
                            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 rounded-lg px-3 py-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Will be synced to your Google Calendar
                            </div>
                        )}

                        <div className="flex justify-between items-center gap-3 pt-1">
                            <button
                                onClick={() => { setPhase('input'); setError(null); }}
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                disabled={isSaving}
                            >
                                ← Edit text
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !editTitle.trim() || !editDateTime}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSaving ? (
                                        <><Spinner size="sm" /> Saving…</>
                                    ) : (
                                        <><CalendarIcon /> Add Reminder</>
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
