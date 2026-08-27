import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type SalaryPaymentMethod = "cash" | "bank_transfer" | "upi" | "cheque" | "other";

export const SALARY_PAYMENT_METHODS: SalaryPaymentMethod[] = [
  "cash",
  "bank_transfer",
  "upi",
  "cheque",
  "other",
];

export interface ISalaryPayment extends Document {
  _id: Types.ObjectId;
  staff: Types.ObjectId;
  amount: number;
  // "YYYY-MM" — which month's salary this payment is against, independent
  // of paymentDate (a late payment for June might be paid in July).
  forMonth: string;
  paymentDate: Date;
  paymentMethod: SalaryPaymentMethod;
  notes?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const salaryPaymentSchema = new Schema<ISalaryPayment>(
  {
    staff: { type: Schema.Types.ObjectId, ref: "Staff", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    forMonth: { type: String, required: true, trim: true, index: true },
    paymentDate: { type: Date, required: true, default: Date.now, index: true },
    paymentMethod: { type: String, enum: SALARY_PAYMENT_METHODS, default: "cash" },
    notes: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ createdAt: -1 });

export const SalaryPayment: Model<ISalaryPayment> =
  models.SalaryPayment ?? model<ISalaryPayment>("SalaryPayment", salaryPaymentSchema);
