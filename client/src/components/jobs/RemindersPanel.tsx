// client/src/components/jobs/RemindersPanel.tsx
import React, { useState } from 'react';
import { IReminder, deleteReminderApi } from '../../services/jobApi';
import ReminderModal from './ReminderModal';
import Spinner from '../common/Spinner';

interface RemindersPanelProps {
    jobId: string;
    jobTitle: string;
    companyName: string;
    reminders: IReminder[];
    googleConnected: boolean;
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

const statusColors: Record<IReminder['status'], string> = {
    synced: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700',
    pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700',
};

const statusLabels: Record<IReminder['status'], string> = {
    synced: '✓ Synced to Calendar',
    pending: '◷ Pending sync',
    error: '✗ Sync failed',
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

const RemindersPanel: React.FC<RemindersPanelProps> = ({
    jobId,
    jobTitle,
    companyName,
    reminders,
    googleConnected,
    onRemindersChange,
    onToast,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <CalendarIcon />
                    <h3 className="font-semibold text-sm">Reminders</h3>
                    {reminders.length > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            ({reminders.length})
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white transition-colors"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Reminder
                </button>
            </div>

            {/* Google Calendar not connected notice (compact) */}
            {!googleConnected && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                    <a href="/settings?googleCalendar" className="underline text-amber-600 dark:text-amber-400">
                        Connect Google Calendar
                    </a>{' '}
                    to auto-sync reminders.
                </p>
            )}

            {/* Reminders list */}
            {reminders.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <CalendarIcon />
                    <p className="mt-2">No reminders yet.</p>
                    <p className="text-xs mt-1">Add one to stay on top of follow-ups.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {reminders.map((reminder) => (
                        <li
                            key={reminder.id}
                            className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
                        >
                            <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {reminder.title}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDateTime(reminder.dateTimeISO)}
                                    {reminder.notificationMinutesBefore > 0 && (
                                        <> · notify {reminder.notificationMinutesBefore < 60
                                            ? `${reminder.notificationMinutesBefore} min`
                                            : `${reminder.notificationMinutesBefore / 60} hr`} before</>
                                    )}
                                </p>
                                {reminder.description && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                                        {reminder.description}
                                    </p>
                                )}
                                <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[reminder.status]}`}>
                                    {statusLabels[reminder.status]}
                                </span>
                            </div>

                            {/* Delete */}
                            <button
                                onClick={() => handleDelete(reminder.id)}
                                disabled={deletingId === reminder.id}
                                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                                title="Delete reminder"
                            >
                                {deletingId === reminder.id ? (
                                    <Spinner size="sm" />
                                ) : (
                                    <TrashIcon />
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <ReminderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                jobId={jobId}
                jobTitle={jobTitle}
                companyName={companyName}
                googleConnected={googleConnected}
                onReminderAdded={handleReminderAdded}
            />
        </div>
    );
};

export default RemindersPanel;
