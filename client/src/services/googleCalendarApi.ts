// client/src/services/googleCalendarApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export interface GoogleCalendarStatus {
    connected: boolean;
    email: string | null;
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
