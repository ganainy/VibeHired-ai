import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'}/admin`;

export interface AdminStats {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    mrr: number;
    tierDistribution: Record<string, number>;
    recentPayments: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        customerEmail: string;
        createdAt: string;
    }>;
    externalCalls?: {
        totals: {
            ai: number;
            apify: number;
            all: number;
        };
        last24h: {
            ai: number;
            apify: number;
            all: number;
        };
        successful: number;
        failed: number;
        byProvider: Array<{
            provider: string;
            count: number;
        }>;
        topModels: Array<{
            modelName: string;
            count: number;
        }>;
        recentCalls: Array<{
            _id: string;
            category: 'ai' | 'apify';
            provider: string;
            modelName?: string;
            host: string;
            path: string;
            method: string;
            statusCode?: number;
            success: boolean;
            durationMs: number;
            creditUsed?: number;
            errorMessage?: string;
            createdAt: string;
            userId?: string;
            userEmail?: string;
            metadata?: Record<string, any>;
        }>;
    };
}

export interface AdminUser {
    id: string;
    email: string;
    username: string;
    role: 'user' | 'admin' | 'owner';
    plan: string;
    emailVerified: boolean;
    isBlocked?: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    credits: number;
    totalConsumed: number;
    lastActive: string;
    createdAt: string;
    servicesUsed?: string[];
}

export interface UserUsageDetail {
    usage: {
        total: number;
        consumed: number;
        remaining: number;
        resetAt: string | null;
    };
    actions: Array<{
        type: string;
        consumed: number;
        timestamp: string;
        metadata?: any;
    }>;
}

export interface UserCvSummary {
    id: string;
    displayName: string;
    category: string | null;
    isDefault: boolean;
    templateId: string | null;
    filename: string | null;
    createdAt: string;
    updatedAt: string;
    hasOriginalSnapshot: boolean;
    hasCurrentJson: boolean;
    extractionMode?: 'strict' | 'standard' | null;
    extractionTimestamp?: string | null;
}

export interface GetUserCvLibraryResponse {
    cvs: UserCvSummary[];
}

export interface GetUserCvPreviewResponse {
    pdfBase64: string;
    templateId: string;
    mode: 'original' | 'current';
    source?: 'originalPdf' | 'cvJson';
}

export interface UserCvDetail {
    id: string;
    displayName: string;
    templateId: string | null;
    cvJson: any | null;
    cvDescriptor: any[] | null;
    cvData: Record<string, any> | null;
    filename: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface GetUsersResponse {
    users: AdminUser[];
    total: number;
    page: number;
    limit: number;
}

export const getAdminStats = async (): Promise<AdminStats> => {
    const response = await axios.get<AdminStats>(`${API_BASE_URL}/stats`);
    return response.data;
};

export const getAllUsers = async (search?: string, page = 1, limit = 20): Promise<GetUsersResponse> => {
    const response = await axios.get<GetUsersResponse>(`${API_BASE_URL}/users`, {
        params: { search: search || undefined, page, limit }
    });
    return response.data;
};

export const getUserDetail = async (userId: string): Promise<AdminUser & { usage: UserUsageDetail }> => {
    const response = await axios.get<AdminUser & { usage: UserUsageDetail }>(`${API_BASE_URL}/users/${userId}`);
    return response.data;
};

export const getUserCvLibrary = async (userId: string): Promise<GetUserCvLibraryResponse> => {
    const response = await axios.get<GetUserCvLibraryResponse>(`${API_BASE_URL}/users/${userId}/cvs`);
    return response.data;
};

export const getUserCvPreview = async (
    userId: string,
    cvId: string,
    mode: 'original' | 'current',
    template?: string
): Promise<GetUserCvPreviewResponse> => {
    const response = await axios.get<GetUserCvPreviewResponse>(`${API_BASE_URL}/users/${userId}/cvs/${cvId}/preview`, {
        params: { mode, template }
    });
    return response.data;
};

export const getUserCvDetail = async (userId: string, cvId: string): Promise<UserCvDetail> => {
    const response = await axios.get<UserCvDetail>(`${API_BASE_URL}/users/${userId}/cvs/${cvId}`);
    return response.data;
};

export const updateUserRole = async (userId: string, role: string): Promise<void> => {
    await axios.patch(`${API_BASE_URL}/users/${userId}/role`, { role });
};

export const updateUserPlan = async (userId: string, plan: string): Promise<void> => {
    await axios.patch(`${API_BASE_URL}/users/${userId}/plan`, { plan });
};

export const grantUserCredits = async (userId: string, amount: number, reason: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/users/${userId}/credits`, { amount, reason });
};

export const cancelUserSubscription = async (userId: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/users/${userId}/subscription`);
};

export const setUserBlocked = async (userId: string, isBlocked: boolean): Promise<void> => {
    await axios.patch(`${API_BASE_URL}/users/${userId}`, { isBlocked });
};
