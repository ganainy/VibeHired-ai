// server/src/models/WorkEntry.ts
import mongoose, { Document, Schema } from 'mongoose';

export type WorkEntryType = 'shift' | 'appointment';
export type WorkEntryStatus = 'planned' | 'done';

export interface IWorkEntry extends Document {
  userId: mongoose.Types.ObjectId;
  employerId?: mongoose.Types.ObjectId;
  appointmentTypeId?: mongoose.Types.ObjectId;
  subLocationId?: string;   // ObjectId string of the embedded sub-location
  subLocationName?: string; // Name snapshot at time of creation
  title?: string; // Optional label (e.g. "Team standup", "Morning shift")
  type: WorkEntryType;
  date: Date; // Date of the entry (midnight UTC)
  startTime: string; // 'HH:mm' e.g. '09:00'
  endTime: string;   // 'HH:mm' e.g. '17:00'
  hours: number;     // Computed duration in hours (decimal)
  breakMinutes: number; // Unpaid break in minutes (subtracted from hours)
  paidKilometers?: number; // Optional paid distance compensation in km
  status: WorkEntryStatus;
  notes?: string;
  googleCalendarEventId?: string;
  reminderCreated: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Compute decimal hours from HH:mm strings. Handles overnight shifts (end < start). Deducts unpaid break. */
function computeHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // overnight
  const totalMins = Math.max(0, (endMins - startMins) - breakMinutes);
  return Math.round((totalMins / 60) * 100) / 100;
}

const WorkEntrySchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: false,
      index: true,
    },
    appointmentTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'AppointmentType',
      required: false,
      index: true,
    },
    subLocationId: {
      type: String,
      required: false,
    },
    subLocationName: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      trim: true,
      required: false,
    },
    type: {
      type: String,
      enum: ['shift', 'appointment'],
      required: true,
      default: 'shift',
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'startTime must be HH:mm'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'endTime must be HH:mm'],
    },
    hours: {
      type: Number,
      required: true,
      default: 0,
    },
    breakMinutes: {
      type: Number,
      required: true,
      default: 0,
    },
    paidKilometers: {
      type: Number,
      required: false,
      default: 0,
    },
    status: {
      type: String,
      enum: ['planned', 'done'],
      required: true,
      default: 'planned',
    },
    notes: {
      type: String,
      required: false,
    },
    googleCalendarEventId: {
      type: String,
      required: false,
    },
    reminderCreated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-compute hours before saving
WorkEntrySchema.pre('save', function (next) {
  const entry = this as unknown as IWorkEntry;
  if (entry.isModified('startTime') || entry.isModified('endTime') || entry.isModified('breakMinutes') || entry.isNew) {
    entry.hours = computeHours(entry.startTime, entry.endTime, entry.breakMinutes || 0);
  }
  next();
});

export { computeHours };
export default mongoose.model<IWorkEntry>('WorkEntry', WorkEntrySchema);
