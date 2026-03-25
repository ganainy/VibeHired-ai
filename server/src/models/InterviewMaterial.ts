// server/src/models/InterviewMaterial.ts
import mongoose, { Document, Schema } from 'mongoose';

export type MaterialType = 'pdf' | 'image' | 'text' | 'markdown' | 'link' | 'docx';

export interface IInterviewMaterial extends Document {
    userId: mongoose.Types.ObjectId;
    /** Optional – null means the material is owned by the user but not tied to a specific job */
    jobApplicationId?: mongoose.Types.ObjectId | null;
    type: MaterialType;
    title: string;
    description?: string;

    // ── File fields (populated when type is pdf / image / docx) ─────────────
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    originalFilename?: string;
    mimeType?: string;
    fileSize?: number; // bytes

    // ── Content field (type = text | markdown) ───────────────────────────────
    content?: string;

    // ── Link field (type = link) ─────────────────────────────────────────────
    url?: string;

    /** When true the item appears on the global Prep Library page */
    isGlobal: boolean;

    /** User has starred/favourited this material for quick access */
    isFavorite: boolean;

    /** Token for public sharing (anyone with the link can view) */
    shareToken?: string;

    createdAt: Date;
    updatedAt: Date;
}

const InterviewMaterialSchema = new Schema<IInterviewMaterial>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        jobApplicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', default: null, index: true },
        type: {
            type: String,
            enum: ['pdf', 'image', 'text', 'markdown', 'link', 'docx'],
            required: true,
        },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 1000 },

        cloudinaryUrl: { type: String },
        cloudinaryPublicId: { type: String },
        originalFilename: { type: String },
        mimeType: { type: String },
        fileSize: { type: Number },

        content: { type: String },
        url: { type: String },

        isGlobal: { type: Boolean, default: false },
        isFavorite: { type: Boolean, default: false },
        shareToken: { type: String, unique: true, sparse: true, index: true },
    },
    { timestamps: true }
);

// Compound index for efficient per-user global queries
InterviewMaterialSchema.index({ userId: 1, isGlobal: 1 });
InterviewMaterialSchema.index({ userId: 1, jobApplicationId: 1 });

const InterviewMaterial = mongoose.model<IInterviewMaterial>('InterviewMaterial', InterviewMaterialSchema);

export default InterviewMaterial;
