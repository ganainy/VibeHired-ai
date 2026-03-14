// client/src/components/jobs/RemindersPanel.tsx
import React, { useState } from 'react';
import {
    IReminder,
    IFollowUpSuggestion,
    deleteReminderApi,
    dismissFollowUpApi,
    generateFollowUpDraftApi,
    getFollowUpSuggestionApi,
    markFollowUpSentApi,
    snoozeFollowUpOneWeekApi,
} from '../../services/jobApi';
import ReminderModal from './ReminderModal';
import Spinner from '../common/Spinner';

interface RemindersPanelProps {
    jobId: string;
    jobTitle: string;
    companyName: string;
    reminders: IReminder[];
    googleConnected: boolean;
    language?: string;
    onRemindersChange: (reminders: IReminder[]) => void;
    onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
    </svg>
);

const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const statusConfig: Record<IReminder['status'], { dot: string; badge: string; label: string }> = {
    synced: {
        dot: 'bg-green-500',
        badge: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700',
        label: 'Synced to Calendar',
    },
    pending: {
        dot: 'bg-amber-400',
        badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700',
        label: 'Pending sync',
    },
    error: {
        dot: 'bg-red-500',
        badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700',
        label: 'Sync failed',
    },
};

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

function buildGmailComposeUrl(to?: string, subject?: string, body?: string): string {
    const params = new URLSearchParams();
    if (to) params.set('to', to);
    if (subject) params.set('su', subject);
    if (body) params.set('body', body);
    return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
}

const RemindersPanel: React.FC<RemindersPanelProps> = ({
    jobId,
    jobTitle,
    companyName,
    reminders,
    googleConnected,
    language,
    onRemindersChange,
    onToast,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [followUpSuggestion, setFollowUpSuggestion] = useState<IFollowUpSuggestion | null>(null);
    const [isLoadingFollowUp, setIsLoadingFollowUp] = useState<boolean>(true);
    const [isGeneratingFollowUpDraft, setIsGeneratingFollowUpDraft] = useState<boolean>(false);
    const [followUpAction, setFollowUpAction] = useState<'snooze' | 'dismiss' | 'sent' | null>(null);

    React.useEffect(() => {
        let mounted = true;

        const loadFollowUp = async () => {
            setIsLoadingFollowUp(true);
            try {
                const suggestion = await getFollowUpSuggestionApi(jobId);
                if (mounted) {
                    setFollowUpSuggestion(suggestion);
                }
            } catch {
                if (mounted) {
                    setFollowUpSuggestion(null);
                }
            } finally {
                if (mounted) {
                    setIsLoadingFollowUp(false);
                }
            }
        };

        loadFollowUp();
        return () => {
            mounted = false;
        };
    }, [jobId]);

    const handleReminderAdded = (reminder: IReminder) => {
        const updated = [...reminders, reminder];
        onRemindersChange(updated);
        const syncMsg = reminder.status === 'synced' ? ' and synced to Google Calendar' : '';
        onToast?.(`Reminder added${syncMsg}.`, 'success');
    };

    const handleDelete = async (reminderId: string) => {
        setDeletingId(reminderId);
        try {
            const result = await deleteReminderApi(jobId, reminderId);
            onRemindersChange(result.reminders);
            onToast?.('Reminder deleted.', 'info');
        } catch (err: any) {
            onToast?.(err?.response?.data?.message || 'Failed to delete reminder.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const canShowFollowUpCard = followUpSuggestion && (
        followUpSuggestion.status === 'suggested' ||
        followUpSuggestion.status === 'snoozed' ||
        followUpSuggestion.isDue
    );

    const handleGenerateFollowUpDraft = async () => {
        setIsGeneratingFollowUpDraft(true);
        try {
            const suggestion = await generateFollowUpDraftApi(jobId);
            setFollowUpSuggestion(suggestion);
            onToast?.('AI follow-up email draft generated.', 'success');
        } catch (err: any) {
            onToast?.(err?.response?.data?.message || 'Failed to generate follow-up email.', 'error');
        } finally {
            setIsGeneratingFollowUpDraft(false);
        }
    };

    const handleSnoozeOneWeek = async () => {
        setFollowUpAction('snooze');
        try {
            const suggestion = await snoozeFollowUpOneWeekApi(jobId);
            setFollowUpSuggestion(suggestion);
            onToast?.('Follow-up suggestion snoozed for 1 week.', 'info');
        } catch (err: any) {
            onToast?.(err?.response?.data?.message || 'Failed to snooze follow-up.', 'error');
        } finally {
            setFollowUpAction(null);
        }
    };

    const handleDismissFollowUp = async () => {
        setFollowUpAction('dismiss');
        try {
            const suggestion = await dismissFollowUpApi(jobId);
            setFollowUpSuggestion(suggestion);
            onToast?.('Follow-up suggestion dismissed.', 'info');
        } catch (err: any) {
            onToast?.(err?.response?.data?.message || 'Failed to dismiss follow-up.', 'error');
        } finally {
            setFollowUpAction(null);
        }
    };

    const handleMarkFollowUpSent = async () => {
        setFollowUpAction('sent');
        try {
            const suggestion = await markFollowUpSentApi(jobId);
            setFollowUpSuggestion(suggestion);
            onToast?.('Marked follow-up as sent.', 'success');
        } catch (err: any) {
            onToast?.(err?.response?.data?.message || 'Failed to mark follow-up as sent.', 'error');
        } finally {
            setFollowUpAction(null);
        }
    };

    const handleCopyFollowUpBody = async () => {
        if (!followUpSuggestion?.draftBody) return;
        try {
            await navigator.clipboard.writeText(followUpSuggestion.draftBody);
            onToast?.('Follow-up email copied to clipboard.', 'success');
        } catch {
            onToast?.('Could not copy to clipboard.', 'error');
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400">
                        <CalendarIcon />
                    </div>
                    <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Reminders</h3>
                    {reminders.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                            {reminders.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-sm shadow-amber-500/20 transition-all"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Reminder
                </button>
            </div>

            {/* Google Calendar not connected notice */}
            {!googleConnected && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                        <a href="/settings?googleCalendar" className="underline text-amber-600 dark:text-amber-400 font-medium">
                            Connect Google Calendar
                        </a>{' '}
                        to auto-sync reminders.
                    </span>
                </div>
            )}

            {/* Reminders list */}
            {isLoadingFollowUp ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Spinner size="sm" />
                    <span>Checking follow-up suggestion...</span>
                </div>
            ) : canShowFollowUpCard && followUpSuggestion && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/70 dark:bg-blue-900/20 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">No response follow-up</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                                {followUpSuggestion.isDue
                                    ? `It has been ${followUpSuggestion.daysWithoutResponse} days since this application. Suggested follow-up starts at day 14.`
                                    : `Follow-up reminder will trigger on ${formatDateTime(followUpSuggestion.dueDateISO)}.`}
                            </p>
                            {followUpSuggestion.recipientEmail && (
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    To:{' '}
                                    <a
                                        href={buildGmailComposeUrl(
                                            followUpSuggestion.recipientEmail,
                                            followUpSuggestion.draftSubject,
                                            followUpSuggestion.draftBody
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold hover:underline"
                                        title="Open Gmail draft addressed to this recipient"
                                    >
                                        {followUpSuggestion.recipientEmail}
                                    </a>
                                </p>
                            )}
                            {followUpSuggestion.status === 'snoozed' && followUpSuggestion.snoozedUntil && (
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Snoozed until {formatDateTime(followUpSuggestion.snoozedUntil)}
                                </p>
                            )}
                        </div>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                            AI Suggestion
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleGenerateFollowUpDraft}
                            disabled={isGeneratingFollowUpDraft || followUpAction !== null}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                        >
                            {isGeneratingFollowUpDraft ? 'Generating...' : 'Generate AI Email'}
                        </button>
                        <button
                            onClick={handleSnoozeOneWeek}
                            disabled={isGeneratingFollowUpDraft || followUpAction !== null}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 disabled:opacity-60"
                        >
                            {followUpAction === 'snooze' ? 'Snoozing...' : 'Snooze 1 Week'}
                        </button>
                        <button
                            onClick={handleMarkFollowUpSent}
                            disabled={isGeneratingFollowUpDraft || followUpAction !== null}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                        >
                            {followUpAction === 'sent' ? 'Saving...' : 'Mark Sent'}
                        </button>
                        <button
                            onClick={handleDismissFollowUp}
                            disabled={isGeneratingFollowUpDraft || followUpAction !== null}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-transparent border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 disabled:opacity-60"
                        >
                            {followUpAction === 'dismiss' ? 'Dismissing...' : 'Dismiss'}
                        </button>
                    </div>

                    {followUpSuggestion.draftBody && (
                        <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-white/80 dark:bg-gray-900/50 p-3 space-y-2">
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                                Subject: {followUpSuggestion.draftSubject || 'Follow-up on my application'}
                            </p>
                            <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                {followUpSuggestion.draftBody}
                            </p>
                            <div className="flex justify-end">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleCopyFollowUpBody}
                                        className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
                                    >
                                        Copy Email Body
                                    </button>
                                    {followUpSuggestion.recipientEmail && (
                                        <a
                                            href={buildGmailComposeUrl(
                                                followUpSuggestion.recipientEmail,
                                                followUpSuggestion.draftSubject,
                                                followUpSuggestion.draftBody
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
                                        >
                                            Open in Gmail Draft
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                    <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-3h.008v.008H12V12zm0 3h.008v.008H12V15zm-3 0h.008v.008H9V15zm6 0h.008v.008H15V15z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No reminders yet</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add one to stay on top of follow-ups</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                    >
                        + Add your first reminder
                    </button>
                </div>
            ) : (
                <ul className="space-y-2">
                    {reminders.map((reminder) => {
                        const cfg = statusConfig[reminder.status];
                        return (
                            <li
                                key={reminder.id}
                                className="relative flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden group"
                            >
                                {/* Left accent bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${cfg.dot}`} />

                                {/* Calendar date badge */}
                                <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/25 border border-amber-100 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 ml-1">
                                    <span className="text-[10px] font-semibold uppercase leading-none">
                                        {new Date(reminder.dateTimeISO).toLocaleString(undefined, { month: 'short' })}
                                    </span>
                                    <span className="text-base font-bold leading-tight">
                                        {new Date(reminder.dateTimeISO).getDate()}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                                        {reminder.title}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatDateTime(reminder.dateTimeISO)}
                                        {reminder.notificationMinutesBefore > 0 && (
                                            <span className="text-gray-400 dark:text-gray-500">
                                                {' '}· notify{' '}
                                                {reminder.notificationMinutesBefore < 60
                                                    ? `${reminder.notificationMinutesBefore} min`
                                                    : `${reminder.notificationMinutesBefore / 60} hr`} before
                                            </span>
                                        )}
                                    </p>
                                    {reminder.description && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                                            {reminder.description}
                                        </p>
                                    )}
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                        {cfg.label}
                                    </span>
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDelete(reminder.id)}
                                    disabled={deletingId === reminder.id}
                                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all"
                                    title="Delete reminder"
                                >
                                    {deletingId === reminder.id ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <TrashIcon />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ReminderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                jobId={jobId}
                jobTitle={jobTitle}
                companyName={companyName}
                googleConnected={googleConnected}
                language={language}
                onReminderAdded={handleReminderAdded}
            />
        </div>
    );
};

export default RemindersPanel;
