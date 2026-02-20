// client/src/services/cvApi.ts
/**
 * Unified CV API Service
 * 
 * Uses the new unified CV model with isMasterCv flag.
 * All CVs (master and job-specific) are stored in the same collection.
 */
import axios from 'axios';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume';
import { CvSectionDescriptor, CvDynamicPayload } from '../types/cvDescriptor';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'}/cvs`;

// ============================================================================
// Types
// ============================================================================

export interface CVDocument {
    _id: string;
    isPrimary?: boolean;
    category?: string | null;
    displayName?: string;
    isMasterCv?: boolean; // Keep for backward compatibility
    jobApplicationId?: string | null;
    jobApplication?: {
        _id: string;
        jobTitle: string;
        companyName: string;
        status: string;
        jobUrl?: string;
    } | null;
    cvJson?: JsonResumeSchema | null;
    /** AI-generated structural descriptor. Null for legacy CVs. */
    cvDescriptor?: CvSectionDescriptor[] | null;
    /** Free-form content keyed by descriptor section key. Null for legacy CVs. */
    cvData?: Record<string, any> | null;
    templateId?: string | null;
    filename?: string | null;
    analysisCache?: Record<string, unknown> | null;
    tailoringChanges?: Array<{
        section: string;
        description: string;
        reason: string;
    }> | null;
    createdAt: string;
    updatedAt: string;
}

export interface GetAllCvsResponse {
    cvs: CVDocument[];
}

export interface GetCvResponse {
    cv: CVDocument | null;
    message?: string;
}

export interface UploadCvResponse {
    message: string;
    cv: CVDocument;
}

export interface UpdateCvResponse {
    message: string;
    cv: CVDocument;
}

export interface DeleteCvResponse {
    message: string;
    deletedCvId: string;
}

export interface PromoteCvResponse {
    message: string;
    cv: CVDocument;
}

export interface GetCvBranchesResponse {
    branches: CVDocument[];
}

export interface CreateBranchRequest {
    sourceCvId: string;
    category: string;
    displayName: string;
}

export interface CreateBranchResponse {
    message: string;
    branch: CVDocument;
}

export interface SetPrimaryResponse {
    message: string;
    branch: {
        _id: string;
        isPrimary: boolean;
        category: string | null;
        displayName: string;
        updatedAt: string;
    };
}

export interface RenameBranchRequest {
    displayName: string;
}

export interface RenameBranchResponse {
    message: string;
    branch: {
        _id: string;
        displayName: string;
        updatedAt: string;
    };
}

export interface UploadBranchRequest {
    file: File;
    category: string;
    displayName: string;
}

export interface UploadBranchResponse {
    message: string;
    branch: CVDocument;
}

export interface PreviewCvResponse {
    message: string;
    pdfBase64: string;
}

// ============================================================================
// New Branch API Functions
// ============================================================================

/**
 * Get all CV branches for the current user
 */
export const getCvBranches = async (): Promise<GetCvBranchesResponse> => {
    try {
        const response = await axios.get<GetCvBranchesResponse>(`${API_BASE_URL}/branches`);
        return response.data;
    } catch (error: any) {
        console.error('Get CV branches API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred fetching CV branches.' };
    }
};

/**
 * Create a new CV branch
 */
export const createCvBranch = async (data: CreateBranchRequest): Promise<CreateBranchResponse> => {
    try {
        const response = await axios.post<CreateBranchResponse>(`${API_BASE_URL}/create-branch`, data);
        return response.data;
    } catch (error: any) {
        console.error('Create CV branch API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred creating CV branch.' };
    }
};

/**
 * Upload a new CV file as a branch (supports PDF, DOCX, RTF)
 */
export const uploadCvBranch = async (file: File, category: string, displayName: string): Promise<UploadBranchResponse> => {
    const formData = new FormData();
    formData.append('cvFile', file);
    formData.append('category', category);
    formData.append('displayName', displayName);

    try {
        const response = await axios.post<UploadBranchResponse>(`${API_BASE_URL}/upload-branch`, formData);
        return response.data;
    } catch (error: any) {
        console.error('Upload CV branch API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred uploading CV branch.' };
    }
};

/**
 * Set a CV as primary
 */
export const setCvPrimary = async (cvId: string): Promise<SetPrimaryResponse> => {
    try {
        const response = await axios.patch<SetPrimaryResponse>(`${API_BASE_URL}/${cvId}/set-primary`);
        return response.data;
    } catch (error: any) {
        console.error('Set CV primary API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred setting CV as primary.' };
    }
};

/**
 * Rename a CV branch
 */
export const renameCvBranch = async (cvId: string, data: RenameBranchRequest): Promise<RenameBranchResponse> => {
    try {
        const response = await axios.patch<RenameBranchResponse>(`${API_BASE_URL}/${cvId}/rename`, data);
        return response.data;
    } catch (error: any) {
        console.error('Rename CV branch API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred renaming CV branch.' };
    }
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all CVs for the current user
 */
export const getAllCvs = async (): Promise<GetAllCvsResponse> => {
    try {
        const response = await axios.get<GetAllCvsResponse>(API_BASE_URL);
        return response.data;
    } catch (error: any) {
        console.error('Get all CVs API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred fetching CVs.' };
    }
};

/**
 * Get the master CV for the current user
 */
export const getMasterCv = async (): Promise<GetCvResponse> => {
    try {
        const response = await axios.get<GetCvResponse>(`${API_BASE_URL}/master`);
        return response.data;
    } catch (error: any) {
        console.error('Get master CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred fetching master CV.' };
    }
};

/**
 * Get a specific CV by ID
 */
export const getCvById = async (cvId: string): Promise<GetCvResponse> => {
    try {
        const response = await axios.get<GetCvResponse>(`${API_BASE_URL}/${cvId}`);
        return response.data;
    } catch (error: any) {
        console.error('Get CV by ID API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred fetching CV.' };
    }
};

/**
 * Get the CV for a specific job application
 */
export const getJobCv = async (jobId: string): Promise<GetCvResponse> => {
    try {
        const response = await axios.get<GetCvResponse>(`${API_BASE_URL}/job/${jobId}`);
        return response.data;
    } catch (error: any) {
        console.error('Get job CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred fetching job CV.' };
    }
};

/**
 * Get the original PDF binary (base64-encoded) for a CV stored as raw PDF.
 */
export const getCvOriginalPdf = async (cvId: string): Promise<{ pdfBase64: string }> => {
    try {
        const response = await axios.get<{ pdfBase64: string }>(`${API_BASE_URL}/${cvId}/original-pdf`);
        return response.data;
    } catch (error: any) {
        console.error('Get CV original PDF API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred fetching the original PDF.' };
    }
};

/**
 * Upload a new CV file (creates/replaces master CV)
 */
export const uploadCV = async (file: File): Promise<UploadCvResponse> => {
    const formData = new FormData();
    formData.append('cvFile', file);

    try {
        const response = await axios.post<UploadCvResponse>(`${API_BASE_URL}/upload`, formData);
        return response.data;
    } catch (error: any) {
        console.error('Upload CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred uploading CV.' };
    }
};

/**
 * Create a job-specific CV (copies from master if no cvJson provided)
 */
export const createJobCv = async (
    jobId: string,
    options?: { cvJson?: JsonResumeSchema; templateId?: string }
): Promise<UpdateCvResponse> => {
    try {
        const response = await axios.post<UpdateCvResponse>(
            `${API_BASE_URL}/job/${jobId}`,
            options || {}
        );
        return response.data;
    } catch (error: any) {
        console.error('Create job CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred creating job CV.' };
    }
};

/**
 * Copy a base CV to a job as a fully independent document.
 * Both the JSON and the original binary are deep-copied so future edits or
 * deletion of the base CV will NOT affect this job's CV.
 */
export const createJobCvFromBase = async (
    jobId: string,
    baseCvId?: string,
    templateId?: string
): Promise<UpdateCvResponse> => {
    try {
        const response = await axios.post<UpdateCvResponse>(
            `${API_BASE_URL}/job/${jobId}/from-base`,
            { baseCvId: baseCvId || null, templateId: templateId || null }
        );
        return response.data;
    } catch (error: any) {
        console.error('Create job CV from base API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred copying the base CV to the job.' };
    }
};

/**
 * Remove the CV attached to a specific job (deletes by jobApplicationId — more robust than by _id).
 */
export const detachJobCv = async (jobId: string): Promise<{ message: string; deletedCount: number }> => {
    try {
        const response = await axios.delete<{ message: string; deletedCount: number }>(`${API_BASE_URL}/job/${jobId}`);
        return response.data;
    } catch (error: any) {
        console.error('Detach job CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred removing the CV for this job.' };
    }
};

/**
 * Upload a PDF/DOCX CV file directly for a specific job.
 * The file is parsed and stored as an independent job CV document.
 * Accepts PDF and DOCX formats only.
 */
export const uploadCvForJob = async (
    jobId: string,
    file: File,
    templateId?: string
): Promise<UpdateCvResponse> => {
    const formData = new FormData();
    formData.append('cvFile', file);
    if (templateId) formData.append('templateId', templateId);

    try {
        const response = await axios.post<UpdateCvResponse>(
            `${API_BASE_URL}/job/${jobId}/upload`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    } catch (error: any) {
        console.error('Upload CV for job API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred uploading the CV for this job.' };
    }
};

/**
 * Update a CV by ID
 */
export const updateCv = async (
    cvId: string,
    data: { cvJson?: JsonResumeSchema; cvDescriptor?: CvSectionDescriptor[]; cvData?: Record<string, any>; templateId?: string }
): Promise<UpdateCvResponse> => {
    try {
        const response = await axios.put<UpdateCvResponse>(`${API_BASE_URL}/${cvId}`, data);
        return response.data;
    } catch (error: any) {
        console.error('Update CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred updating CV.' };
    }
};

/**
 * Re-generate descriptor and data from the stored cvJson (for legacy CVs or manual refresh).
 */
export const restructureCv = async (cvId: string): Promise<{ message: string; cvDescriptor: CvSectionDescriptor[]; cvData: Record<string, any> }> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/${cvId}/restructure`);
        return response.data;
    } catch (error: any) {
        console.error('Restructure CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred restructuring the CV.' };
    }
};

/**
 * Improve a single dynamic section using AI.
 */
export const improveSectionDynamic = async (
    cvId: string,
    descriptor: CvSectionDescriptor,
    sectionData: any,
    customInstructions?: string
): Promise<{ message: string; improvedData: any }> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/${cvId}/improve-section-dynamic`, {
            descriptor,
            sectionData,
            customInstructions,
        });
        return response.data;
    } catch (error: any) {
        console.error('Improve dynamic section API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred improving the section.' };
    }
};

/**
 * Delete a CV by ID
 */
export const deleteCv = async (cvId: string): Promise<DeleteCvResponse> => {
    try {
        const response = await axios.delete<DeleteCvResponse>(`${API_BASE_URL}/${cvId}`);
        return response.data;
    } catch (error: any) {
        console.error('Delete CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred deleting CV.' };
    }
};

/**
 * Promote a job CV to become the master CV
 */
export const promoteCvToMaster = async (cvId: string): Promise<PromoteCvResponse> => {
    try {
        const response = await axios.post<PromoteCvResponse>(`${API_BASE_URL}/${cvId}/promote`);
        return response.data;
    } catch (error: any) {
        console.error('Promote CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred promoting CV.' };
    }
};

/**
 * Generate PDF preview for a CV by ID
 */
export const previewCvById = async (
    cvId: string,
    template?: string
): Promise<PreviewCvResponse> => {
    try {
        const response = await axios.post<PreviewCvResponse>(
            `${API_BASE_URL}/${cvId}/preview`,
            { template }
        );
        return response.data;
    } catch (error: any) {
        console.error('Preview CV API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred generating preview.' };
    }
};

/**
 * Generate PDF preview from provided CV data (without saving)
 */
export const previewCv = async (
    cvData: JsonResumeSchema,
    template?: string
): Promise<PreviewCvResponse> => {
    try {
        const response = await axios.post<PreviewCvResponse>(`${API_BASE_URL}/preview`, {
            cvData,
            template,
        });
        return response.data;
    } catch (error: any) {
        console.error('Preview CV data API error:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data;
        }
        throw { message: 'An unknown error occurred generating preview.' };
    }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the effective template for a CV (with fallback to user default)
 */
export const getEffectiveTemplate = (cv: CVDocument, userDefault?: string): string => {
    return cv.templateId || userDefault || 'modern-clean';
};

/**
 * Filter CVs by type (updated for branch system)
 */
export const filterPrimaryCv = (cvs: CVDocument[]): CVDocument | undefined => {
    return cvs.find(cv => cv.isPrimary);
};

export const filterMasterCv = (cvs: CVDocument[]): CVDocument | undefined => {
    return cvs.find(cv => cv.isMasterCv);
};

export const filterBranchCvs = (cvs: CVDocument[]): CVDocument[] => {
    return cvs.filter(cv => !cv.isPrimary && !cv.isMasterCv);
};

export const filterJobCvs = (cvs: CVDocument[]): CVDocument[] => {
    return cvs.filter(cv => !cv.isMasterCv);
};

/**
 * Find CV for a specific job
 */
export const findCvForJob = (cvs: CVDocument[], jobId: string): CVDocument | undefined => {
    return cvs.find(cv => cv.jobApplicationId === jobId);
};