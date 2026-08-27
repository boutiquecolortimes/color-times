import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type ExpenseCategory =
  | "rent"
  | "electricity"
  | "water"
  | "maintenance"
  | "transport"
  | "marketing"
  | "office_supplies"
  | "miscellaneous";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "rent",
  "electricity",
  "water",
  "maintenance",
  "transport",
  "marketing",
  "office_supplies",
  "miscellaneous",
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent",
  electricity: "Electricity",
  water: "Water",
  maintenance: "Maintenance",
  transport: "Transport",
  marketing: "Marketing",
  office_supplies: "Office Supplies",
  miscellaneous: "Miscellaneous",
};

// Deliberately excludes "salary" — staff salary is tracked through the
// Staff + SalaryPayment models instead, so it isn't double-counted here.
export interface IExpense extends Document {
  _id: Types.ObjectId;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: Date;
  paymentMethod?: string;
  notes?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true, default: Date.now, index: true },
    paymentMethod: { type: String, trim: true },
    notes: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

expenseSchema.index({ createdAt: -1 });

export const Expense: Model<IExpense> = models.Expense ?? model<IExpense>("Expense", expenseSchema);
