import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface UsageInfo {
    usage: {
        creditsUsed: number;
        creditLimit: number;
        remaining: number;
        billingPeriodEnd: string;
        plan: string;
        role: string;
        emailVerified: boolean;
    };
    actions: Record<string, number>;
    history: Array<{
        action: string;
        credits: number;
        timestamp: string;
        metadata?: any;
    }>;
}

/**
 * Get the current user's usage and credit status.
 */
export const getUsage = async (): Promise<UsageInfo> => {
    const response = await axios.get(`${API_URL}/usage`);
    return response.data;
};
