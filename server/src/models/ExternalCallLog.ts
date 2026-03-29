import mongoose, { Document, Schema } from 'mongoose';

export type ExternalCallCategory = 'ai' | 'apify';

export interface IExternalCallLog extends Document {
  category: ExternalCallCategory;
  provider: string;
  host: string;
  path: string;
  method: string;
  creditUsed?: number;
  statusCode?: number;
  success: boolean;
  durationMs: number;
  modelName?: string;
  requestPath?: string;
  requestMethod?: string;
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ExternalCallLogSchema = new Schema<IExternalCallLog>(
  {
    category: {
      type: String,
      enum: ['ai', 'apify'],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    host: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
      uppercase: true,
      default: 'GET',
    },
    creditUsed: {
      type: Number,
      min: 0,
    },
    statusCode: {
      type: Number,
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    durationMs: {
      type: Number,
      required: true,
      min: 0,
    },
    modelName: {
      type: String,
    },
    requestPath: {
      type: String,
    },
    requestMethod: {
      type: String,
      uppercase: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userEmail: {
      type: String,
    },
    errorMessage: {
      type: String,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

ExternalCallLogSchema.index({ createdAt: -1 });
ExternalCallLogSchema.index({ category: 1, createdAt: -1 });
ExternalCallLogSchema.index({ provider: 1, createdAt: -1 });

export default mongoose.model<IExternalCallLog>('ExternalCallLog', ExternalCallLogSchema);
