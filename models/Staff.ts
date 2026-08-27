import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IStaff extends Document {
  _id: Types.ObjectId;
  name: string;
  phone?: string;
  designation: string;
  monthlySalary: number;
  joiningDate: Date;
  isActive: boolean;
  notes?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<IStaff>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true, default: "" },
    monthlySalary: { type: Number, required: true, min: 0 },
    joiningDate: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

staffSchema.index({ createdAt: -1 });

export const Staff: Model<IStaff> = models.Staff ?? model<IStaff>("Staff", staffSchema);
