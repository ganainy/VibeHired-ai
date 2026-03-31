// src/services/__tests__/emailSuggestionsApi.test.ts
/**
 * Unit tests for the email suggestions API service module.
 * Axios is mocked so no real HTTP calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
    listPendingSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    addNoteSuggestion,
    pollNow,
    getGmailScopeStatus,
    type EmailSuggestion,
} from '../emailSuggestionsApi';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

// ── Shared fixture ────────────────────────────────────────────────────────────

const makeSuggestion = (overrides: Partial<EmailSuggestion> = {}): EmailSuggestion => ({
    _id: 'sug-001',
    userId: 'user-001',
    gmailMessageId: 'gmail-001',
    emailSubject: 'Interview invitation — Senior Engineer',
    emailSnippet: 'We would like to invite you for an interview on March 10th at 2pm.',
    senderName: 'Acme Corp Recruiter',
    senderEmail: 'hr@acme.com',
    suggestedStatus: 'Interview',
    suggestedNote: 'Interview scheduled for March 10th at 2pm. Interviewer is the engineering lead.',
    suggestedCalendarEvent: {
        title: 'Interview at Acme Corp',
        description: 'Engineering interview with the lead.',
        dateTimeISO: '2026-03-10T14:00:00Z',
        notificationMinutesBefore: 30,
    },
    confidence: 'high',
    matchedCompanyName: 'Acme Corp',
    matchedJobTitle: 'Senior Engineer',
    status: 'pending',
    createdAt: '2026-02-27T10:00:00Z',
    emailCategory: 'application_response' as const,
    ...overrides,
});

// ── listPendingSuggestions ────────────────────────────────────────────────────

describe('listPendingSuggestions', () => {
    it('returns the array from the API response', async () => {
        const suggestions = [makeSuggestion(), makeSuggestion({ _id: 'sug-002', suggestedStatus: 'Rejected' })];
        mockedAxios.get = vi.fn().mockResolvedValueOnce({ data: suggestions });

        const result = await listPendingSuggestions();

        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/email-suggestions'));
        expect(result).toHaveLength(2);
        expect(result[0]._id).toBe('sug-001');
    });

    it('propagates errors thrown by axios', async () => {
        mockedAxios.get = vi.fn().mockRejectedValueOnce(new Error('Network error'));
        await expect(listPendingSuggestions()).rejects.toThrow('Network error');
    });
});

// ── acceptSuggestion ─────────────────────────────────────────────────────────

describe('acceptSuggestion', () => {
    beforeEach(() => {
        mockedAxios.post = vi.fn().mockResolvedValue({
            data: { calendarEventCreated: true },
        });
    });

    it('posts to the correct endpoint with includeCalendarEvent defaulting to true', async () => {
        await acceptSuggestion('sug-001');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/email-suggestions/sug-001/accept'),
            { includeCalendarEvent: true, includeEmailLink: true }
        );
    });

    it('passes includeCalendarEvent: false when user opts out', async () => {
        await acceptSuggestion('sug-001', { includeCalendarEvent: false });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/email-suggestions/sug-001/accept'),
            { includeCalendarEvent: false, includeEmailLink: true }
        );
    });

    it('returns calendarEventCreated and calendarWarning from the response', async () => {
        mockedAxios.post = vi.fn().mockResolvedValueOnce({
            data: { calendarEventCreated: false, calendarWarning: 'Google Calendar not connected.' },
        });

        const result = await acceptSuggestion('sug-001');

        expect(result.calendarEventCreated).toBe(false);
        expect(result.calendarWarning).toBe('Google Calendar not connected.');
    });

    it('returns empty object when server responds with no calendar fields', async () => {
        mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: {} });
        const result = await acceptSuggestion('sug-001');
        expect(result.calendarEventCreated).toBeUndefined();
        expect(result.calendarWarning).toBeUndefined();
    });
});

// ── addNoteSuggestion ─────────────────────────────────────────────────────────

describe('addNoteSuggestion', () => {
    it('posts to the add-note endpoint', async () => {
        mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: { message: 'Note added.' } });

        await addNoteSuggestion('sug-001');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/email-suggestions/sug-001/add-note'),
            { includeEmailLink: true }
        );
    });

    it('resolves without a return value', async () => {
        mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: {} });
        const result = await addNoteSuggestion('sug-001');
        expect(result).toBeUndefined();
    });

    it('propagates errors thrown by axios', async () => {
        mockedAxios.post = vi.fn().mockRejectedValueOnce(new Error('401 Unauthorized'));
        await expect(addNoteSuggestion('sug-001')).rejects.toThrow('401 Unauthorized');
    });
});

// ── rejectSuggestion ─────────────────────────────────────────────────────────

describe('rejectSuggestion', () => {
    it('posts to the reject endpoint', async () => {
        mockedAxios.post = vi.fn().mockResolvedValueOnce({ data: {} });

        await rejectSuggestion('sug-001');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/email-suggestions/sug-001/reject')
        );
    });
});

// ── pollNow ──────────────────────────────────────────────────────────────────

describe('pollNow', () => {
    it('sends the lookbackDays value and returns count + message', async () => {
        mockedAxios.post = vi.fn().mockResolvedValueOnce({
            data: { count: 3, message: 'Poll complete. 3 new suggestion(s) created.' },
        });

        const result = await pollNow(14);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/email-suggestions/poll'),
            { scanLimit: 14 }
        );
        expect(result.count).toBe(3);
    });
});

// ── getGmailScopeStatus ───────────────────────────────────────────────────────

describe('getGmailScopeStatus', () => {
    it('returns hasScope: true when Google token covers Gmail', async () => {
        mockedAxios.get = vi.fn().mockResolvedValueOnce({ data: { hasScope: true } });
        const result = await getGmailScopeStatus();
        expect(result.hasScope).toBe(true);
    });

    it('returns hasScope: false when Gmail scope is missing', async () => {
        mockedAxios.get = vi.fn().mockResolvedValueOnce({ data: { hasScope: false } });
        const result = await getGmailScopeStatus();
        expect(result.hasScope).toBe(false);
    });
});
