// client/src/services/googleCalendarApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export interface GoogleCalendarStatus {
    connected: boolean;
    email: string | null;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    description?: string;
}

/** Get the user's Google Calendar connection status */
export const getGoogleCalendarStatus = async (): Promise<GoogleCalendarStatus> => {
    const response = await axios.get<GoogleCalendarStatus>(`${API_BASE_URL}/auth/google/status`);
    return response.data;
};

/**
 * Start the Google OAuth flow.
 * Returns the Google consent URL. The caller should redirect `window.location.href` there.
 */
export const getGoogleConnectUrl = async (): Promise<string> => {
    const response = await axios.get<{ url: string }>(`${API_BASE_URL}/auth/google/connect`);
    return response.data.url;
};

/** Disconnect Google Calendar from the user's account */
export const disconnectGoogleCalendar = async (): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/auth/google/disconnect`);
};

/** List upcoming events from the user's primary Google Calendar */
export const listUpcomingEvents = async (options: { maxResults?: number; timeMin?: string; timeMax?: string } = {}): Promise<CalendarEvent[]> => {
    let url = `${API_BASE_URL}/auth/google/events?maxResults=${options.maxResults || 50}`;
    if (options.timeMin) url += `&timeMin=${encodeURIComponent(options.timeMin)}`;
    if (options.timeMax) url += `&timeMax=${encodeURIComponent(options.timeMax)}`;
    const response = await axios.get<CalendarEvent[]>(url);
    return response.data;
};

/** Create a new event in the user's primary Google Calendar */
export const createEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    const response = await axios.post<CalendarEvent>(`${API_BASE_URL}/auth/google/events`, event);
    return response.data;
};

/** Update an existing event in the user's primary Google Calendar */
export const updateEvent = async (id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const response = await axios.put<CalendarEvent>(`${API_BASE_URL}/auth/google/events/${id}`, event);
    return response.data;
};

/** Delete an event from the user's primary Google Calendar */
export const deleteEvent = async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/auth/google/events/${id}`);
};
