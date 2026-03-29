import ErrorLog, { IErrorLog, ErrorType, ErrorSeverity } from '../models/ErrorLog';
import mongoose from 'mongoose';

interface ErrorLogInput {
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
}

const ERROR_DEDUPE_WINDOW_MS = 2 * 60 * 1000;

export async function logError(input: ErrorLogInput): Promise<IErrorLog> {
    const normalizedMessage = input.message?.trim();
    const normalizedStack = input.stack?.trim();
    const normalizedUrl = input.url?.trim();
    const normalizedMethod = input.method?.trim().toUpperCase();
    const normalizedEndpoint = input.endpoint?.trim();
    const normalizedUserEmail = input.userEmail?.trim().toLowerCase();

    const doc: Partial<IErrorLog> = {
        errorType: input.errorType,
        severity: input.severity,
        message: normalizedMessage,
        stack: normalizedStack,
        url: normalizedUrl,
        userAgent: input.userAgent,
        method: normalizedMethod,
        endpoint: normalizedEndpoint,
        statusCode: input.statusCode,
        userEmail: normalizedUserEmail,
        metadata: input.metadata,
        resolved: false,
    };

    const createdAfter = new Date(Date.now() - ERROR_DEDUPE_WINDOW_MS);
    const dedupeFilter: Record<string, any> = {
        errorType: input.errorType,
        severity: input.severity,
        message: normalizedMessage,
        stack: normalizedStack,
        url: normalizedUrl,
        method: normalizedMethod,
        endpoint: normalizedEndpoint,
        statusCode: input.statusCode,
        userEmail: normalizedUserEmail,
        resolved: false,
        createdAt: { $gte: createdAfter },
    };

    if (normalizedStack === undefined) {
        dedupeFilter.stack = { $in: [null, ''] };
    }
    if (normalizedUrl === undefined) {
        dedupeFilter.url = { $in: [null, ''] };
    }
    if (normalizedMethod === undefined) {
        dedupeFilter.method = { $in: [null, ''] };
    }
    if (normalizedEndpoint === undefined) {
        dedupeFilter.endpoint = { $in: [null, ''] };
    }
    if (input.statusCode === undefined) {
        dedupeFilter.statusCode = { $in: [null] };
    }
    if (normalizedUserEmail === undefined) {
        dedupeFilter.userEmail = { $in: [null, ''] };
    }

    if (input.userId && mongoose.Types.ObjectId.isValid(input.userId)) {
        const objectUserId = new mongoose.Types.ObjectId(input.userId);
        doc.userId = objectUserId;
        dedupeFilter.userId = objectUserId;
    } else {
        dedupeFilter.userId = { $in: [null] };
    }

    const existing = await ErrorLog.findOne(dedupeFilter).sort({ createdAt: -1 });
    if (existing) {
        return existing;
    }

    const errorLog = new ErrorLog(doc);
    return errorLog.save();
}

export async function logFrontendError(
    message: string,
    stack?: string,
    url?: string,
    userId?: string,
    userEmail?: string,
    metadata?: Record<string, any>
): Promise<IErrorLog> {
    const severity = determineSeverity(message, stack);

    return logError({
        errorType: 'frontend',
        severity,
        message,
        stack,
        url,
        userId,
        userEmail,
        metadata,
    });
}

export async function logNetworkError(
    message: string,
    method?: string,
    endpoint?: string,
    statusCode?: number,
    userId?: string,
    userEmail?: string,
    metadata?: Record<string, any>
): Promise<IErrorLog> {
    const severity = statusCode && statusCode >= 500 ? 'error' : 
                     statusCode && statusCode >= 400 ? 'warning' : 'info';

    return logError({
        errorType: 'network',
        severity,
        message,
        method,
        endpoint,
        statusCode,
        userId,
        userEmail,
        metadata,
    });
}

export async function logBackendError(
    message: string,
    stack?: string,
    userId?: string,
    userEmail?: string,
    metadata?: Record<string, any>
): Promise<IErrorLog> {
    const severity = determineSeverity(message, stack);

    return logError({
        errorType: 'backend',
        severity,
        message,
        stack,
        userId,
        userEmail,
        metadata,
    });
}

function determineSeverity(message: string, stack?: string): ErrorSeverity {
    const lowerMessage = message.toLowerCase();
    const lowerStack = stack?.toLowerCase() || '';
    
    if (lowerMessage.includes('critical') || lowerStack.includes('fatal')) {
        return 'critical';
    }
    if (lowerMessage.includes('error') || lowerMessage.includes('exception') || lowerStack.includes('error')) {
        return 'error';
    }
    if (lowerMessage.includes('warn') || lowerStack.includes('warn')) {
        return 'warning';
    }
    return 'info';
}

export async function resolveError(
    errorId: string,
    resolvedByUserId: string
): Promise<IErrorLog | null> {
    if (!mongoose.Types.ObjectId.isValid(errorId)) {
        return null;
    }

    return ErrorLog.findByIdAndUpdate(
        errorId,
        {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: new mongoose.Types.ObjectId(resolvedByUserId),
        },
        { new: true }
    );
}

export async function getErrorStats(): Promise<{
    total: number;
    unresolved: number;
    bySeverity: Record<ErrorSeverity, number>;
    byType: Record<ErrorType, number>;
    critical: number;
}> {
    const stats = await ErrorLog.aggregate([
        {
            $facet: {
                total: [{ $count: 'count' }],
                unresolved: [
                    { $match: { resolved: false } },
                    { $count: 'count' }
                ],
                bySeverity: [
                    { $group: { _id: '$severity', count: { $sum: 1 } } }
                ],
                byType: [
                    { $group: { _id: '$errorType', count: { $sum: 1 } } }
                ],
                critical: [
                    { $match: { severity: 'critical', resolved: false } },
                    { $count: 'count' }
                ],
            }
        }
    ]);

    const result = stats[0] || {};
    
    const bySeverity: Record<ErrorSeverity, number> = { info: 0, warning: 0, error: 0, critical: 0 };
    for (const item of (result.bySeverity || []) as any[]) {
        if (item._id in bySeverity) {
            bySeverity[item._id as ErrorSeverity] = item.count;
        }
    }
    
    const byType: Record<ErrorType, number> = { frontend: 0, backend: 0, network: 0 };
    for (const item of (result.byType || []) as any[]) {
        if (item._id in byType) {
            byType[item._id as ErrorType] = item.count;
        }
    }
    
    return {
        total: result.total?.[0]?.count || 0,
        unresolved: result.unresolved?.[0]?.count || 0,
        bySeverity,
        byType,
        critical: result.critical?.[0]?.count || 0,
    };
}
