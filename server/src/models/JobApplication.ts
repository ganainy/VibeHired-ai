// server/src/models/JobApplication.ts
import mongoose, { Document, Schema } from 'mongoose';
import { JsonResumeSchema } from '../types/jsonresume'; // Assuming this type exists

// Define allowed statuses
type GenerationStatus = 'none' | 'pending_input' | 'draft_ready' | 'finalized' | 'error';

// Interface defining the structure of a Job Application document
export interface IJobApplication extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    jobTitle: string;
    companyName: string;
    status: 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Closed' | 'Offer'; // Example statuses
    dateApplied?: Date; // Optional: Mark when applied
    jobUrl?: string; // Optional but useful
    notes?: string; // Optional user notes
    salary?: string; // Salary (can be number, range, or text like "50k-70k")
    contact?: string; // Contact info (email, link, or name)
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
    draftCvJson?: JsonResumeSchema | mongoose.Schema.Types.Mixed; // Store draft CV data
    draftCoverLetterText?: string; // Store draft Cover Letter text
    generationStatus?: GenerationStatus; // Track the generation process
    // --- New Fields for Final Filenames ---
    generatedCvFilename?: string; // Store the filename of the latest generated CV PDF
    generatedCoverLetterFilename?: string; // Store the filename of the latest generated CL PDF
    // --- New Fields for CV Branch System ---
    jobCategory?: string | null;   // e.g., "Software Engineering" (free text)
    baseCvId?: mongoose.Schema.Types.ObjectId | null;  // Which CV branch was used as base
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
        jobUrl: { type: String, trim: true },
        notes: { type: String, trim: true },
        salary: { type: String, trim: true }, // Flexible format: "50000", "50k-70k", "$80,000 - $100,000"
        contact: { type: String, trim: true }, // Email, URL, or name
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
            salaryRaw: String, // Store raw salary string from AI
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
        draftCvJson: { type: Schema.Types.Mixed, required: false },
        draftCoverLetterText: { type: String, required: false },
        generationStatus: {
            type: String,
            enum: ['none', 'pending_input', 'pending_generation', 'draft_ready', 'finalized', 'error'], // Added pending_generation
            default: 'none'
        },
        // --- Schema Definitions for New Fields ---
        generatedCvFilename: { type: String, required: false },
        generatedCoverLetterFilename: { type: String, required: false },
        // --- Schema Definitions for CV Branch System ---
        jobCategory: { type: String, default: null, maxlength: 50 },
        baseCvId: { type: Schema.Types.ObjectId, ref: 'CV', default: null },
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