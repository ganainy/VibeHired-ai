// src/components/email-suggestions/__tests__/EmailSuggestionPanel.test.tsx
/**
 * UI tests for EmailSuggestionPanel — covers the three per-card action sections:
 *   1. Status change (Accept / Dismiss)
 *   2. Note suggestion (standalone "Add note" button)
 *   3. Calendar event suggestion (checkbox + Accept)
 *
 * All API calls are mocked via vi.mock so no real network/auth is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock the API modules ──────────────────────────────────────────────────────

vi.mock('../../../services/emailSuggestionsApi', () => ({
    listPendingSuggestions: vi.fn(),
    acceptSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    addNoteSuggestion: vi.fn(),
    pollNow: vi.fn(),
    getGmailScopeStatus: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
}));

vi.mock('../../../services/googleCalendarApi', () => ({
    getGoogleConnectUrl: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ refreshUsage: vi.fn() }),
}));

import * as api from '../../../services/emailSuggestionsApi';
import EmailSuggestionPanel from '../EmailSuggestionPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultPrefs = { lookbackDays: 14, autoPollApplications: false, autoPollJobLeads: false };

function setupApiDefaults() {
    vi.mocked(api.getGmailScopeStatus).mockResolvedValue({ hasScope: true });
    vi.mocked(api.getPreferences).mockResolvedValue(defaultPrefs);
    vi.mocked(api.acceptSuggestion).mockResolvedValue({ calendarEventCreated: true });
    vi.mocked(api.rejectSuggestion).mockResolvedValue(undefined);
    vi.mocked(api.addNoteSuggestion).mockResolvedValue(undefined);
}

const makeSuggestion = (overrides = {}) => ({
    _id: 'sug-001',
    userId: 'user-001',
    gmailMessageId: 'gmail-001',
    emailSubject: 'Interview invitation — Senior Engineer',
    emailSnippet: 'We would like to invite you for an interview on March 10th at 2pm.',
    senderName: 'Acme Recruiter',
    senderEmail: 'hr@acme.com',
    suggestedStatus: 'Interview' as const,
    suggestedNote: 'Interview on March 10th at 2pm. Bring your portfolio.',
    suggestedCalendarEvent: {
        title: 'Interview at Acme Corp',
        description: 'Technical interview with engineering lead.',
        dateTimeISO: '2026-03-10T14:00:00Z',
        notificationMinutesBefore: 30,
    },
    noteAdded: false,
    confidence: 'high' as const,
    matchedCompanyName: 'Acme Corp',
    matchedJobTitle: 'Senior Engineer',
    status: 'pending' as const,
    createdAt: '2026-02-27T10:00:00Z',
    jobApplicationId: {
        _id: 'job-001',
        jobTitle: 'Senior Engineer',
        companyName: 'Acme Corp',
        status: 'Applied' as const,
    },
    emailCategory: 'application_response' as const,
    ...overrides,
});

function renderPanel(onJobUpdated = vi.fn()) {
    return render(
        <EmailSuggestionPanel isOpen onClose={vi.fn()} onJobUpdated={onJobUpdated} />
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmailSuggestionPanel — card sections', () => {
    beforeEach(() => {
        setupApiDefaults();
    });

    // ── Full card (status + note + calendar) ──

    it('renders all three sections when suggestion has status, note, and calendar event', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);

        renderPanel();

        // Status section
        expect(await screen.findByText('Interview')).toBeInTheDocument();
        // Note section
        expect(screen.getByText(/AI Note/i)).toBeInTheDocument();
        expect(screen.getByText(/Bring your portfolio/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
        // Calendar section
        expect(screen.getByText(/Add to calendar/i)).toBeInTheDocument();
        expect(screen.getByText('Interview at Acme Corp')).toBeInTheDocument();
        // Accept button present
        expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    });

    // ── Null-status card (info-only email) ──

    it('renders a card even when suggestedStatus is null, as long as note or calendar is present', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([
            makeSuggestion({ suggestedStatus: null }),
        ]);

        renderPanel();

        await screen.findByText(/AI Note/i);
        // No status pill
        expect(screen.queryByText('Interview')).not.toBeInTheDocument();
        // Note and calendar still shown
        expect(screen.getByText(/Bring your portfolio/i)).toBeInTheDocument();
        expect(screen.getByText('Interview at Acme Corp')).toBeInTheDocument();
        // "Save" button shown instead of "Apply"
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    // ── Note-only card ──

    it('renders only the note section and no Apply button when there is no status and no calendar event', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([
            makeSuggestion({ suggestedStatus: null, suggestedCalendarEvent: undefined }),
        ]);

        renderPanel();

        await screen.findByText(/AI Note/i);
        expect(screen.queryByText('Interview')).not.toBeInTheDocument();
        expect(screen.queryByText(/Add to calendar/i)).not.toBeInTheDocument();
        // No primary Accept button when neither status nor calendar is present
        expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
        // Dismiss is always shown
        expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    // ── "Add note" independent action ──

    it('"Add note" button calls addNoteSuggestion and transitions to "Added" state', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        const onJobUpdated = vi.fn();
        renderPanel(onJobUpdated);

        const addNoteBtn = await screen.findByRole('button', { name: /add note/i });
        await userEvent.click(addNoteBtn);

        expect(api.addNoteSuggestion).toHaveBeenCalledWith('sug-001');
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /added/i })).toBeInTheDocument();
        });
        expect(onJobUpdated).toHaveBeenCalled();
        // Card stays visible — adding a note does NOT dismiss the card
        expect(screen.getByText(/Bring your portfolio/i)).toBeInTheDocument();
    });

    it('"Add note" button is disabled once the note has been added (noteAdded: true from server)', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([
            makeSuggestion({ noteAdded: true }),
        ]);

        renderPanel();

        const addedBtn = await screen.findByRole('button', { name: /added/i });
        expect(addedBtn).toBeDisabled();
    });

    // ── Calendar checkbox behaviour ──

    it('calendar checkbox is checked by default', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        renderPanel();

        await screen.findByText('Interview at Acme Corp');
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('Accept with calendar checked calls acceptSuggestion with includeCalendarEvent: true', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        renderPanel();

        const applyBtn = await screen.findByRole('button', { name: /apply/i });
        await userEvent.click(applyBtn);

        expect(api.acceptSuggestion).toHaveBeenCalledWith('sug-001', { includeCalendarEvent: true });
    });

    it('Accept with calendar unchecked calls acceptSuggestion with includeCalendarEvent: false', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        renderPanel();

        const checkbox = await screen.findByRole('checkbox');
        await userEvent.click(checkbox); // uncheck

        const applyBtn = screen.getByRole('button', { name: /apply/i });
        await userEvent.click(applyBtn);

        expect(api.acceptSuggestion).toHaveBeenCalledWith('sug-001', { includeCalendarEvent: false });
    });

    it('accepts and removes the card from the list on success', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        renderPanel();

        const applyBtn = await screen.findByRole('button', { name: /apply/i });
        await userEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.queryByText('Interview at Acme Corp')).not.toBeInTheDocument();
        });
    });

    // ── Calendar section when Gmail scope is missing ──

    it('shows calendar row greyed-out with "Connect Gmail" prompt when hasScope is false', async () => {
        vi.mocked(api.getGmailScopeStatus).mockResolvedValue({ hasScope: false });
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        renderPanel();

        await screen.findByText('Interview at Acme Corp');
        // Checkbox is NOT rendered (user can't interact with it)
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        // "Connect Gmail" appears in both the top banner and the calendar row inline prompt
        expect(screen.getAllByText(/Connect Gmail/i).length).toBeGreaterThanOrEqual(2);
        // The calendar section label shows "Calendar event" (not "Add to calendar")
        expect(screen.getByText(/Calendar event/i)).toBeInTheDocument();
    });

    // ── Dismiss ──

    it('Dismiss calls rejectSuggestion and removes the card', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([makeSuggestion()]);
        renderPanel();

        const dismissBtn = await screen.findByRole('button', { name: /dismiss/i });
        await userEvent.click(dismissBtn);

        expect(api.rejectSuggestion).toHaveBeenCalledWith('sug-001');
        await waitFor(() => {
            expect(screen.queryByText('Interview at Acme Corp')).not.toBeInTheDocument();
        });
    });

    // ── Empty state ──

    it('shows empty state when there are no suggestions', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([]);
        renderPanel();

        expect(await screen.findByText(/No pending suggestions/i)).toBeInTheDocument();
    });

    // ── Multiple suggestions ──

    it('renders multiple suggestion cards independently', async () => {
        vi.mocked(api.listPendingSuggestions).mockResolvedValue([
            makeSuggestion({ _id: 'sug-001', matchedCompanyName: 'Acme Corp' }),
            makeSuggestion({
                _id: 'sug-002',
                matchedCompanyName: 'Globex',
                suggestedStatus: 'Rejected',
                suggestedCalendarEvent: undefined,
                suggestedNote: 'Unfortunately we are moving forward with other candidates.',
            }),
        ]);

        renderPanel();

        await screen.findByText('Acme Corp');
        expect(screen.getByText('Globex')).toBeInTheDocument();
        expect(screen.getByText('Rejected')).toBeInTheDocument();
        expect(screen.getByText('Interview')).toBeInTheDocument();
        // Only Acme has a calendar event
        expect(screen.getAllByText(/Calendar event|Add to calendar/i)).toHaveLength(1);
        // Both have note sections
        expect(screen.getAllByRole('button', { name: /add note|added/i })).toHaveLength(2);
    });
});
