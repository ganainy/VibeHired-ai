// client/src/services/coverLetterApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

/**
 * Structured cover letter response from the API
 */
export interface CoverLetterResponse {
    success: boolean;
    coverLetterText: string;
    fileName: string;             // Suggested filename for downloads
    emailSubject: string;         // Email subject line
    emailBody: string;            // Email body with attachment note
    emailRecipient?: string;      // Optional recipient email/address
    language: 'en' | 'de';
    message?: string;
    error?: string;
    // Legacy field for backward compatibility
    suggestedFilename?: string;
}

/**
 * Result from generating a cover letter
 */
export interface GenerateCoverLetterResult {
    text: string;
    fileName: string;
    emailSubject: string;
    emailBody: string;
    emailRecipient?: string;
    suggestedFilename?: string; // Legacy
}

/**
 * Generate a cover letter for a specific job application
 * @param jobId The ID of the job application
 * @param language The language for the cover letter ('en' or 'de')
 * @param baseCvData Optional CV data to use instead of master CV
 * @returns Object with cover letter text and email information
 */
export const generateCoverLetter = async (
    jobId: string,
    language: 'en' | 'de' = 'en',
    baseCvData?: any,
    humanize: boolean = true
): Promise<GenerateCoverLetterResult> => {
    try {
        const response = await axios.post<CoverLetterResponse>(
            `${API_BASE_URL}/cover-letter/${jobId}`,
            { language, baseCvData, humanize }
        );

        if (!response.data.success || !response.data.coverLetterText) {
            throw new Error(response.data.message || 'Failed to generate cover letter');
        }

        return {
            text: response.data.coverLetterText,
            fileName: response.data.fileName || response.data.suggestedFilename || '',
            emailSubject: response.data.emailSubject || '',
            emailBody: response.data.emailBody || '',
            emailRecipient: response.data.emailRecipient,
            suggestedFilename: response.data.suggestedFilename
        };
    } catch (error: any) {
        console.error('Error generating cover letter:', error);
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data?.message ||
                error.response.data?.error ||
                `HTTP error! status: ${error.response.status}`;
            throw new Error(errorMessage);
        }
        throw new Error(error.message || 'Failed to generate cover letter');
    }
};
