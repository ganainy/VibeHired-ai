// server/src/models/CoverLetter.ts
/**
 * CoverLetter Model
 *
 * Stores base cover letters and job-specific cover letters independently.
 * - Base CL:  jobApplicationId = null, userId = user's ID
 * - Job CL:   jobApplicationId = <job_id> (independent copy, fully isolated)
 *
 * The isolation guarantee: when a job-specific CL is created (by copying a base CL
 * or uploading a file), it is stored as a completely separate document. Future edits
 * or deletion of the original base CL will NOT affect any existing job-specific CLs.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICoverLetter extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;

    /** User-friendly name shown in selection lists */
    displayName: string;

    /** The plain-text cover letter content */
    coverLetterText: string;

    /** Language of the cover letter */
    language: 'en' | 'de';

    /** null = base cover letter; ObjectId = job-specific copy */
    jobApplicationId?: Types.ObjectId | null;

    /** Original uploaded filename (PDF/DOCX), if uploaded rather than typed */
    filename?: string | null;

    /** Raw binary of the uploaded PDF/DOCX file – stored for full isolation */
    fileBuffer?: Buffer | null;

    /** MIME type of fileBuffer (e.g. "application/pdf") */
    fileMimeType?: string | null;

    /** AI-suggested email subject (from generation) */
    emailSubject?: string | null;

    /** AI-suggested email body (from generation) */
    emailBody?: string | null;

    /** Recipient email/name (from AI generation) */
    emailRecipient?: string | null;

    createdAt: Date;
    updatedAt: Date;
}

const CoverLetterSchema = new Schema<ICoverLetter>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        displayName: {
            type: String,
            required: true,
            maxlength: 150,
            trim: true,
        },
        coverLetterText: {
            type: String,
            required: true,
        },
        language: {
            type: String,
            enum: ['en', 'de'],
            default: 'en',
        },
        jobApplicationId: {
            type: Schema.Types.ObjectId,
            ref: 'JobApplication',
            default: null,
            index: true,
            sparse: true,
        },
        filename: {
            type: String,
            default: null,
        },
        fileBuffer: {
            type: Buffer,
            default: null,
            select: false, // Exclude heavy binary from default queries
        },
        fileMimeType: {
            type: String,
            default: null,
        },
        emailSubject: {
            type: String,
            default: null,
        },
        emailBody: {
            type: String,
            default: null,
        },
        emailRecipient: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

/** Unique: only ONE cover letter per job application */
CoverLetterSchema.index(
    { jobApplicationId: 1 },
    {
        unique: true,
        partialFilterExpression: { jobApplicationId: { $ne: null } },
        name: 'unique_cl_per_job',
    }
);

/** Efficient list queries per user */
CoverLetterSchema.index({ userId: 1, createdAt: -1 });

/**
 * Virtual: populate job application details when needed
 */
CoverLetterSchema.virtual('jobApplication', {
    ref: 'JobApplication',
    localField: 'jobApplicationId',
    foreignField: '_id',
    justOne: true,
});

/**
 * Static: get all base (non-job-specific) cover letters for a user
 */
CoverLetterSchema.statics.getBaseCoverLetters = async function (
    userId: Types.ObjectId | string
) {
    return this.find({ userId, jobApplicationId: null }).sort({ createdAt: -1 });
};

/**
 * Static: get the job-specific cover letter for a job
 */
CoverLetterSchema.statics.getJobCoverLetter = async function (
    jobApplicationId: Types.ObjectId | string
) {
    return this.findOne({ jobApplicationId });
};

const CoverLetter = mongoose.model<ICoverLetter>('CoverLetter', CoverLetterSchema);

export default CoverLetter;
