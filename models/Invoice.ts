import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentMethod = "cash" | "card" | "upi" | "bank_transfer" | "other";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// What a payment entry is for — lets the invoice show a clear history:
// Advance (taken when the order/booking was made), Due Paid (collected
// later, e.g. at delivery), or a payment recorded by hand on the invoice.
export type InvoicePaymentKind = "advance" | "due" | "manual";

// Where the invoice came from. Older invoices have no value stored: treat
// them as "booking" when they have a booking link, else "manual".
export type InvoiceSource = "booking" | "sale" | "customisation" | "manual";

export interface InvoicePayment {
  _id?: Types.ObjectId;
  kind?: InvoicePaymentKind;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  paidAt: Date;
  recordedBy: Types.ObjectId;
}

// Why a booking invoice was generated/updated: the booking's status at that
// moment (Confirmed, Picked Up = "in_use", Returned …). One entry per stage
// the invoice was synced at, so the invoice shows its full reason trail.
export interface InvoiceStageEntry {
  stage: string;
  at: Date;
  total: number;
  amountPaid: number;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  // Optional for Sale / Customisation invoices — walk-in sales don't always
  // have a customer record; billTo below always carries name/phone.
  customer?: Types.ObjectId | null;
  booking?: Types.ObjectId | null;
  source?: InvoiceSource;
  sale?: Types.ObjectId | null;
  customisationOrder?: Types.ObjectId | null;
  /** Name/phone/address as printed on the bill (snapshot from the order). */
  billTo?: { name: string; phone?: string; address?: string };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  securityDeposit: number;
  depositRefunded: boolean;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  payments: InvoicePayment[];
  dueDate: Date;
  issuedAt?: Date | null;
  notes?: string;
  /** Booking status when this invoice was last generated/updated. */
  bookingStage?: string;
  stageHistory: InvoiceStageEntry[];
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<InvoiceLineItem>(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new Schema<InvoicePayment>(
  {
    kind: { type: String, enum: ["advance", "due", "manual"] },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: ["cash", "card", "upi", "bank_transfer", "other"], required: true },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    paidAt: { type: Date, required: true, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    source: { type: String, enum: ["booking", "sale", "customisation", "manual"], index: true },
    sale: { type: Schema.Types.ObjectId, ref: "Sale", default: null, index: true },
    customisationOrder: {
      type: Schema.Types.ObjectId,
      ref: "CustomisationOrder",
      default: null,
      index: true,
    },
    billTo: {
      type: new Schema(
        {
          name: { type: String, required: true, trim: true },
          phone: { type: String, trim: true },
          address: { type: String, trim: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    lineItems: { type: [lineItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    depositRefunded: { type: Boolean, default: false },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"],
      default: "draft",
      index: true,
    },
    payments: { type: [paymentSchema], default: [] },
    dueDate: { type: Date, required: true },
    issuedAt: { type: Date, default: null },
    notes: { type: String, trim: true },
    bookingStage: { type: String, trim: true },
    stageHistory: {
      type: [
        new Schema<InvoiceStageEntry>(
          {
            stage: { type: String, required: true },
            at: { type: Date, required: true },
            total: { type: Number, required: true },
            amountPaid: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    archivedAt: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1, createdAt: -1 });

export const Invoice: Model<IInvoice> =
  models.Invoice ?? model<IInvoice>("Invoice", invoiceSchema);
