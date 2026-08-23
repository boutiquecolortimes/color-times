import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// "manual" = created directly from the Sale menu (an outright dress sale).
// "booking" = auto-recorded when a booking's settlement invoice is
// generated, purely so staff have one ledger of everything billed — its
// totalAmount duplicates revenue already counted via the booking itself, so
// it's excluded when summing a product's earnings from Sale records.
export type SaleSource = "manual" | "booking";

export interface ISale extends Document {
  _id: Types.ObjectId;
  billNumber: string;
  saleDate: Date;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: Types.ObjectId;
  details?: string;
  totalAmount: number;
  source: SaleSource;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const saleSchema = new Schema<ISale>(
  {
    billNumber: { type: String, required: true, unique: true, index: true },
    saleDate: { type: Date, required: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    details: { type: String, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ["manual", "booking"], default: "manual", index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });

export const Sale: Model<ISale> = models.Sale ?? model<ISale>("Sale", saleSchema);
