import axios from 'axios';

// Extend the axios request config so call-sites can opt a request out of the
// global 401 → logout interceptor (useful for optional background fetches).
// AxiosRequestConfig is the public type used by axios.get/post/etc.
// InternalAxiosRequestConfig (used in interceptors) inherits from it.
declare module 'axios' {
  interface AxiosRequestConfig {
    skipLogoutOn401?: boolean;
  }
}

// NOTE: must use VITE_BACKEND_URL (same var as every other service), NOT VITE_API_URL
const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

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
 * @param extraConfig Optional axios request config (e.g. { skipLogoutOn401: true })
 */
export const getUsage = async (extraConfig?: { skipLogoutOn401?: boolean }): Promise<UsageInfo> => {
    const response = await axios.get(`${API_URL}/usage`, extraConfig);
    return response.data;
};
