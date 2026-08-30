import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type UserRole = "customer" | "staff" | "admin" | "developer" | "super_admin";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  fatherName?: string;
  passwordHash: string;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  isActive: boolean;
  // Bumped on every password change (self-service or admin reset). Refresh
  // tokens carry the version they were issued with, so bumping this
  // instantly invalidates every other outstanding session for this user
  // without needing to track/blocklist individual tokens.
  tokenVersion: number;
  // DB-backed login lockout (not in-memory) so it holds up correctly across
  // serverless instances, which don't share memory.
  failedLoginAttempts: number;
  lockedUntil?: Date;
  deletedAt?: Date | null;
  wishlist: Types.ObjectId[];
  addresses: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    isDefault: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// City/state/postal are intentionally not required — walk-in customers at
// the counter are often jotted down with just a line1 address (a locality
// or landmark), and the quick-add customer flows in the Booking and Sale
// forms only ever collect that one line. Requiring the full breakdown here
// meant those addresses were silently discarded on save (see the POST
// handler in app/api/admin/customers/route.ts).
const addressSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    line1: { type: String, trim: true, default: "" },
    line2: { type: String, trim: true },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "staff", "admin", "developer", "super_admin"],
      default: "customer",
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0, select: false },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    deletedAt: { type: Date, default: null, index: true },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

export const User: Model<IUser> = models.User ?? model<IUser>("User", userSchema);
