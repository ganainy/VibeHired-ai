// server/src/models/EmailSuggestion.ts
import mongoose, { Document, Schema } from 'mongoose';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';
export type JobStatus = 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Offer';

export interface IEmailSuggestion extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    jobApplicationId?: mongoose.Schema.Types.ObjectId;
    gmailMessageId: string;
    emailSubject: string;
    emailSnippet: string;
    senderName?: string;
    senderEmail?: string;
    suggestedStatus: JobStatus | null;
    suggestedNote?: string;
    confidence: 'high' | 'medium' | 'low';
    matchedCompanyName?: string;
    matchedJobTitle?: string;
    status: SuggestionStatus;
    createdAt: Date;
    updatedAt: Date;
}

const EmailSuggestionSchema = new Schema<IEmailSuggestion>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        jobApplicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', index: true },
        gmailMessageId: { type: String, required: true },
        emailSubject: { type: String, required: true },
        emailSnippet: { type: String, required: true },
        senderName: { type: String },
        senderEmail: { type: String },
        suggestedStatus: {
            type: String,
            enum: ['Applied', 'Not Applied', 'Interview', 'Assessment', 'Rejected', 'Offer', null],
            default: null,
        },
        suggestedNote: { type: String },
        confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
        matchedCompanyName: { type: String },
        matchedJobTitle: { type: String },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending',
            index: true,
        },
    },
    { timestamps: true }
);

// Compound index: one suggestion per Gmail message per user
EmailSuggestionSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });

const EmailSuggestion = mongoose.model<IEmailSuggestion>('EmailSuggestion', EmailSuggestionSchema);
export default EmailSuggestion;
