// server/src/models/Project.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  detailedDescription?: string;
  imageUrl?: string;
  imageId?: mongoose.Types.ObjectId;
  videoUrl?: string;
  projectUrl?: string;
  githubUrl?: string;
  technologies?: string[];
  tags?: string[];
  featured?: boolean;
  order?: number;
  isImported?: boolean;
  sourceType?: 'manual' | 'github' | 'external';
  sourceId?: string;
  stars?: number;
  forks?: number;
  isVisibleInPortfolio?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    detailedDescription: {
      type: String,
    },
    imageUrl: String,
    imageId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    videoUrl: String,
    projectUrl: String,
    githubUrl: String,
    technologies: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    featured: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isImported: {
      type: Boolean,
      default: false,
    },
    sourceType: {
      type: String,
      enum: ['manual', 'github', 'external'],
      default: 'manual',
    },
    sourceId: String,
    stars: {
      type: Number,
      default: 0,
      min: 0,
    },
    forks: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVisibleInPortfolio: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound indexes for efficient querying
ProjectSchema.index({ userId: 1, order: 1 });
ProjectSchema.index({ userId: 1, featured: 1 });
ProjectSchema.index({ userId: 1, isVisibleInPortfolio: 1 });

export default mongoose.model<IProject>('Project', ProjectSchema);

