// client/src/services/emailSuggestionsApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export type JobStatus = 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Offer';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';
export type Confidence = 'high' | 'medium' | 'low';

export interface JobRef {
    _id: string;
    jobTitle: string;
    companyName: string;
    status: JobStatus;
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
    confidence: Confidence;
    matchedCompanyName?: string;
    matchedJobTitle?: string;
    status: SuggestionStatus;
    createdAt: string;
}

/** List all pending suggestions for the current user. */
export const listPendingSuggestions = async (): Promise<EmailSuggestion[]> => {
    const { data } = await axios.get<EmailSuggestion[]>(`${API_BASE_URL}/email-suggestions`);
    return data;
};

/** Accept a suggestion — applies the status + note to the matched job. */
export const acceptSuggestion = async (id: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/email-suggestions/${id}/accept`);
};

/** Reject / dismiss a suggestion. */
export const rejectSuggestion = async (id: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/email-suggestions/${id}/reject`);
};

/** Manually trigger a Gmail poll for the current user. */
export const pollNow = async (lookbackDays = 7): Promise<{ count: number; message: string }> => {
    const { data } = await axios.post<{ count: number; message: string }>(
        `${API_BASE_URL}/email-suggestions/poll`,
        { lookbackDays }
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
