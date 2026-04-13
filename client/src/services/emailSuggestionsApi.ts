// client/src/services/emailSuggestionsApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export type JobStatus = 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Offer';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';
export type Confidence = 'high' | 'medium' | 'low';

export type EmailCategory = 'application_response' | 'job_offer';

export interface JobRef {
    _id: string;
    jobTitle: string;
    companyName: string;
    status: JobStatus;
}

export interface SuggestedCalendarEvent {
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore: number;
}

export interface EmailSuggestion {
    _id: string;
    userId: string;
    jobApplicationId?: JobRef;
    gmailMessageId: string;
    emailSubject: string;
    emailSnippet: string;
    senderName?: string;
    senderEmail?: string;
    suggestedStatus: JobStatus | null;
    suggestedNote?: string;
    suggestedCalendarEvent?: SuggestedCalendarEvent;
    noteAdded?: boolean;
    confidence: Confidence;
    matchedCompanyName?: string;
    matchedJobTitle?: string;
    emailCategory: EmailCategory;
    status: SuggestionStatus;
    createdAt: string;
}

export interface CalendarEventUpdate {
    title?: string;
    description?: string;
    dateTimeISO?: string;
    notificationMinutesBefore?: number;
}

export interface UpdateSuggestionPayload {
    matchedCompanyName?: string;
    matchedJobTitle?: string;
    jobApplicationId?: string | null;
    suggestedStatus?: JobStatus | null;
    emailCategory?: EmailCategory;
    calendarEvent?: CalendarEventUpdate | null;
}

/** List all pending suggestions for the current user. */
export const listPendingSuggestions = async (): Promise<EmailSuggestion[]> => {
    const { data } = await axios.get<EmailSuggestion[]>(`${API_BASE_URL}/email-suggestions`);
    return data;
};

/** Update an email suggestion (edit matched company, job title, or job application). */
export const updateSuggestion = async (id: string, payload: UpdateSuggestionPayload): Promise<EmailSuggestion> => {
    const { data } = await axios.put<{ message: string; suggestion: EmailSuggestion }>(
        `${API_BASE_URL}/email-suggestions/${id}`,
        payload
    );
    return data.suggestion;
};

/** Accept a suggestion — applies the status change and optionally creates a calendar event. */
export const acceptSuggestion = async (id: string, options?: { includeCalendarEvent?: boolean; includeEmailLink?: boolean }): Promise<{ calendarEventCreated?: boolean; calendarWarning?: string }> => {
    const { data } = await axios.post<{ calendarEventCreated?: boolean; calendarWarning?: string }>(
        `${API_BASE_URL}/email-suggestions/${id}/accept`,
        { includeCalendarEvent: options?.includeCalendarEvent ?? true, includeEmailLink: options?.includeEmailLink ?? true }
    );
    return data;
};

/** Append the suggested note to the matched job, independent of Accept/Reject. */
export const addNoteSuggestion = async (id: string, options?: { includeEmailLink?: boolean }): Promise<void> => {
    await axios.post(`${API_BASE_URL}/email-suggestions/${id}/add-note`, { includeEmailLink: options?.includeEmailLink ?? true });
};

/** Reject / dismiss a suggestion. */
export const rejectSuggestion = async (id: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/email-suggestions/${id}/reject`);
};

export interface PollNowResult {
    message: string;
    count: number;
    scanned: number;
    applicationResponses: number;
    jobLeads: number;
}

/** Manually trigger a Gmail poll for the current user. */
export const pollNow = async (scanLimit = 50, includeReadEmails = false): Promise<PollNowResult> => {
    const { data } = await axios.post<PollNowResult>(
        `${API_BASE_URL}/email-suggestions/poll`,
        { scanLimit, includeReadEmails }
    );
    return data;
};

/** Check whether the user's Google token includes Gmail scope. */
export const getGmailScopeStatus = async (): Promise<{ hasScope: boolean }> => {
    const { data } = await axios.get<{ hasScope: boolean }>(
        `${API_BASE_URL}/email-suggestions/gmail-scope-status`
    );
    return data;
};

/** Get email suggestion preferences for the current user. */
export interface EmailSuggestionPreferences {
    lookbackDays: number;
    /** Maximum number of emails to scan per poll run. */
    scanLimit?: number;
    /** Whether the server should automatically scan application response emails on the cron schedule. */
    autoPollApplications: boolean;
    /** Whether the server should automatically scan job offer/lead emails on the cron schedule. */
    autoPollJobLeads: boolean;
    /** Whether to include already-read emails in the scan. */
    includeReadEmails: boolean;
}

export const getPreferences = async (): Promise<EmailSuggestionPreferences> => {
    const { data } = await axios.get<EmailSuggestionPreferences>(
        `${API_BASE_URL}/email-suggestions/preferences`
    );
    return data;
};

/** Update email suggestion preferences for the current user. */
export const updatePreferences = async (preferences: Partial<EmailSuggestionPreferences>): Promise<EmailSuggestionPreferences> => {
    const { data } = await axios.put<EmailSuggestionPreferences>(
        `${API_BASE_URL}/email-suggestions/preferences`,
        preferences
    );
    return data;
};
