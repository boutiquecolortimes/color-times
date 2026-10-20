import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { ContactMessage } from "@/models/ContactMessage";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { notifyAccounts } from "@/lib/notifications/in-app";
import { premiumStateOf } from "@/lib/mobile/premium";

const enquirySchema = z.object({
  productId: z.string().trim().optional(),
  eventDate: z.string().trim().optional(),
  pickupDate: z.string().trim().optional(),
  returnDate: z.string().trim().optional(),
  size: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1500).optional().or(z.literal("")),
  wantsTrial: z.boolean().optional(),
});

function fmt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * A customer's "Request this dress" from the app. Lands as a booking enquiry
 * (ContactMessage) and pings every staff account in-app + by push, so the
 * counter can call back and create the actual booking with a bill number.
 * Privé members are flagged as priority.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const input = enquirySchema.parse(await request.json());
    await connectToDatabase();

    const user = await User.findById(auth.user.sub).select("name email phone premium").lean();
    if (!user) return apiError("Account not found", 404);
    const premium = premiumStateOf(user.premium);

    const product = input.productId
      ? await Product.findById(input.productId).select("name sku").lean()
      : null;

    const lines = [
      premium.isActive ? "★ PRIVÉ MEMBER — PRIORITY" : null,
      product ? `Dress: ${product.name} (${product.sku})` : null,
      input.size ? `Size: ${input.size}` : null,
      fmt(input.eventDate) ? `Event: ${fmt(input.eventDate)}` : null,
      fmt(input.pickupDate) ? `Pickup: ${fmt(input.pickupDate)}` : null,
      fmt(input.returnDate) ? `Return: ${fmt(input.returnDate)}` : null,
      input.wantsTrial ? "Wants an in-store trial" : null,
      input.message ? `Note: ${input.message}` : null,
      "Sent from the Color Times app",
    ].filter(Boolean);

    const enquiry = await ContactMessage.create({
      name: user.name,
      email: user.email,
      phone: user.phone,
      reason: "booking_inquiry",
      message: lines.join("\n").slice(0, 2000),
    });

    void notifyAccounts(ADMIN_ROLES, {
      type: "customer_enquiry",
      title: `${premium.isActive ? "★ Priority enquiry" : "New enquiry"} — ${user.name}`,
      message: product
        ? `${product.name}${input.eventDate ? ` for ${fmt(input.eventDate)}` : ""}${user.phone ? ` · ${user.phone}` : ""}`
        : `${user.phone ?? user.email}`,
      link: "/admin/customers",
      relatedEntityType: "ContactMessage",
      relatedEntityId: String(enquiry._id),
    });

    return apiSuccess({ id: String(enquiry._id), priority: premium.isActive }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
