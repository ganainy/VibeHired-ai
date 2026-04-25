// server/src/models/CV.ts
import mongoose, { Document, Schema, Types } from 'mongoose';
import { JsonResumeSchema } from '../types/jsonresume';
import { CvSectionDescriptor } from '../types/cvDescriptor';

/**
 * Unified CV Model
 * 
 * Stores both base CVs and job-specific CVs in a single collection.
 * - Default base CV: isDefault = true, jobApplicationId = null (only ONE per user)
 * - Other base CV: isDefault = false, category = "Cybersecurity", jobApplicationId = null
 * - Job CV: jobApplicationId = <job_id> (tailored for specific job)
 */
export interface ICV extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    
    // CV Branch System
    isDefault: boolean;           // One default base CV per user (used by AI generation)
    category: string | null;       // e.g., "Software Engineering", "Cybersecurity", null = primary
    displayName: string;           // User-friendly name: "My SE Resume", "Cyber CV"
    
    jobApplicationId?: Types.ObjectId | null;
    cvJson?: JsonResumeSchema | null;
    /** Immutable snapshot of the first extraction result from uploaded file. */
    originalCvJson?: JsonResumeSchema | null;
    /** Extraction strategy used when parsing the uploaded CV. */
    extractionMode?: 'strict' | 'standard' | null;
    /** Timestamp of the initial extraction snapshot. */
    extractionTimestamp?: Date | null;
    /**
     * AI-generated structural descriptor produced once at upload time.
     * When present, the UI and PDF are built dynamically from this + cvData.
     * Null for legacy CVs that have not been re-processed.
     */
    cvDescriptor?: CvSectionDescriptor[] | null;
    /**
     * Free-form content keyed by CvSectionDescriptor.key.
     * Used together with cvDescriptor to drive the dynamic editor & template.
     * Null for legacy CVs.
     */
    cvData?: Record<string, any> | null;
    templateId?: string | null;  // null = use user's default template
    filename?: string | null;    // Original uploaded filename
    analysisCache?: Record<string, unknown> | null;
    isStarred?: boolean;
    tailoringChanges?: Array<{
        section: string;       // e.g., "work", "skills", "summary"
        description: string;   // What was changed
        reason: string;        // Why it was changed (connection to job requirements)
        before?: string;       // Optional before snapshot
        after?: string;        // Optional after snapshot
    }> | null;
    tailoringDetails?: {
        extractedKeywords?: string[];
        summaryRewrite?: string;
        reorderedExperience?: string[];
        selectedProjects?: string[];
        omittedProjects?: string[];
        competencyGrid?: string[];
        keywordInjections?: Array<{ original: string; jdKeyword: string; tailored: string }>;
    } | null;
    version: number;           // For optimistic concurrency in workspace
    snapshotVersion?: number;
    lastEditedAt?: Date;
    originalPdf?: Buffer | null;
    createdAt: Date;
    updatedAt: Date;
}

const CVSchema = new Schema<ICV>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        // CV Branch System
        isDefault: {
            type: Boolean,
            required: true,
            default: false,
            index: true,
        },
        category: {
            type: String,
            default: null,
            maxlength: 50,  // Reasonable limit for category names
        },
        displayName: {
            type: String,
            required: true,
            maxlength: 100,  // Reasonable limit for display names
        },
        jobApplicationId: {
            type: Schema.Types.ObjectId,
            ref: 'JobApplication',
            default: null,
            index: true,
            sparse: true,
        },
        cvJson: {
            type: Schema.Types.Mixed,
            required: false,
            default: null,
        },
        originalCvJson: {
            type: Schema.Types.Mixed,
            required: false,
            default: null,
        },
        extractionMode: {
            type: String,
            enum: ['strict', 'standard'],
            default: null,
        },
        extractionTimestamp: {
            type: Date,
            default: null,
        },
        cvDescriptor: {
            type: Schema.Types.Mixed,
            default: null,
        },
        cvData: {
            type: Schema.Types.Mixed,
            default: null,
        },
        templateId: {
            type: String,
            default: null,  // null means inherit from user's default
        },
        filename: {
            type: String,
            default: null,
        },
        analysisCache: {
            type: Schema.Types.Mixed,
            default: null,
        },
        isStarred: {
            type: Boolean,
            default: false,
        },
        tailoringChanges: {
            type: [{
                section: { type: String, required: true },
                description: { type: String, required: true },
                reason: { type: String, required: true },
                before: { type: String },
                after: { type: String },
            }],
            default: null,
        },
        tailoringDetails: {
            type: Schema.Types.Mixed,
            default: null,
        },
        version: {
            type: Number,
            default: 0,
            min: 0,
        },
        snapshotVersion: {
            type: Number,
            default: 1,
            min: 1,
        },
        lastEditedAt: {
            type: Date,
            default: null,
        },
        originalPdf: {
            type: Buffer,
            default: null,
            select: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

/**
 * Unique partial index: Ensures only ONE default base CV per user
 * Only applies when isDefault = true
 */
CVSchema.index(
    { userId: 1, isDefault: 1 },
    {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: 'unique_default_cv_per_user',
    }
);

/**
 * Unique index: Ensures only ONE CV per job application
 * Sparse index ignores documents where jobApplicationId is null
 */
CVSchema.index(
    { jobApplicationId: 1 },
    {
        unique: true,
        partialFilterExpression: { jobApplicationId: { $ne: null } },
        name: 'unique_cv_per_job',
    }
);

/**
 * Compound index for efficient user CV queries
 */
CVSchema.index({ userId: 1, createdAt: -1 });

/**
 * Virtual to populate job application details when needed
 */
CVSchema.virtual('jobApplication', {
    ref: 'JobApplication',
    localField: 'jobApplicationId',
    foreignField: '_id',
    justOne: true,
});

/**
 * Static method: Get default base CV for a user
 */
CVSchema.statics.getDefaultCv = async function (userId: Types.ObjectId | string) {
    return this.findOne({ userId, isDefault: true });
};

/**
 * Static method: Get all base CVs for a user (default + category CVs, excludes job CVs)
 */
CVSchema.statics.getBaseCvs = async function (userId: Types.ObjectId | string) {
    return this.find({ userId, jobApplicationId: null }).sort({ isDefault: -1, createdAt: -1 });
};

/**
 * Static method: Get all CVs for a user
 */
CVSchema.statics.getUserCvs = async function (userId: Types.ObjectId | string) {
    return this.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};

/**
 * Static method: Get CV for a specific job
 */
CVSchema.statics.getJobCv = async function (jobApplicationId: Types.ObjectId | string) {
    return this.findOne({ jobApplicationId });
};

/**
 * Static method: Set a base CV as the default
 * - Unsets current default CV
 * - Sets target CV as new default
 */
CVSchema.statics.setAsDefault = async function (
    cvId: Types.ObjectId | string,
    userId: Types.ObjectId | string
) {
    const cv = await this.findOne({ _id: cvId, userId });
    if (!cv) {
        throw new Error('CV not found or does not belong to user');
    }

    if (cv.isDefault) {
        throw new Error('CV is already the default base CV');
    }

    if (cv.jobApplicationId) {
        throw new Error('Cannot set a job-specific CV as default');
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Unset current default CV
        await this.updateMany(
            { userId, isDefault: true },
            { $set: { isDefault: false } }
        ).session(session);

        // Set target CV as default
        cv.isDefault = true;
        await cv.save({ session });

        await session.commitTransaction();
        return cv;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export interface ICVModel extends mongoose.Model<ICV> {
    getDefaultCv(userId: Types.ObjectId | string): Promise<ICV | null>;
    getBaseCvs(userId: Types.ObjectId | string): Promise<ICV[]>;
    getUserCvs(userId: Types.ObjectId | string): Promise<ICV[]>;
    getJobCv(jobApplicationId: Types.ObjectId | string): Promise<ICV | null>;
    setAsDefault(cvId: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<ICV>;
}

const CV = mongoose.model<ICV, ICVModel>('CV', CVSchema);

export default CV;
