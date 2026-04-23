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

export interface GenerationProgressEvent {
    type: 'progress';
    step: string;
    stepLabel: string;
    description: string;
    progress: number;
    elapsedMs: number;
}

export interface GenerationCompleteEvent {
    type: 'complete';
    status: "draft_ready";
    message: string;
    jobId: string;
    changesCount?: number;
    tailoringSummary?: {
        keywordsCount: number;
        competencyCount: number;
        patchedSectionsCount: number;
        keywordInjectionsCount: number;
    };
}

export interface GenerationErrorEvent {
    type: 'error';
    error: string;
}

export type GenerationSseEvent = GenerationProgressEvent | GenerationCompleteEvent | GenerationErrorEvent;

export type GenerationProgressCallback = (event: GenerationProgressEvent) => void;

export const generateCvWithProgress = async (
    jobId: string,
    language: 'en' | 'de' = 'en',
    options: any = {},
    onProgress?: GenerationProgressCallback,
): Promise<GenerateDraftReadyResponse> => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/generator/${jobId}/generate-cv`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ language, ...options }),
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error((errBody as any).message || `HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: GenerateDraftReadyResponse | null = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (!jsonStr) continue;

            try {
                const event: GenerationSseEvent = JSON.parse(jsonStr);

                if (event.type === 'progress' && onProgress) {
                    onProgress(event);
                } else if (event.type === 'complete') {
                    finalResult = {
                        status: event.status,
                        message: event.message,
                        jobId: event.jobId,
                        changesCount: event.changesCount,
                    };
                } else if (event.type === 'error') {
                    throw new Error(event.error || 'Failed to generate CV');
                }
            } catch (e) {
                if (e instanceof Error && e.message !== 'Failed to generate CV' && !e.message.includes('HTTP error')) {
                    console.warn('Failed to parse SSE event:', jsonStr, e);
                } else {
                    throw e;
                }
            }
        }
    }

    if (!finalResult) {
        throw new Error('Generation completed but no result was received from the server.');
    }

    return finalResult;
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