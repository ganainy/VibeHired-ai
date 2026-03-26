import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'}`;

export type ErrorType = 'frontend' | 'backend' | 'network';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLogEntry {
    _id: string;
    errorType: ErrorType;
    severity: ErrorSeverity;
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    method?: string;
    endpoint?: string;
    statusCode?: number;
    userId?: string;
    userEmail?: string;
    metadata?: Record<string, any>;
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ErrorStats {
    total: number;
    unresolved: number;
    bySeverity: Record<ErrorSeverity, number>;
    byType: Record<ErrorType, number>;
    critical: number;
}

export interface GetErrorLogsResponse {
    logs: ErrorLogEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const reportError = async (data: {
    errorType: ErrorType;
    severity: ErrorSeverity;
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    method?: string;
    endpoint?: string;
    statusCode?: number;
    userId?: string;
    userEmail?: string;
    metadata?: Record<string, any>;
}): Promise<void> => {
    try {
        await axios.post(`${API_BASE_URL}/errors`, data);
    } catch (error) {
        console.error('Failed to report error:', error);
    }
};

export const getErrorStats = async (): Promise<ErrorStats> => {
    const response = await axios.get<ErrorStats>(`${API_BASE_URL}/admin/errors/stats`);
    return response.data;
};

export const getErrorLogs = async (params?: {
    page?: number;
    limit?: number;
    errorType?: ErrorType;
    severity?: ErrorSeverity;
    resolved?: boolean;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
}): Promise<GetErrorLogsResponse> => {
    const response = await axios.get<GetErrorLogsResponse>(`${API_BASE_URL}/admin/errors`, {
        params
    });
    return response.data;
};

export const getErrorLogById = async (errorId: string): Promise<ErrorLogEntry> => {
    const response = await axios.get<ErrorLogEntry>(`${API_BASE_URL}/admin/errors/${errorId}`);
    return response.data;
};

export const resolveError = async (errorId: string): Promise<void> => {
    await axios.patch(`${API_BASE_URL}/admin/errors/${errorId}/resolve`);
};

export const bulkResolveErrors = async (errorIds: string[]): Promise<void> => {
    await axios.post(`${API_BASE_URL}/admin/errors/bulk-resolve`, { errorIds });
};

export const deleteErrorLog = async (errorId: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/admin/errors/${errorId}`);
};
