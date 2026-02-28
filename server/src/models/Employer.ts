// server/src/models/Employer.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface ISubLocation {
  _id: mongoose.Types.ObjectId;
  name: string;
}

export interface IEmployer extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  logoUrl?: string;
  logoPublicId?: string; // Cloudinary public_id for deletion
  subLocations: ISubLocation[]; // sub-departments / sub-companies
  createdAt?: Date;
  updatedAt?: Date;
}

const SubLocationSchema = new Schema<ISubLocation>(
  { name: { type: String, required: true, trim: true } },
  { _id: true }
);

const EmployerSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      required: false,
    },
    logoPublicId: {
      type: String,
      required: false,
    },
    subLocations: {
      type: [SubLocationSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IEmployer>('Employer', EmployerSchema);
