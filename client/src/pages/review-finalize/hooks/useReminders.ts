import { useState, useEffect } from 'react';
import { getGoogleCalendarStatus } from '../../../services/googleCalendarApi';
import { IReminder } from '../../../services/jobApi';

export const useReminders = (jobId: string | undefined, initialReminders: IReminder[] = []) => {
    const [reminders, setReminders] = useState<IReminder[]>(initialReminders);
    const [googleCalConnected, setGoogleCalConnected] = useState(false);

    useEffect(() => {
        getGoogleCalendarStatus()
            .then((s) => setGoogleCalConnected(s.connected))
            .catch(() => {/* Google Calendar not configured — not a fatal error */ });
    }, []);

    return { reminders, setReminders, googleCalConnected };
};
