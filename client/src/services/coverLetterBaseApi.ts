// client/src/services/coverLetterBaseApi.ts
/**
 * API service for base (template) cover letters and job-specific CL documents.
 *
 * Base cover letters live in /api/cover-letter-bases and are stored as fully
 * independent copies per job so that deleting/editing a base CL never breaks
 * any existing job application.
 */
import axios from 'axios';

const API_BASE_URL =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';
const BASE_URL = `${API_BASE_URL}/cover-letter-bases`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoverLetterBase {
    _id: string;
    displayName: string;
    language: 'en' | 'de';
    coverLetterText: string;
    filename?: string | null;
    fileMimeType?: string | null;
    hasFile?: boolean;
    emailSubject?: string | null;
    emailBody?: string | null;
    emailRecipient?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface JobCoverLetterDoc {
    _id: string;
    displayName: string;
    language: 'en' | 'de';
    coverLetterText: string;
    filename?: string | null;
    fileMimeType?: string | null;
    hasFile?: boolean;
    emailSubject?: string | null;
    emailBody?: string | null;
    emailRecipient?: string | null;
    createdAt: string;
    updatedAt: string;
}

// ---------------------------------------------------------------------------
// Base Cover Letter CRUD
// ---------------------------------------------------------------------------

/** List all base cover letters for the current user */
export const getBaseCoverLetters = async (): Promise<CoverLetterBase[]> => {
    const res = await axios.get<{ coverLetters: CoverLetterBase[] }>(BASE_URL);
    return res.data.coverLetters;
};

/** Create a new base cover letter from text */
export const createBaseCoverLetter = async (data: {
    displayName: string;
    coverLetterText: string;
    language?: 'en' | 'de';
    emailSubject?: string;
    emailBody?: string;
    emailRecipient?: string;
}): Promise<CoverLetterBase> => {
    const res = await axios.post<{ coverLetter: CoverLetterBase }>(BASE_URL, data);
    return res.data.coverLetter;
};

/** Upload a PDF/DOCX file as a new base cover letter */
export const uploadBaseCoverLetter = async (
    file: File,
    displayName: string,
    language: 'en' | 'de' = 'en'
): Promise<CoverLetterBase> => {
    const formData = new FormData();
    formData.append('clFile', file);
    formData.append('displayName', displayName);
    formData.append('language', language);

    const res = await axios.post<{ coverLetter: CoverLetterBase }>(
        `${BASE_URL}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.coverLetter;
};

/** Update a base cover letter's text / name */
export const updateBaseCoverLetter = async (
    id: string,
    data: Partial<{
        displayName: string;
        coverLetterText: string;
        language: 'en' | 'de';
        emailSubject: string;
        emailBody: string;
        emailRecipient: string;
    }>
): Promise<CoverLetterBase> => {
    const res = await axios.put<{ coverLetter: CoverLetterBase }>(`${BASE_URL}/${id}`, data);
    return res.data.coverLetter;
};

/** Delete a base cover letter (job-specific copies are NOT affected) */
export const deleteBaseCoverLetter = async (id: string): Promise<void> => {
    await axios.delete(`${BASE_URL}/${id}`);
};

// ---------------------------------------------------------------------------
// Job-specific Cover Letter Documents
// ---------------------------------------------------------------------------

/** Get the independent CL document stored for a specific job */
export const getJobCoverLetterDoc = async (
    jobId: string
): Promise<JobCoverLetterDoc | null> => {
    const res = await axios.get<{ coverLetter: JobCoverLetterDoc | null }>(
        `${BASE_URL}/job/${jobId}`
    );
    return res.data.coverLetter;
};

/**
 * Copy a base cover letter to a job as a fully independent document.
 * Also syncs `draftCoverLetterText` on the job so the editor works immediately.
 */
export const applyBaseCoverLetterToJob = async (
    jobId: string,
    baseCoverLetterId: string
): Promise<JobCoverLetterDoc> => {
    const res = await axios.post<{ coverLetter: JobCoverLetterDoc }>(
        `${BASE_URL}/job/${jobId}/from-base/${baseCoverLetterId}`
    );
    return res.data.coverLetter;
};

/**
 * Upload a PDF/DOCX cover letter file directly for a job.
 * Parses the file, stores binary + text as an independent job CL document.
 */
export const uploadCoverLetterForJob = async (
    jobId: string,
    file: File,
    language: 'en' | 'de' = 'en'
): Promise<JobCoverLetterDoc> => {
    const formData = new FormData();
    formData.append('clFile', file);
    formData.append('language', language);

    const res = await axios.post<{ coverLetter: JobCoverLetterDoc }>(
        `${BASE_URL}/job/${jobId}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.coverLetter;
};

/**
 * Snapshot the job's current draftCoverLetterText into a CoverLetter document.
 * Useful after generating or editing a cover letter to capture the final state.
 */
export const saveCurrentCoverLetterForJob = async (
    jobId: string
): Promise<JobCoverLetterDoc> => {
    const res = await axios.post<{ coverLetter: JobCoverLetterDoc }>(
        `${BASE_URL}/job/${jobId}/save-current`
    );
    return res.data.coverLetter;
};
