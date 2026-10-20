import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { optionalPhoneSchema } from "@/lib/validations/phone";
import { premiumStateOf } from "@/lib/mobile/premium";

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  line1: z.string().trim().max(200).optional().default(""),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(12).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120).optional(),
  phone: optionalPhoneSchema,
  addresses: z.array(addressSchema).max(10).optional(),
});

async function loadMe(id: string) {
  const user = await User.findById(id)
    .select("name email phone role isEmailVerified addresses premium wishlist createdAt")
    .lean();
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    addresses: user.addresses ?? [],
    wishlistCount: (user.wishlist ?? []).length,
    premium: premiumStateOf(user.premium),
    memberSince: user.createdAt,
  };
}

export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();
    const me = await loadMe(auth.user.sub);
    if (!me) return apiError("Account not found", 404);
    return apiSuccess({ me });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const input = updateMeSchema.parse(await request.json());
    await connectToDatabase();

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.phone !== undefined) update.phone = input.phone || undefined;
    if (input.addresses !== undefined) {
      // Exactly one default address when any exist.
      const hasDefault = input.addresses.some((address) => address.isDefault);
      update.addresses = input.addresses.map((address, index) => ({
        ...address,
        isDefault: hasDefault ? address.isDefault : index === 0,
      }));
    }

    await User.updateOne({ _id: auth.user.sub }, { $set: update });
    const me = await loadMe(auth.user.sub);
    return apiSuccess({ me });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
