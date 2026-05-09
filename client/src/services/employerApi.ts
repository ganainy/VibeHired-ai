// client/src/services/employerApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export interface SubLocation {
  _id: string;
  name: string;
}

export interface EmployerBonus {
  _id: string;
  name: string;
  multiplier: number; // e.g. 0.5 = 50% extra pay
  conditionType: 'day_of_week' | 'time_range' | 'specific_dates';
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  specificDates?: string[];
}

export interface Employer {
  _id: string;
  name: string;
  logoUrl: string | null;
  logoPublicId?: string | null;
  hourlyRate?: number | null;
  subLocations: SubLocation[];
  bonuses: EmployerBonus[];
  totalHours: number;
  entryCount: number;
  createdAt: string;
}

/** Fetch all employers for the current user (includes stats). */
export const getEmployers = async (): Promise<Employer[]> => {
  const res = await axios.get<Employer[]>(`${API_BASE_URL}/employers`);
  return res.data;
};

/** Create a new employer. Pass a FormData containing `name` and optionally `logo` (File). */
export const createEmployer = async (formData: FormData): Promise<Employer> => {
  const res = await axios.post<Employer>(`${API_BASE_URL}/employers`, formData);
  return res.data;
};

/** Update an employer's name and/or logo. */
export const updateEmployer = async (id: string, formData: FormData): Promise<Employer> => {
  const res = await axios.put<Employer>(`${API_BASE_URL}/employers/${id}`, formData);
  return res.data;
};

/** Delete an employer and all its work entries. */
export const deleteEmployer = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/employers/${id}`);
};

// ── Sub-location helpers ──────────────────────────────────────────────────────────

/** Add a sub-location to an employer. */
export const addSubLocation = async (employerId: string, name: string): Promise<SubLocation> => {
  const res = await axios.post<SubLocation>(`${API_BASE_URL}/employers/${employerId}/sub-locations`, { name });
  return res.data;
};

/** Rename a sub-location. */
export const updateSubLocation = async (employerId: string, subId: string, name: string): Promise<SubLocation> => {
  const res = await axios.put<SubLocation>(`${API_BASE_URL}/employers/${employerId}/sub-locations/${subId}`, { name });
  return res.data;
};

/** Delete a sub-location. */
export const deleteSubLocation = async (employerId: string, subId: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/employers/${employerId}/sub-locations/${subId}`);
};
