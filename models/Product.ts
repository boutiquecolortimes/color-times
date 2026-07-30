import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// Free-text now — the admin form lets the user type any size (numeric,
// letter, or free-form) instead of picking from a fixed dropdown.
export type ProductSize = string;

export type ProductStatus =
  | "available"
  | "booked"
  | "reserved"
  | "picked_up"
  | "under_dry_cleaning"
  | "under_repair"
  | "damaged"
  | "returned";

export const PRODUCT_STATUSES: ProductStatus[] = [
  "available",
  "booked",
  "reserved",
  "picked_up",
  "under_dry_cleaning",
  "under_repair",
  "damaged",
  "returned",
];

export interface IProductVariant {
  size: ProductSize;
  quantityInStock: number;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku: string;
  category: Types.ObjectId;
  designer?: string;
  description: string;
  color: string;
  fabric: string;
  dressType?: string;
  work?: string;
  images: string[];
  variants: IProductVariant[];
  status: ProductStatus;
  rentalPricePerDay: number;
  retailValue: number;
  purchasePrice?: number;
  stitchingCost?: number;
  transportCost?: number;
  securityDeposit: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
  tags: string[];
  isFavorited: boolean;
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IProductVariant>(
  {
    size: { type: String, required: true, trim: true },
    quantityInStock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    designer: { type: String, trim: true },
    description: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "" },
    fabric: { type: String, trim: true, default: "" },
    dressType: { type: String, trim: true },
    work: { type: String, trim: true },
    images: { type: [String], required: true, validate: (v: string[]) => v.length > 0 },
    variants: { type: [variantSchema], required: true },
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: "available",
      index: true,
    },
    rentalPricePerDay: { type: Number, required: true, min: 0 },
    retailValue: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, min: 0 },
    stitchingCost: { type: Number, min: 0 },
    transportCost: { type: Number, min: 0 },
    securityDeposit: { type: Number, required: true, min: 0 },
    isFeatured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [], index: true },
    isFavorited: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ deletedAt: 1, archivedAt: 1, createdAt: -1 });

export const Product: Model<IProduct> =
  models.Product ?? model<IProduct>("Product", productSchema);
