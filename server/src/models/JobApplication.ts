// server/src/models/JobApplication.ts
import mongoose, { Document, Schema } from 'mongoose';

// Define allowed statuses
type GenerationStatus = 'none' | 'pending_input' | 'draft_ready' | 'finalized' | 'error';

// Reminder sub-document
export interface IReminder {
    id: string;
    naturalText: string;
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore: number;
    calendarEventId?: string;
    status: 'pending' | 'synced' | 'error';
    createdAt: Date;
}

export interface IFollowUpSuggestion {
    status: 'none' | 'suggested' | 'snoozed' | 'dismissed' | 'sent';
    suggestedAt?: Date;
    snoozedUntil?: Date;
    draftSubject?: string;
    draftBody?: string;
    draftGeneratedAt?: Date;
    sentAt?: Date;
    dismissedAt?: Date;
}

// Interface defining the structure of a Job Application document
export interface IJobApplication extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    jobTitle: string;
    companyName: string;
    status: 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Closed' | 'Offer'; // Example statuses
    dateApplied?: Date; // Optional: Mark when applied
    lastResponseAt?: Date; // Latest detected recruiter/company response timestamp
    lastFollowUpSentAt?: Date; // Latest follow-up email sent timestamp
    jobUrl?: string; // Optional but useful
    notes?: string; // Optional user notes
    salary?: string; // Salary (can be number, range, or text like "50k-70k")
    contact?: string; // Contact info (email, link, or name) - legacy field
    // Structured contact information from AI extraction
    contactEmail?: string; // Recruiter or company contact email
    contactPhone?: string; // Recruiter or company contact phone
    hiringManagerName?: string; // Hiring manager or recruiter name
    applicationUrl?: string; // Direct application URL/portal link
    jobDescriptionText?: string; // Store the scraped text
    language?: string; // Language of the job
    jobPrerequisites?: string; // AI-extracted job requirements and prerequisites

    // --- Auto Job Fields (unified model) ---
    isAutoJob?: boolean; // true if auto-discovered
    showInDashboard?: boolean; // true to show in dashboard
    jobId?: string; // Unique identifier from job board (for auto jobs)
    workflowRunId?: mongoose.Schema.Types.ObjectId; // Reference to workflow run (for auto jobs)
    processingStatus?: 'pending' | 'analyzed' | 'relevant' | 'not_relevant' | 'generated' | 'error'; // For auto jobs
    errorMessage?: string; // Error message for auto jobs
    discoveredAt?: Date; // When auto job was discovered
    processedAt?: Date; // When auto job was processed
    jobPostDate?: Date; // When the job was posted (from crawler)
    deletedAt?: Date; // Soft delete timestamp (for auto jobs to prevent re-fetching)

    // Extracted intelligence from AI analysis (for auto jobs)
    extractedData?: {
        skills?: string[];
        salary?: {
            min?: number;
            max?: number;
            currency?: string;
        };
        salaryRaw?: string; // Raw salary string extracted from the job posting by AI
        estimatedSalary?: string; // AI-estimated salary when not explicitly stated in the posting
        salaryIsEstimate?: boolean; // true = AI estimated, false = extracted from posting
        yearsExperience?: number;
        location?: string;
        remoteOption?: string;
        keyDetails?: string | Array<{ key: string; value: string }>;
    };

    // Company insights from AI research (for auto jobs)
    companyInsights?: {
        missionStatement?: string;
        coreValues?: string[];
        businessModel?: string;
    };

    // --- New Fields for Drafts & Status ---
    draftCoverLetterText?: string; // Store draft Cover Letter text
    // Email fields for cover letter
    coverLetterFileName?: string; // Suggested filename for downloads
    coverLetterEmailSubject?: string; // Email subject line
    coverLetterEmailBody?: string; // Email body with attachment note
    coverLetterEmailRecipient?: string; // Email recipient
    generationStatus?: GenerationStatus; // Track the generation process
    // --- New Fields for Final Filenames ---
    generatedCvFilename?: string; // Store the filename of the latest generated CV PDF
    generatedCoverLetterFilename?: string; // Store the filename of the latest generated CL PDF
    suggestedCoverLetterFilename?: string; // AI-suggested filename based on job/user name
    // --- New Fields for CV Branch System ---
    jobCategory?: string | null;   // e.g., "Software Engineering" (free text)
    baseCvId?: mongoose.Schema.Types.ObjectId | null;  // Which CV branch was used as base
    jobTags?: string[]; // Optional multi-tag fields for grouping/filtering
    // --- Job Type Field ---
    jobType?: 'full-time' | 'part-time' | 'working-student' | 'internship' | 'contract' | 'freelance' | null;
    // --- Chat History ---
    chatHistory?: Array<{
        sender: 'user' | 'ai';
        text: string;
        timestamp: Date;
    }>;
    // --- Recommendation Cache ---
    recommendation?: {
        score: number | null;
        shouldApply: boolean;
        reason: string;
        cachedAt: Date;
        error?: string;
        keywordAnalysis?: {
            matchedKeywords: string[];
            missingKeywords: string[];
        };
    };
    // --- Favorite Flag ---
    isFavorite?: boolean; // User can mark job as favorite
    // --- Reminders ---
    reminders?: IReminder[];
    // --- Follow-up suggestions ---
    followUpSuggestion?: IFollowUpSuggestion;
    // --- Standard Timestamps ---
    createdAt: Date;
    updatedAt: Date;
}

// Mongoose Schema definition
const JobApplicationSchema: Schema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        jobTitle: { type: String, required: true, trim: true },
        companyName: { type: String, required: true, trim: true },
        status: { type: String, required: true, enum: ['Applied', 'Not Applied', 'Interview', 'Assessment', 'Rejected', 'Closed', 'Offer'], default: 'Not Applied' },
        dateApplied: { type: Date },
        lastResponseAt: { type: Date, index: true },
        lastFollowUpSentAt: { type: Date },
        jobUrl: { type: String, trim: true },
        notes: { type: String, trim: true },
        salary: { type: String, trim: true }, // Flexible format: "50000", "50k-70k", "$80,000 - $100,000"
        contact: { type: String, trim: true }, // Email, URL, or name - legacy field
        // Structured contact information from AI extraction
        contactEmail: { type: String, trim: true }, // Recruiter or company contact email
        contactPhone: { type: String, trim: true }, // Recruiter or company contact phone
        hiringManagerName: { type: String, trim: true }, // Hiring manager or recruiter name
        applicationUrl: { type: String, trim: true }, // Direct application URL/portal link
        jobDescriptionText: { type: String }, // Text from scraping
        language: { type: String, trim: true },
        jobPrerequisites: { type: String }, // AI-extracted job requirements and prerequisites

        // --- Auto Job Fields (unified model) ---
        isAutoJob: { type: Boolean, default: false, index: true },
        showInDashboard: { type: Boolean, default: true, index: true }, // Default true for manual jobs, false for auto jobs
        jobId: { type: String, trim: true, index: true }, // Unique identifier from job board (for auto jobs)
        workflowRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowRun', index: true },
        processingStatus: {
            type: String,
            enum: ['pending', 'analyzed', 'relevant', 'not_relevant', 'generated', 'error'],
            index: true
        },
        errorMessage: { type: String },
        discoveredAt: { type: Date, index: true },
        processedAt: { type: Date },
        jobPostDate: { type: Date },
        deletedAt: { type: Date, index: true }, // Soft delete timestamp

        // Extracted intelligence from AI analysis (for auto jobs)
        extractedData: {
            skills: [String],
            salary: {
                min: Number,
                max: Number,
                currency: { type: String, default: 'USD' }
            },
            salaryRaw: String, // Store raw salary string from AI (extracted from posting)
            estimatedSalary: String, // AI-estimated salary when not stated in posting
            salaryIsEstimate: Boolean, // true = AI estimated, false = extracted from posting
            keyDetails: Schema.Types.Mixed, // AI-extracted highlights (array of {key, value} or legacy string)
            yearsExperience: Number,
            location: String,
            remoteOption: String
        },

        // Company insights from AI research (for auto jobs)
        companyInsights: {
            missionStatement: String,
            coreValues: [String],
            businessModel: String
        },

        // --- Schema Definitions for New Fields ---
        draftCoverLetterText: { type: String, required: false },
        // Email fields for cover letter
        coverLetterFileName: { type: String, required: false },
        coverLetterEmailSubject: { type: String, required: false },
        coverLetterEmailBody: { type: String, required: false },
        coverLetterEmailRecipient: { type: String, required: false },
        generationStatus: {
            type: String,
            enum: ['none', 'pending_input', 'pending_generation', 'draft_ready', 'finalized', 'error'], // Added pending_generation
            default: 'none'
        },
        // --- Schema Definitions for New Fields ---
        generatedCvFilename: { type: String, required: false },
        generatedCoverLetterFilename: { type: String, required: false },
        suggestedCoverLetterFilename: { type: String, required: false },
        // --- Schema Definitions for CV Branch System ---
        jobCategory: { type: String, default: null, maxlength: 50 },
        baseCvId: { type: Schema.Types.ObjectId, ref: 'CV', default: null },
        jobTags: { type: [String], default: [] },
        // --- Job Type Schema ---
        jobType: {
            type: String,
            enum: ['full-time', 'part-time', 'working-student', 'internship', 'contract', 'freelance', null],
            default: null
        },
        // --- Chat History Schema ---
        chatHistory: [{
            sender: { type: String, enum: ['user', 'ai'], required: true },
            text: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }],
        // --- Recommendation Cache Schema ---
        recommendation: {
            score: { type: Number, required: false },
            shouldApply: { type: Boolean, required: false },
            reason: { type: String, required: false },
            cachedAt: { type: Date, required: false },
            error: { type: String, required: false },
            keywordAnalysis: {
                matchedKeywords: [{ type: String }],
                missingKeywords: [{ type: String }]
            }
        },
        // --- Favorite Flag Schema ---
        isFavorite: { type: Boolean, default: false, index: true },
        // --- Reminders Schema ---
        reminders: [{
            id: { type: String, required: true },
            naturalText: { type: String, required: true },
            title: { type: String, required: true },
            description: { type: String, default: '' },
            dateTimeISO: { type: String, required: true },
            notificationMinutesBefore: { type: Number, default: 30 },
            calendarEventId: { type: String },
            status: { type: String, enum: ['pending', 'synced', 'error'], default: 'pending' },
            createdAt: { type: Date, default: Date.now }
        }],
        // --- Follow-up suggestion schema ---
        followUpSuggestion: {
            status: {
                type: String,
                enum: ['none', 'suggested', 'snoozed', 'dismissed', 'sent'],
                default: 'none',
                index: true,
            },
            suggestedAt: { type: Date },
            snoozedUntil: { type: Date },
            draftSubject: { type: String },
            draftBody: { type: String },
            draftGeneratedAt: { type: Date },
            sentAt: { type: Date },
            dismissedAt: { type: Date },
        }
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Compound index for deduplication (user + jobId must be unique for auto jobs)
JobApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true, sparse: true });

// Index for querying auto jobs by status and recommendation
JobApplicationSchema.index({ userId: 1, isAutoJob: 1, processingStatus: 1, 'recommendation.shouldApply': 1 });

// Index for querying dashboard jobs
JobApplicationSchema.index({ userId: 1, showInDashboard: 1, status: 1 });
JobApplicationSchema.index({ userId: 1, status: 1, 'followUpSuggestion.status': 1, 'followUpSuggestion.snoozedUntil': 1 });

// Compound index for paginated dashboard queries (userId + showInDashboard + createdAt)
JobApplicationSchema.index({ userId: 1, showInDashboard: 1, createdAt: -1 });

// Indexes for common filter/sort combinations
JobApplicationSchema.index({ userId: 1, showInDashboard: 1, jobType: 1 });
JobApplicationSchema.index({ userId: 1, showInDashboard: 1, isFavorite: 1 });

/**
 * Cascade delete: When a job is deleted, also delete its associated CV
 * This prevents orphan CVs in the database
 */
JobApplicationSchema.post('findOneAndDelete', async function (doc) {
    if (doc) {
        try {
            // Import CV model dynamically to avoid circular dependency
            const CV = (await import('./CV')).default;
            const result = await CV.deleteOne({ jobApplicationId: doc._id });
            if (result.deletedCount > 0) {
                console.log(`Cascade deleted CV for job application ${doc._id}`);
            }
        } catch (error) {
            console.error(`Failed to cascade delete CV for job ${doc._id}:`, error);
        }
    }
});

// Also handle deleteOne and deleteMany
JobApplicationSchema.post('deleteOne', { document: true, query: false }, async function () {
    try {
        const CV = (await import('./CV')).default;
        const result = await CV.deleteOne({ jobApplicationId: this._id });
        if (result.deletedCount > 0) {
            console.log(`Cascade deleted CV for job application ${this._id}`);
        }
    } catch (error) {
        console.error(`Failed to cascade delete CV for job ${this._id}:`, error);
    }
});

// Create and export the Mongoose model
export default mongoose.model<IJobApplication>('JobApplication', JobApplicationSchema);
