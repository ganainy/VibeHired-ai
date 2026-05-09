// client/src/services/workTrackerApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export type WorkEntryType = 'shift' | 'appointment';
export type WorkEntryStatus = 'planned' | 'done';

export interface PopulatedAppointmentType {
  _id: string;
  name: string;
}

export interface PopulatedEmployer {
  _id: string;
  name: string;
  logoUrl: string | null;
  hourlyRate?: number | null;
  subLocations: { _id: string; name: string }[];
  bonuses: {
    _id: string;
    name: string;
    multiplier: number;
    conditionType: 'day_of_week' | 'time_range' | 'specific_dates';
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
    specificDates?: string[];
  }[];
}

export interface WorkEntry {
  _id: string;
  employerId?: PopulatedEmployer;
  appointmentTypeId?: PopulatedAppointmentType;
  subLocationId?: string;
  subLocationName?: string;
  title?: string;
  type: WorkEntryType;
  date: string;        // ISO string
  startTime: string;   // 'HH:mm'
  endTime: string;     // 'HH:mm'
  hours: number;
  breakMinutes: number;
  paidKilometers?: number;
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

export interface WorkTrackerAnalytics {
  dailyHours: {
    date: string;
    totalHours: number;
    entries: {
      type: WorkEntryType;
      employer: string;
      hours: number;
      breakMinutes: number;
      paidKm: number;
    }[];
  }[];
  employerBreakdown: {
    id: string;
    name: string;
    hours: number;
    count: number;
    earnings?: number;
  }[];
  summary: {
    totalHours: number;
    totalEntries: number;
    avgHoursPerDay: number;
    totalBreakMinutes: number;
    totalPaidKm: number;
  };
}

export interface CreateWorkEntryPayload {
  employerId?: string;
  appointmentTypeId?: string | null;
  subLocationId?: string;
  title?: string;
  type: WorkEntryType;
  date: string; // 'YYYY-MM-DD'
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  paidKilometers?: number;
  notes?: string;
  addToCalendar?: boolean;
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

/** Fetch detailed analytics for charts. */
export const getWorkTrackerAnalytics = async (month?: string): Promise<WorkTrackerAnalytics> => {
  const res = await axios.get<WorkTrackerAnalytics>(`${API_BASE_URL}/work-tracker/analytics`, { params: { month } });
  return res.data;
};

/** Get all unique months (YYYY-MM) with work entries. */
export const getWorkMonths = async (): Promise<string[]> => {
  const res = await axios.get<string[]>(`${API_BASE_URL}/work-tracker/months`);
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

/** Delete the Google Calendar reminder for an entry. */
export const deleteReminder = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/work-tracker/${id}/remind`);
};

// ── AI Schedule Import ────────────────────────────────────────────────────────

/** A single entry candidate returned by the AI parser. */
export interface ParsedScheduleEntry {
  date: string;       // 'YYYY-MM-DD'
  startTime: string;  // 'HH:MM'
  endTime: string;    // 'HH:MM'
  startTimeInferred?: boolean;
  endTimeInferred?: boolean;
  breakMinutes?: number;
  paidKilometers?: number;
  notes: string | null;
  type?: WorkEntryType; // 'shift' | 'appointment'
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
  importMode?: 'shift' | 'appointment' | 'auto',
): Promise<ParseScheduleResponse> => {
  // Add importMode to form data if provided
  if (importMode) {
    formData.append('importMode', importMode);
  }
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
  breakMinutes?: number;
  paidKilometers?: number;
  type: WorkEntryType; // Required: 'shift' | 'appointment'
  notes?: string | null;
  subLocationId?: string;
}

/** Bulk-create confirmed entries. */
export const confirmScheduleImport = async (
  payload: {
    employerId?: string;
    appointmentTypeId?: string;
    entries: ConfirmScheduleEntry[];
  },
): Promise<{ message: string; count: number; ids: string[] }> => {
  const res = await axios.post<{ message: string; count: number; ids: string[] }>(
    `${API_BASE_URL}/work-tracker/import-schedule/confirm`,
    payload,
  );
  return res.data;
};

export const getAppointmentTypes = async (): Promise<PopulatedAppointmentType[]> => {
  const { data } = await axios.get<PopulatedAppointmentType[]>(`${API_BASE_URL}/work-tracker/appointment-types`);
  return data;
};

export const createAppointmentType = async (payload: { name: string }): Promise<PopulatedAppointmentType> => {
  const { data } = await axios.post<PopulatedAppointmentType>(`${API_BASE_URL}/work-tracker/appointment-types`, payload);
  return data;
};

export const updateAppointmentType = async (id: string, payload: { name: string }): Promise<PopulatedAppointmentType> => {
  const { data } = await axios.put<PopulatedAppointmentType>(`${API_BASE_URL}/work-tracker/appointment-types/${id}`, payload);
  return data;
};

export const deleteAppointmentType = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/work-tracker/appointment-types/${id}`);
};

/** Send a magic voice/text prompt to create an entry */
export const parseMagicPrompt = async (payload: { text: string; today: string; employers: any[]; appointmentTypes: any[] }): Promise<Partial<CreateWorkEntryPayload>> => {
  const res = await axios.post<Partial<CreateWorkEntryPayload>>(`${API_BASE_URL}/work-tracker/parse-magic-prompt`, payload);
  return res.data;
};
