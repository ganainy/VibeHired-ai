// client/src/services/workTrackerApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export type WorkEntryType = 'shift' | 'appointment';
export type WorkEntryStatus = 'planned' | 'done';

export interface PopulatedEmployer {
  _id: string;
  name: string;
  logoUrl: string | null;
  subLocations: { _id: string; name: string }[];
}

export interface WorkEntry {
  _id: string;
  employerId: PopulatedEmployer;
  subLocationId?: string;
  subLocationName?: string;
  title?: string;
  type: WorkEntryType;
  date: string;        // ISO string
  startTime: string;   // 'HH:mm'
  endTime: string;     // 'HH:mm'
  hours: number;
  status: WorkEntryStatus;
  notes?: string;
  googleCalendarEventId?: string;
  reminderCreated: boolean;
  createdAt: string;
}

export interface WorkTrackerStats {
  totalHours: number;
  totalEntries: number;
  monthHours: number;
  plannedCount: number;
  doneCount: number;
  activeEmployersCount: number;
}

export interface CreateWorkEntryPayload {
  employerId: string;
  subLocationId?: string;
  title?: string;
  type: WorkEntryType;
  date: string; // 'YYYY-MM-DD'
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface UpdateWorkEntryPayload extends Partial<CreateWorkEntryPayload> {
  status?: WorkEntryStatus;
}

export interface GetEntriesFilters {
  month?: string;       // 'YYYY-MM'
  status?: WorkEntryStatus;
  employerId?: string;
}

/** Fetch entries, optionally filtered. */
export const getEntries = async (filters?: GetEntriesFilters): Promise<WorkEntry[]> => {
  const res = await axios.get<WorkEntry[]>(`${API_BASE_URL}/work-tracker`, { params: filters });
  return res.data;
};

/** Fetch summary stats. */
export const getStats = async (): Promise<WorkTrackerStats> => {
  const res = await axios.get<WorkTrackerStats>(`${API_BASE_URL}/work-tracker/stats`);
  return res.data;
};

/** Create a new entry. */
export const createEntry = async (data: CreateWorkEntryPayload): Promise<WorkEntry> => {
  const res = await axios.post<WorkEntry>(`${API_BASE_URL}/work-tracker`, data);
  return res.data;
};

/** Update an entry (partial). Also used to toggle status. */
export const updateEntry = async (id: string, data: UpdateWorkEntryPayload): Promise<WorkEntry> => {
  const res = await axios.put<WorkEntry>(`${API_BASE_URL}/work-tracker/${id}`, data);
  return res.data;
};

/** Delete an entry. */
export const deleteEntry = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/work-tracker/${id}`);
};

/** Create a Google Calendar event with 1-day popup reminder for the entry. */
export const createReminder = async (id: string): Promise<{ message: string; eventId: string }> => {
  const res = await axios.post<{ message: string; eventId: string }>(`${API_BASE_URL}/work-tracker/${id}/remind`);
  return res.data;
};

// ── AI Schedule Import ────────────────────────────────────────────────────────

/** A single entry candidate returned by the AI parser. */
export interface ParsedScheduleEntry {
  date: string;       // 'YYYY-MM-DD'
  startTime: string;  // 'HH:MM'
  endTime: string;    // 'HH:MM'
  notes: string | null;
}

/** Response from the parse endpoint. */
export interface ParseScheduleResponse {
  entries: ParsedScheduleEntry[];
  count: number;
}

/**
 * Send a file (image/PDF) or raw text to the AI for schedule extraction.
 * Returns the cleaned list of date + time candidates.
 */
export const parseSchedule = async (
  formData: FormData,
): Promise<ParseScheduleResponse> => {
  const res = await axios.post<ParseScheduleResponse>(
    `${API_BASE_URL}/work-tracker/import-schedule/parse`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
};

/** Entry shape sent to the confirm endpoint. */
export interface ConfirmScheduleEntry {
  date: string;
  startTime: string;
  endTime: string;
  type?: WorkEntryType;
  notes?: string | null;
  subLocationId?: string;
}

/** Bulk-create confirmed entries. */
export const confirmScheduleImport = async (
  employerId: string,
  entries: ConfirmScheduleEntry[],
): Promise<{ message: string; count: number }> => {
  const res = await axios.post<{ message: string; count: number }>(
    `${API_BASE_URL}/work-tracker/import-schedule/confirm`,
    { employerId, entries },
  );
  return res.data;
};
