import mongoose, { Document, Schema } from 'mongoose';

export type ErrorType = 'frontend' | 'backend' | 'network';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface IErrorLog extends Document {
    errorType: ErrorType;
    severity: ErrorSeverity;
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    method?: string;
    endpoint?: string;
    statusCode?: number;
    userId?: mongoose.Types.ObjectId;
    userEmail?: string;
    metadata?: Record<string, any>;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ErrorLogSchema: Schema = new Schema(
    {
        errorType: {
            type: String,
            enum: ['frontend', 'backend', 'network'],
            required: true,
            index: true,
        },
        severity: {
            type: String,
            enum: ['info', 'warning', 'error', 'critical'],
            required: true,
            index: true,
        },
        message: {
            type: String,
            required: true,
            maxlength: 5000,
        },
        stack: {
            type: String,
            maxlength: 10000,
        },
        url: {
            type: String,
            maxlength: 2000,
        },
        userAgent: {
            type: String,
            maxlength: 500,
        },
        method: {
            type: String,
            uppercase: true,
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        },
        endpoint: {
            type: String,
            maxlength: 500,
        },
        statusCode: {
            type: Number,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        userEmail: {
            type: String,
            maxlength: 255,
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
        resolved: {
            type: Boolean,
            default: false,
            index: true,
        },
        resolvedAt: {
            type: Date,
        },
        resolvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ errorType: 1, severity: 1, resolved: 1 });
ErrorLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
