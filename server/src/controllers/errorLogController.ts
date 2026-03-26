import { Request, Response } from 'express';
import ErrorLog, { ErrorType, ErrorSeverity } from '../models/ErrorLog';
import { logError, resolveError, getErrorStats as fetchErrorStats } from '../services/errorLogger';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
    user?: any;
}

export async function createErrorLog(req: Request, res: Response) {
    try {
        const {
            errorType,
            severity,
            message,
            stack,
            url,
            userAgent,
            method,
            endpoint,
            statusCode,
            userId,
            userEmail,
            metadata,
        } = req.body;

        if (!errorType || !severity || !message) {
            res.status(400).json({ message: 'errorType, severity, and message are required' });
            return;
        }

        const validErrorTypes: ErrorType[] = ['frontend', 'backend', 'network'];
        const validSeverities: ErrorSeverity[] = ['info', 'warning', 'error', 'critical'];

        if (!validErrorTypes.includes(errorType)) {
            res.status(400).json({ message: 'Invalid errorType' });
            return;
        }

        if (!validSeverities.includes(severity)) {
            res.status(400).json({ message: 'Invalid severity' });
            return;
        }

        const errorLog = await logError({
            errorType,
            severity,
            message,
            stack,
            url,
            userAgent,
            method,
            endpoint,
            statusCode,
            userId,
            userEmail,
            metadata,
        });

        res.status(201).json(errorLog);
    } catch (error) {
        console.error('createErrorLog error:', error);
        res.status(500).json({ message: 'Failed to create error log' });
    }
}

export async function getErrorLogs(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const filter: Record<string, any> = {};

        if (req.query.errorType) {
            filter.errorType = req.query.errorType;
        }

        if (req.query.severity) {
            filter.severity = req.query.severity;
        }

        if (req.query.resolved) {
            filter.resolved = req.query.resolved === 'true';
        }

        if (req.query.userId) {
            filter.userId = new mongoose.Types.ObjectId(req.query.userId as string);
        }

        if (req.query.dateFrom || req.query.dateTo) {
            filter.createdAt = {};
            if (req.query.dateFrom) {
                filter.createdAt.$gte = new Date(req.query.dateFrom as string);
            }
            if (req.query.dateTo) {
                filter.createdAt.$lte = new Date(req.query.dateTo as string);
            }
        }

        const [logs, total] = await Promise.all([
            ErrorLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ErrorLog.countDocuments(filter),
        ]);

        res.json({
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('getErrorLogs error:', error);
        res.status(500).json({ message: 'Failed to fetch error logs' });
    }
}

export async function getErrorLogById(req: Request, res: Response) {
    try {
        const { errorId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(errorId)) {
            res.status(400).json({ message: 'Invalid error ID' });
            return;
        }

        const errorLog = await ErrorLog.findById(errorId).lean();

        if (!errorLog) {
            res.status(404).json({ message: 'Error log not found' });
            return;
        }

        res.json(errorLog);
    } catch (error) {
        console.error('getErrorLogById error:', error);
        res.status(500).json({ message: 'Failed to fetch error log' });
    }
}

export async function resolveErrorLog(req: AuthenticatedRequest, res: Response) {
    try {
        const { errorId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(errorId)) {
            res.status(400).json({ message: 'Invalid error ID' });
            return;
        }

        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const errorLog = await resolveError(errorId, userId);

        if (!errorLog) {
            res.status(404).json({ message: 'Error log not found' });
            return;
        }

        res.json({ message: 'Error resolved', errorLog });
    } catch (error) {
        console.error('resolveErrorLog error:', error);
        res.status(500).json({ message: 'Failed to resolve error log' });
    }
}

export async function getErrorStats(req: Request, res: Response) {
    try {
        const stats = await fetchErrorStats();
        res.json(stats);
    } catch (error) {
        console.error('getErrorStats error:', error);
        res.status(500).json({ message: 'Failed to fetch error stats' });
    }
}

export async function bulkResolveErrors(req: AuthenticatedRequest, res: Response) {
    try {
        const { errorIds } = req.body;

        if (!Array.isArray(errorIds) || errorIds.length === 0) {
            res.status(400).json({ message: 'errorIds array is required' });
            return;
        }

        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const validIds = errorIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));

        const result = await ErrorLog.updateMany(
            { _id: { $in: validIds } },
            {
                resolved: true,
                resolvedAt: new Date(),
                resolvedBy: userId,
            }
        );

        res.json({
            message: `Resolved ${result.modifiedCount} errors`,
            modifiedCount: result.modifiedCount,
        });
    } catch (error) {
        console.error('bulkResolveErrors error:', error);
        res.status(500).json({ message: 'Failed to bulk resolve errors' });
    }
}

export async function deleteErrorLog(req: Request, res: Response) {
    try {
        const { errorId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(errorId)) {
            res.status(400).json({ message: 'Invalid error ID' });
            return;
        }

        const errorLog = await ErrorLog.findByIdAndDelete(errorId);

        if (!errorLog) {
            res.status(404).json({ message: 'Error log not found' });
            return;
        }

        res.json({ message: 'Error log deleted' });
    } catch (error) {
        console.error('deleteErrorLog error:', error);
        res.status(500).json({ message: 'Failed to delete error log' });
    }
}
