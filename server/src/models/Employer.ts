// server/src/models/Employer.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface ISubLocation {
  _id: mongoose.Types.ObjectId;
  name: string;
}

export interface IEmployerBonus {
  _id?: mongoose.Types.ObjectId | string;
  name: string;
  multiplier: number; // e.g. 0.5 = 50% extra pay
  conditionType: 'day_of_week' | 'time_range' | 'specific_dates';
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  specificDates?: string[];
}

export interface IEmployer extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  logoUrl?: string;
  logoPublicId?: string; // Cloudinary public_id for deletion
  hourlyRate?: number | null;
  subLocations: ISubLocation[]; // sub-departments / sub-companies
  bonuses: IEmployerBonus[];
  createdAt?: Date;
  updatedAt?: Date;
}

const SubLocationSchema = new Schema<ISubLocation>(
  { name: { type: String, required: true, trim: true } },
  { _id: true }
);

const EmployerBonusSchema = new Schema<IEmployerBonus>(
  {
    name: { type: String, required: true, trim: true },
    multiplier: { type: Number, required: true, min: 0 },
    conditionType: {
      type: String,
      enum: ['day_of_week', 'time_range', 'specific_dates'],
      required: true,
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startTime: {
      type: String,
      match: [/^\d{2}:\d{2}$/, 'startTime must be HH:mm'],
    },
    endTime: {
      type: String,
      match: [/^\d{2}:\d{2}$/, 'endTime must be HH:mm'],
    },
    specificDates: [
      {
        type: String,
        match: [/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'],
      },
    ],
  },
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
    hourlyRate: {
      type: Number,
      required: false,
      default: null,
    },
    subLocations: {
      type: [SubLocationSchema],
      default: [],
    },
    bonuses: {
      type: [EmployerBonusSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IEmployer>('Employer', EmployerSchema);
