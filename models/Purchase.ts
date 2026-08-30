import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type PurchasePaymentStatus = "paid" | "pending" | "partial";

export const PURCHASE_PAYMENT_STATUSES: PurchasePaymentStatus[] = ["paid", "pending", "partial"];

export interface IPurchase extends Document {
  _id: Types.ObjectId;
  // The dealer's own bill/invoice number — not system-generated. Purchases
  // entered together as one parcel (see the parcel-entry endpoint) share the
  // same billNumber, which is how the Purchases list groups them back
  // together even though each product line is still its own document. Left
  // optional (not unique) so older purchases entered one at a time before
  // this existed keep working untouched.
  billNumber?: string;
  itemName: string;
  vendorName: string;
  vendorContact?: string;
  // Optional link to an existing dress — when set (with addedToStock),
  // this purchase bumped that product's variant stock on creation.
  product?: Types.ObjectId | null;
  variantSize?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: Date;
  paymentStatus: PurchasePaymentStatus;
  amountPaid: number;
  addedToStock: boolean;
  notes?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    billNumber: { type: String, trim: true, index: true },
    itemName: { type: String, required: true, trim: true },
    vendorName: { type: String, required: true, trim: true },
    vendorContact: { type: String, trim: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    variantSize: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    purchaseDate: { type: Date, required: true, default: Date.now, index: true },
    paymentStatus: { type: String, enum: PURCHASE_PAYMENT_STATUSES, default: "paid" },
    amountPaid: { type: Number, min: 0, default: 0 },
    addedToStock: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

purchaseSchema.index({ createdAt: -1 });

export const Purchase: Model<IPurchase> =
  models.Purchase ?? model<IPurchase>("Purchase", purchaseSchema);
