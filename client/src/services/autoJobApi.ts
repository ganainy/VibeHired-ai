// client/src/services/autoJobApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

// Types - AutoJob is now a JobApplication with isAutoJob=true (unified model)
export interface AutoJob {
    _id: string;
    userId: string;
    jobTitle: string;
    companyName: string;
    status: 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Closed' | 'Offer';
    jobUrl?: string;
    jobDescriptionText?: string;
    language?: string;
    notes?: string;

    // Auto job specific fields
    isAutoJob: boolean;
    showInDashboard: boolean;
    jobId?: string;
    workflowRunId?: string;
    processingStatus?: 'pending' | 'analyzed' | 'relevant' | 'not_relevant' | 'generated' | 'error';
    errorMessage?: string;
    discoveredAt?: Date;
    processedAt?: Date;
    jobPostDate?: Date | string; // When the job was posted (from crawler)

    // Extracted data (for auto jobs)
    extractedData?: {
        skills: string[];
        salary?: {
            min?: number;
            max?: number;
            currency?: string;
        };
        yearsExperience?: number;
        location?: string;
        remoteOption?: string;
    };

    // Company insights (for auto jobs)
    companyInsights?: {
        missionStatement?: string;
        coreValues?: string[];
        businessModel?: string;
    };

    // Recommendation (unified)
    recommendation?: {
        score: number | null;
        shouldApply: boolean;
        reason: string;
        cachedAt: Date | string;
        error?: string;
    };

    // Draft content (mapped from customizedResumeHtml/coverLetterText)
    draftCoverLetterText?: string;
    generationStatus?: 'none' | 'pending_input' | 'pending_generation' | 'draft_ready' | 'finalized' | 'error';

    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface AutoJobsResponse {
    jobs: AutoJob[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface WorkflowStats {
    total: number;
    pending: number;
    analyzed: number;
    relevant: number;
    notRelevant: number;
    generated: number;
    errors: number;
}

export interface AutoJobSettings {
    enabled?: boolean;
    keywords?: string;
    location?: string;
    jobType?: string[];
    experienceLevel?: string[];
    datePosted?: string;
    maxJobs?: number;
    avoidDuplicates?: boolean;
}

export interface WorkflowRun {
    _id: string;
    userId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress: {
        currentStep: string;
        currentStepIndex: number;
        totalSteps: number;
        percentage: number;
    };
    steps: Array<{
        name: string;
        status: 'pending' | 'running' | 'completed' | 'failed';
        startedAt?: string;
        completedAt?: string;
        message?: string;
        count?: number;
        total?: number;
    }>;
    stats: {
        jobsFound: number;
        newJobs: number;
        duplicates: number;
        analyzed: number;
        relevant: number;
        notRelevant: number;
        generated: number;
        errors: number;
    };
    errorMessage?: string;
    startedAt: string;
    completedAt?: string;
    isManual: boolean;
}

export interface TriggerWorkflowResponse {
    message: string;
    runId: string;
}

/**
 * Trigger the auto-job workflow manually
 */
export const triggerWorkflow = async (): Promise<TriggerWorkflowResponse> => {
    const response = await axios.post<TriggerWorkflowResponse>(`${API_BASE_URL}/auto-jobs/trigger`);
    return response.data;
};

/**
 * Get workflow run status
 */
export const getWorkflowStatus = async (runId: string): Promise<WorkflowRun> => {
    const response = await axios.get<WorkflowRun>(`${API_BASE_URL}/auto-jobs/runs/${runId}`);
    return response.data;
};

/**
 * Cancel a running workflow
 */
export const cancelWorkflow = async (runId: string): Promise<{ message: string; runId: string }> => {
    const response = await axios.post<{ message: string; runId: string }>(`${API_BASE_URL}/auto-jobs/runs/${runId}/cancel`);
    return response.data;
};

/**
 * Get list of auto jobs with pagination and filters
 */
export const getAutoJobs = async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    relevance?: string;
}): Promise<AutoJobsResponse> => {
    const response = await axios.get<AutoJobsResponse>(`${API_BASE_URL}/auto-jobs`, { params });
    return response.data;
};

/**
 * Get single auto job by ID
 */
export const getAutoJobById = async (id: string): Promise<AutoJob> => {
    const response = await axios.get<AutoJob>(`${API_BASE_URL}/auto-jobs/${id}`);
    return response.data;
};

/**
 * Promote auto job to regular job application
 */
export const promoteAutoJob = async (id: string): Promise<{ message: string; jobApplication: any }> => {
    const response = await axios.post(`${API_BASE_URL}/auto-jobs/${id}/promote`);
    return response.data;
};

/**
 * Delete auto job
 */
export const deleteAutoJob = async (id: string): Promise<{ message: string }> => {
    const response = await axios.delete(`${API_BASE_URL}/auto-jobs/${id}`);
    return response.data;
};

/**
 * Delete ALL auto jobs
 */
export const deleteAllAutoJobs = async (): Promise<{ message: string; count: number }> => {
    const response = await axios.delete(`${API_BASE_URL}/auto-jobs`);
    return response.data;
};

/**
 * Get workflow statistics
 */
export const getStats = async (): Promise<WorkflowStats> => {
    const response = await axios.get<WorkflowStats>(`${API_BASE_URL}/auto-jobs/stats`);
    return response.data;
};

/**
 * Get auto-job settings
 */
export const getSettings = async (): Promise<AutoJobSettings> => {
    const response = await axios.get<AutoJobSettings>(`${API_BASE_URL}/auto-jobs/settings/config`);
    return response.data;
};

/**
 * Update auto-job settings
 */
export const updateSettings = async (settings: Partial<AutoJobSettings>): Promise<{ message: string; settings: AutoJobSettings }> => {
    const response = await axios.put(`${API_BASE_URL}/auto-jobs/settings/config`, settings);
    return response.data;
};
