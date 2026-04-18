// client/src/services/generatorApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

// Success response type
interface GenerateSuccessResponse {
    status: "success";
    message: string;
    cvFilename: string;
    coverLetterFilename: string;
}

// Individual PDF response types
interface RenderCvPdfResponse {
    status: "success";
    message: string;
    cvFilename: string;
}

interface RenderCoverLetterPdfResponse {
    status: "success";
    message: string;
    coverLetterFilename: string;
}

// Input requirement type (kept for UserInputModal compatibility)
export interface RequiredInputInfo {
    name: string;
    type: 'text' | 'number' | 'date' | 'textarea';
}

// Draft ready response type
export interface GenerateDraftReadyResponse {
    status: "draft_ready";
    message: string;
    jobId: string;
    changesCount?: number;
}

// Function to generate CV only (without cover letter)
export const generateCvOnly = async (
    jobId: string,
    language: 'en' | 'de' = 'en',
    options: any = {}
): Promise<GenerateDraftReadyResponse> => {
    try {
        const response = await axios.post<GenerateDraftReadyResponse>(
            `${API_BASE_URL}/generator/${jobId}/generate-cv`,
            { language, ...options }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error generating CV:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || `HTTP error! status: ${error.response.status}`);
        }
        throw new Error(error.message || 'Failed to generate CV');
    }
};

// Function to render final PDFs when draft is ready
export const renderFinalPdfs = async (jobId: string): Promise<GenerateSuccessResponse> => {
    try {
        const response = await axios.post<GenerateSuccessResponse>(
            `${API_BASE_URL}/generator/${jobId}/render-pdf`,
            {}
        );
        return response.data;
    } catch (error: any) {
        console.error('Error rendering final PDFs:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || `HTTP error! status: ${error.response.status}`);
        }
        throw new Error(error.message || 'Failed to render final PDFs');
    }
};

// Function to render CV PDF only
export const renderCvPdf = async (jobId: string): Promise<RenderCvPdfResponse> => {
    try {
        const response = await axios.post<RenderCvPdfResponse>(
            `${API_BASE_URL}/generator/${jobId}/render-cv-pdf`,
            {}
        );
        return response.data;
    } catch (error: any) {
        console.error('Error rendering CV PDF:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || `HTTP error! status: ${error.response.status}`);
        }
        throw new Error(error.message || 'Failed to render CV PDF');
    }
};

// Function to render Cover Letter PDF only
export const renderCoverLetterPdf = async (jobId: string): Promise<RenderCoverLetterPdfResponse> => {
    try {
        const response = await axios.post<RenderCoverLetterPdfResponse>(
            `${API_BASE_URL}/generator/${jobId}/render-cover-letter-pdf`,
            {}
        );
        return response.data;
    } catch (error: any) {
        console.error('Error rendering Cover Letter PDF:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || `HTTP error! status: ${error.response.status}`);
        }
        throw new Error(error.message || 'Failed to render Cover Letter PDF');
    }
};

// Helper function to get download URL for generated files
export const getDownloadUrl = (filename: string): string => {
    return `${API_BASE_URL}/generator/download/${filename}`;
};

// Function to improve a CV section
export const improveSection = async (
    sectionName: string,
    sectionData: any,
    customInstructions?: string
): Promise<any> => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        throw new Error('No authentication token found.');
    }

    try {
        const response = await axios.post(
            `${API_BASE_URL}/generator/improve-section`,
            {
                sectionName,
                sectionData,
                customInstructions
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error improving section:', error);
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || 'Failed to improve section');
        }
        throw error;
    }
};