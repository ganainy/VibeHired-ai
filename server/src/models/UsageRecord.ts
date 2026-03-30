// server/src/models/UsageRecord.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IUsageRecord extends Document {
    userId: mongoose.Types.ObjectId;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    credits: {
        used: number;
        limit: number;
    };
    actions: {
        chatMessages: number;
        jobExtractions: number;
        emailScans: number;
        atsScoring: number;
        cvGeneration: number;
        coverLetter: number;
        autoJobsWorkflow: number;
        cvParsing: number;
        analysis: number;
        interview: number;
        interviewGenerateQuestions: number;
        interviewEvaluate: number;
        interviewAnswer: number;
        interviewStreamAnswer: number;
    };
    history: Array<{
        action: string;
        credits: number;
        timestamp: Date;
        metadata?: Record<string, any>;
    }>;
}

const UsageRecordSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        billingPeriodStart: {
            type: Date,
            required: true
        },
        billingPeriodEnd: {
            type: Date,
            required: true
        },
        credits: {
            used: {
                type: Number,
                default: 0
            },
            limit: {
                type: Number,
                required: true
            },
        },
        actions: {
            chatMessages: { type: Number, default: 0 },
            jobExtractions: { type: Number, default: 0 },
            emailScans: { type: Number, default: 0 },
            atsScoring: { type: Number, default: 0 },
            cvGeneration: { type: Number, default: 0 },
            coverLetter: { type: Number, default: 0 },
            autoJobsWorkflow: { type: Number, default: 0 },
            cvParsing: { type: Number, default: 0 },
            analysis: { type: Number, default: 0 },
            interview: { type: Number, default: 0 },
            interviewGenerateQuestions: { type: Number, default: 0 },
            interviewEvaluate: { type: Number, default: 0 },
            interviewAnswer: { type: Number, default: 0 },
            interviewStreamAnswer: { type: Number, default: 0 },
        },
        history: [
            {
                action: { type: String, required: true },
                credits: { type: Number, required: true },
                timestamp: { type: Date, default: Date.now },
                metadata: { type: Schema.Types.Mixed },
            },
        ],
    },
    {
        timestamps: true
    }
);

// Compound index for fast lookup of current period usage
UsageRecordSchema.index({ userId: 1, billingPeriodStart: -1 });

export default mongoose.model<IUsageRecord>('UsageRecord', UsageRecordSchema);
