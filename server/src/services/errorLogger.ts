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

export async function logError(input: ErrorLogInput): Promise<IErrorLog> {
    const doc: Partial<IErrorLog> = {
        errorType: input.errorType,
        severity: input.severity,
        message: input.message,
        stack: input.stack,
        url: input.url,
        userAgent: input.userAgent,
        method: input.method,
        endpoint: input.endpoint,
        statusCode: input.statusCode,
        userEmail: input.userEmail,
        metadata: input.metadata,
        resolved: false,
    };

    if (input.userId && mongoose.Types.ObjectId.isValid(input.userId)) {
        doc.userId = new mongoose.Types.ObjectId(input.userId);
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
