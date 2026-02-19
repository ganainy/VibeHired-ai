// ATS API service for frontend
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

// Helper to get the auth token from localStorage
const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken');
};

export interface AtsScores {
    score?: number | null;
    skillMatchDetails?: {
        skillMatchPercentage?: number;
        matchedSkills?: string[];
        missingSkills?: string[];
        recommendations?: string[];
        gapAnalysis?: Record<string, any>;
    } | null;
    complianceDetails?: {
        keywordsMatched?: string[];
        keywordsMissing?: string[];
        formattingIssues?: string[];
        suggestions?: string[];
        sectionScores?: Record<string, number>;
        sectionCompleteness?: {
            present: string[];
            missing: string[];
            score: number;
        };
        quantifiableMetrics?: {
            hasMetrics: boolean;
            examples: string[];
            score: number;
        };
        skillsAnalysis?: {
            hardSkills: string[];
            softSkills: string[];
            score: number;
        };
        lengthAnalysis?: {
            pageCount: number;
            wordCount: number;
            isOptimal: boolean;
            score: number;
        };
        readabilityScore?: number;
        atsBlockingElements?: string[];
        standardHeaders?: {
            isStandard: boolean;
            nonStandardHeaders: string[];
            score: number;
        };
        // Enhanced fields for improved ATS analysis
        scoreBreakdown?: {
            technicalSkills: number;
            experienceRelevance: number;
            additionalSkills: number;
            formatting: number;
        };
        prioritizedMissingKeywords?: Array<{
            keyword: string;
            priority: 'high' | 'medium' | 'low';
            context: string;
        }>;
        prioritizedMissingSkills?: Array<{
            skill: string;
            priority: 'high' | 'medium' | 'low';
            context: string;
        }>;
        actionableFeedback?: Array<{
            priority: 'high' | 'medium' | 'low';
            action: string;
            impact: string;
        }>;
    } | null;
    lastAnalyzedAt?: string;
    jobApplicationId?: string;
    error?: string;
}

export interface AtsScanResponse {
    message: string;
    analysisId: string;
}

export interface AtsScoresResponse {
    analysisId: string;
    atsScores: AtsScores | null;
}

/**
 * Trigger ATS scan for current user's CV
 * @param jobApplicationId - Optional job application ID to get job description from
 * @param analysisId - Optional existing analysis ID to update
 */
export const scanAts = async (
    jobApplicationId?: string,
    analysisId?: string,
    excludeSuggestions?: string[]
): Promise<AtsScanResponse> => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found.');
    }

    try {
        const response = await axios.post<AtsScanResponse>(
            `${API_BASE_URL}/ats/scan`,
            {
                jobApplicationId,
                analysisId,
                ...(excludeSuggestions && excludeSuggestions.length > 0 ? { excludeSuggestions } : {})
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
        console.error('Error triggering ATS scan:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to start ATS scan');
    }
};

/**
 * Trigger ATS scan for a specific analysis
 * @param analysisId - The analysis ID to scan
 * @param jobApplicationId - Optional job application ID to get job description from
 */
export const scanAtsForAnalysis = async (
    analysisId: string,
    jobApplicationId?: string
): Promise<AtsScanResponse> => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found.');
    }

    try {
        const response = await axios.post<AtsScanResponse>(
            `${API_BASE_URL}/ats/scan/${analysisId}`,
            {
                jobApplicationId
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
        console.error('Error triggering ATS scan for analysis:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to start ATS scan');
    }
};

/**
 * Get ATS scores for a specific analysis
 * @param analysisId - The analysis ID
 */
export const getAtsScores = async (analysisId: string): Promise<AtsScoresResponse> => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found.');
    }

    if (!analysisId) {
        throw new Error('Analysis ID is required.');
    }

    try {
        const response = await axios.get<AtsScoresResponse>(
            `${API_BASE_URL}/ats/scores/${analysisId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error(`Error fetching ATS scores for ${analysisId}:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch ATS scores');
    }
};

/**
 * Get existing ATS scores for a job application
 * @param jobApplicationId - The job application ID
 */
export const getAtsForJob = async (jobApplicationId: string): Promise<AtsScoresResponse> => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found.');
    }

    if (!jobApplicationId) {
        throw new Error('Job application ID is required.');
    }

    try {
        const response = await axios.get<AtsScoresResponse>(
            `${API_BASE_URL}/ats/job/${jobApplicationId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error(`Error fetching ATS scores for job ${jobApplicationId}:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch ATS scores for job');
    }
};

/**
 * Get the latest general ATS analysis (without job application)
 * GET /api/ats/latest
 */
export const getLatestAts = async (): Promise<AtsScoresResponse> => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found.');
    }

    try {
        const response = await axios.get<AtsScoresResponse>(
            `${API_BASE_URL}/ats/latest`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('Error fetching latest ATS scores:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch latest ATS scores');
    }
};

/**
 * Delete an ATS analysis
 * @param analysisId - The analysis ID to delete
 */
export const deleteAtsAnalysis = async (analysisId: string): Promise<void> => {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found.');
    }

    try {
        await axios.delete(
            `${API_BASE_URL}/ats/${analysisId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
    } catch (error: any) {
        console.error(`Error deleting ATS analysis ${analysisId}:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to delete ATS analysis');
    }
};

