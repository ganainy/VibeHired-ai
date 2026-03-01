import mongoose, { Document, Schema } from 'mongoose';

export interface IAppointmentType extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const AppointmentTypeSchema: Schema = new Schema(
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
    },
    { timestamps: true }
);

export default mongoose.model<IAppointmentType>('AppointmentType', AppointmentTypeSchema);
