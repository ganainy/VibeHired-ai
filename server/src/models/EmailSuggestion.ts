// server/src/models/EmailSuggestion.ts
import mongoose, { Document, Schema } from 'mongoose';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';
export type JobStatus = 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Offer';

export type EmailCategory = 'application_response' | 'job_offer';

export interface ISuggestedCalendarEvent {
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore: number;
}

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
    suggestedCalendarEvent?: ISuggestedCalendarEvent;
    noteAdded?: boolean;
    confidence: 'high' | 'medium' | 'low';
    emailCategory: EmailCategory;
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
        suggestedCalendarEvent: {
            title: { type: String },
            description: { type: String },
            dateTimeISO: { type: String },
            notificationMinutesBefore: { type: Number, default: 30 },
        },
        noteAdded: { type: Boolean, default: false },
        confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
        emailCategory: { type: String, enum: ['application_response', 'job_offer'], default: 'application_response' },
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

// TTL index: auto-delete suggestions after 90 days
EmailSuggestionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 });

const EmailSuggestion = mongoose.model<IEmailSuggestion>('EmailSuggestion', EmailSuggestionSchema);
export default EmailSuggestion;
