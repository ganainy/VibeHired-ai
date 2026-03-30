// client/src/services/jobApi.ts
import axios from 'axios';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume'; // Adjust path if needed or redefine/share type

// Define the base URL for your backend API
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'; // Your backend URL

const JOBS_CACHE_TTL_MS = 60 * 1000;
let jobsCache: { data: JobApplication[]; fetchedAt: number } | null = null;
let jobsInFlightRequest: Promise<JobApplication[]> | null = null;

const isJobsCacheFresh = (): boolean => {
    if (!jobsCache) return false;
    return Date.now() - jobsCache.fetchedAt < JOBS_CACHE_TTL_MS;
};

const setJobsCache = (jobs: JobApplication[]): void => {
    jobsCache = { data: jobs, fetchedAt: Date.now() };
};

const updateCachedJob = (jobId: string, updater: (job: JobApplication) => JobApplication): void => {
    if (!jobsCache) return;
    jobsCache = {
        data: jobsCache.data.map((job) => (job._id === jobId ? updater(job) : job)),
        fetchedAt: Date.now(),
    };
};


// Define the expected structure of a job application (matching backend)
// It's often useful to have this type definition accessible in the frontend
export interface JobApplication {
    _id: string; // MongoDB assigns _id
    jobTitle: string;
    companyName: string;
    status: 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Closed' | 'Offer';
    dateApplied?: string; // Dates are often strings in JSON
    jobUrl?: string;
    notes?: string;
    salary?: string; // Can be number, range, or text (e.g., "50k-70k", "$80,000 - $100,000")
    contact?: string; // Email, URL, or name - legacy field
    // Structured contact information from AI extraction
    contactEmail?: string; // Recruiter or company contact email
    contactPhone?: string; // Recruiter or company contact phone
    hiringManagerName?: string; // Hiring manager or recruiter name
    applicationUrl?: string; // Direct application URL/portal link
    jobDescriptionText?: string;
    language?: 'en' | 'de'; // More specific type
    jobPrerequisites?: string; // AI-extracted job requirements and prerequisites
    jobType?: 'full-time' | 'part-time' | 'working-student' | 'internship' | 'contract' | 'freelance' | null; // Employment type
    draftCvJson?: any | null; // Use JsonResumeSchema if imported, else any
    draftCoverLetterText?: string | null;
    // Email fields for cover letter
    coverLetterFileName?: string;
    coverLetterEmailSubject?: string;
    coverLetterEmailBody?: string;
    coverLetterEmailRecipient?: string;
    suggestedCoverLetterFilename?: string; // Legacy field for backward compatibility
    generationStatus?: 'none' | 'pending_input' | 'pending_generation' | 'draft_ready' | 'finalized' | 'error'; // Added pending_generation
    generatedCvFilename?: string; // Added
    generatedCoverLetterFilename?: string | null; // Added
    baseCvId?: string | null; // Reference to the base CV used for this job
    jobCategory?: string | null; // Category of the job (e.g., "IT Helpdesk", "Programming")
    isFavorite?: boolean; // User can mark job as favorite
    appliedAtsSuggestions?: string[]; // History of applied ATS improvements
    createdAt: string; // Dates are often strings in JSON
    updatedAt: string; // Dates are often strings in JSON
    extractedData?: {
        location?: string;
        salaryRaw?: string; // Salary extracted directly from the posting
        estimatedSalary?: string; // AI-estimated salary when not stated in the posting
        salaryIsEstimate?: boolean; // true = AI estimated, false = extracted from posting
        keyDetails?: string | Array<{ key: string; value: string }>;
    };
    // userId?: string; // Add later
    reminders?: IReminder[];
    lastResponseAt?: string;
    followUpSuggestion?: IFollowUpSuggestion;
}

/** Reminder sub-document (mirrors server IReminder) */
export interface IReminder {
    id: string;
    naturalText: string;
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore: number;
    calendarEventId?: string;
    status: 'pending' | 'synced' | 'error';
    createdAt: string;
}

export interface IFollowUpSuggestion {
    jobId: string;
    status: 'none' | 'suggested' | 'snoozed' | 'dismissed' | 'sent';
    isDue: boolean;
    daysWithoutResponse: number;
    dueDateISO: string;
    recipientEmail?: string;
    suggestedAt?: string;
    snoozedUntil?: string;
    draftSubject?: string;
    draftBody?: string;
    draftGeneratedAt?: string;
}

/** Shape returned by AI parse endpoint */
export interface ParsedReminder {
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore: number;
}
export type CreateJobPayload = Omit<JobApplication, '_id' | 'createdAt' | 'updatedAt' | 'draftCvJson' | 'draftCoverLetterText' | 'generationStatus'> & { createdAt?: string }; // Allow optional createdAt on create
export type UpdateJobPayload = Partial<Omit<JobApplication, '_id' | 'userId' | 'updatedAt'>>; // Allow updating most fields including createdAt

interface ScrapeResponse {
    message: string;
    job: JobApplication; // Return the updated job
}
interface DeleteResponse {
    message: string;
    id: string;
}

// ---  Interface for Draft Response ---
export interface JobDraftData {
    jobId: string;
    jobTitle: string;
    companyName: string;
    generationStatus?: 'none' | 'pending_input' | 'draft_ready' | 'finalized' | 'error';
    draftCvJson: JsonResumeSchema | null | any; // Use specific type or any
    draftCoverLetterText: string | null;
}

// --- API Functions ---

// Function to get all job applications
export const getJobs = async (): Promise<JobApplication[]> => {
    try {
        if (isJobsCacheFresh()) {
            return jobsCache!.data;
        }

        if (jobsInFlightRequest) {
            return jobsInFlightRequest;
        }

        jobsInFlightRequest = axios.get(`${API_BASE_URL}/job-applications`)
            .then((response) => {
                const jobs = response.data as JobApplication[];
                setJobsCache(jobs);
                return jobs;
            })
            .finally(() => {
                jobsInFlightRequest = null;
            });

        return jobsInFlightRequest;
    }
    catch (error) {
        console.error("Error fetching jobs:", error);
        // Handle or throw error appropriately for UI feedback
        throw error;
    }
};

// Function to create a new job application
// We need the data to send (Payload Type) - excluding _id, createdAt, updatedAt
export const createJob = async (jobData: CreateJobPayload): Promise<JobApplication> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/job-applications`, jobData); // Corrected endpoint
        const createdJob = response.data as JobApplication;
        if (jobsCache) {
            setJobsCache([createdJob, ...jobsCache.data]);
        }
        return createdJob;
    } catch (error) {
        console.error("Error creating job:", error);
        throw error;
    }
};

// Function to update a job application
// Payload can be partial data for the update
export const updateJob = async (id: string, updates: UpdateJobPayload): Promise<JobApplication> => {
    try {
        const response = await axios.put(`${API_BASE_URL}/job-applications/${id}`, updates); // Corrected endpoint
        const updatedJob = response.data as JobApplication;
        updateCachedJob(id, () => updatedJob);
        return updatedJob;
    } catch (error) {
        console.error(`Error updating job ${id}:`, error);
        throw error;
    }
};


// Function to delete a job application
// Usually returns some confirmation or just succeeds/fails
export const deleteJob = async (id: string): Promise<DeleteResponse> => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/job-applications/${id}`); // Corrected endpoint
        if (jobsCache) {
            setJobsCache(jobsCache.data.filter((job) => job._id !== id));
        }
        return response.data;
    } catch (error) {
        console.error(`Error deleting job ${id}:`, error);
        throw error;
    }
};

// Get single job (optional, if needed)
export const getJobById = async (id: string): Promise<JobApplication> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/job-applications/${id}`); // Corrected endpoint
        return response.data;
    } catch (error) {
        console.error(`Error fetching job ${id}:`, error);
        throw error;
    }
};

// ---  Scrape Function ---
export const scrapeJobDescriptionApi = async (jobId: string, url?: string): Promise<ScrapeResponse> => {
    try {
        // Auth header should be included by default axios instance
        const payload = url ? { url } : {}; // Send URL in body if provided
        const response = await axios.patch<ScrapeResponse>(`${API_BASE_URL}/job-applications/${jobId}/scrape`, payload); // Corrected endpoint
        return response.data;
    } catch (error: any) {
        console.error(`Error scraping description for job ${jobId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred during scraping.' };
    }
};


// ---  Create Job From URL Function ---
export const createJobFromUrlApi = async (url: string): Promise<JobApplication> => {
    try {
        // Auth header automatically included
        const response = await axios.post<JobApplication>(`${API_BASE_URL}/job-applications/create-from-url`, { url }); // Corrected endpoint
        return response.data;
    } catch (error: any) {
        console.error(`Error creating job from URL ${url}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred while creating job from URL.' };
    }
};

// ---  Create Job From Pasted Text Function ---
export interface CreateJobFromTextOptions {
    baseCvId?: string | null;
    jobUrl?: string;
    status?: JobApplication['status'];
    jobType?: JobApplication['jobType'];
    force?: boolean;
}

// Error thrown when the server detects a duplicate job (409)
export interface DuplicateJobError {
    code: 'DUPLICATE_JOB';
    message: string;
    duplicates: Pick<JobApplication, '_id' | 'jobTitle' | 'companyName' | 'status' | 'createdAt' | 'jobUrl'>[];
}

export const createJobFromTextApi = async (text: string, options?: CreateJobFromTextOptions): Promise<JobApplication> => {
    try {
        const payload: any = { text, ...options };
        const response = await axios.post<JobApplication>(`${API_BASE_URL}/job-applications/create-from-text`, payload);
        const createdJob = response.data;
        if (jobsCache) {
            setJobsCache([createdJob, ...jobsCache.data]);
        }
        return createdJob;
    } catch (error: any) {
        console.error(`Error creating job from pasted text:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data; // includes code: 'DUPLICATE_JOB' on 409
        }
        throw { message: 'An unknown error occurred while extracting job details.' };
    }
};

// --- Check for duplicate jobs by URL (pre-extraction) ---
export const checkJobUrlDuplicateApi = async (jobUrl: string): Promise<{ duplicates: Pick<JobApplication, '_id' | 'jobTitle' | 'companyName' | 'status' | 'createdAt' | 'jobUrl'>[] }> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/job-applications/check-duplicate`, {
            params: { jobUrl },
        });
        return response.data;
    } catch (error: any) {
        console.error('Error checking for duplicate job by URL:', error);
        // Don't block extraction on check failure - return empty
        return { duplicates: [] };
    }
};

// ---  Extract Job Data from Text for Existing Job ---
export const extractJobFromTextApi = async (jobId: string, text: string): Promise<JobApplication> => {
    try {
        const response = await axios.patch<JobApplication>(`${API_BASE_URL}/job-applications/${jobId}/extract-from-text`, { text });
        return response.data;
    } catch (error: any) {
        console.error(`Error extracting job data from text:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred while extracting job details.' };
    }
};

// ---  Get Draft Data Function ---
export const getJobDraft = async (jobId: string): Promise<JobDraftData> => {
    try {
        // Assumes auth token is handled by default axios instance
        const response = await axios.get<JobDraftData>(`${API_BASE_URL}/job-applications/${jobId}/draft`); // Corrected endpoint
        return response.data;
    } catch (error: any) {
        console.error(`Error fetching draft data for job ${jobId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data; // Throw backend error structure
        }
        throw { message: 'An unknown error occurred fetching draft data.' };
    }
};

// ---  Update Draft Data Function ---
interface UpdateDraftPayload {
    draftCvJson?: JsonResumeSchema | any; // Allow sending partial updates potentially
    draftCoverLetterText?: string;
}
interface UpdateDraftResponse {
    message: string;
}
export const updateJobDraft = async (jobId: string, draftData: UpdateDraftPayload): Promise<UpdateDraftResponse> => {
    try {
        const response = await axios.put<UpdateDraftResponse>(`${API_BASE_URL}/job-applications/${jobId}/draft`, draftData); // Corrected endpoint
        return response.data;
    } catch (error: any) {
        console.error(`Error updating draft for job ${jobId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred updating draft data.' };
    }
};

// ---  Reminder API Functions ---

export const parseReminderApi = async (
    jobId: string,
    naturalText: string
): Promise<ParsedReminder> => {
    const response = await axios.post<ParsedReminder>(
        `${API_BASE_URL}/job-applications/${jobId}/reminders/parse`,
        { naturalText }
    );
    return response.data;
};

export interface AddReminderPayload {
    naturalText: string;
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore?: number;
}

export const addReminderApi = async (
    jobId: string,
    payload: AddReminderPayload
): Promise<{ reminder: IReminder; job: { reminders: IReminder[] } }> => {
    const response = await axios.post(
        `${API_BASE_URL}/job-applications/${jobId}/reminders`,
        payload
    );
    return response.data;
};

export const deleteReminderApi = async (
    jobId: string,
    reminderId: string
): Promise<{ message: string; reminders: IReminder[] }> => {
    const response = await axios.delete(
        `${API_BASE_URL}/job-applications/${jobId}/reminders/${reminderId}`
    );
    return response.data;
};

export const getFollowUpSuggestionApi = async (jobId: string): Promise<IFollowUpSuggestion> => {
    const response = await axios.get<IFollowUpSuggestion>(
        `${API_BASE_URL}/job-applications/${jobId}/follow-up`
    );
    return response.data;
};

export const generateFollowUpDraftApi = async (jobId: string): Promise<IFollowUpSuggestion> => {
    const response = await axios.post<IFollowUpSuggestion>(
        `${API_BASE_URL}/job-applications/${jobId}/follow-up/generate-draft`
    );
    return response.data;
};

export const snoozeFollowUpOneWeekApi = async (jobId: string): Promise<IFollowUpSuggestion> => {
    const response = await axios.post<IFollowUpSuggestion>(
        `${API_BASE_URL}/job-applications/${jobId}/follow-up/snooze-one-week`
    );
    return response.data;
};

export const dismissFollowUpApi = async (jobId: string): Promise<IFollowUpSuggestion> => {
    const response = await axios.post<IFollowUpSuggestion>(
        `${API_BASE_URL}/job-applications/${jobId}/follow-up/dismiss`
    );
    return response.data;
};

export const markFollowUpSentApi = async (jobId: string): Promise<IFollowUpSuggestion> => {
    const response = await axios.post<IFollowUpSuggestion>(
        `${API_BASE_URL}/job-applications/${jobId}/follow-up/mark-sent`
    );
    return response.data;
};

export const getPendingFollowUpSuggestionsApi = async (): Promise<IFollowUpSuggestion[]> => {
    const response = await axios.get<IFollowUpSuggestion[]>(
        `${API_BASE_URL}/job-applications/follow-ups/pending`
    );
    return response.data;
};

// Function to get all job applications with generated CVs
export const getJobsWithCvs = async (): Promise<JobApplication[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/job-applications`);
        // Filter to only return jobs that have generated CVs
        const allJobs = response.data;
        return allJobs.filter((job: JobApplication) => job.draftCvJson && Object.keys(job.draftCvJson).length > 0);
    } catch (error) {
        console.error("Error fetching jobs with CVs:", error);
        throw error;
    }
};
