import crypto from "crypto";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { siteConfig } from "@/lib/config/site";
import { toWhatsAppNumber } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const booking = await Booking.findById(id).populate("customer", "name phone");

    if (!booking) {
      return apiError("Booking not found", 404);
    }

    // Reviews are only requested once the dress is back — asking any
    // earlier would be asking about an experience that isn't finished yet.
    if (booking.status !== "returned") {
      return apiError(
        "Review requests can only be sent after the dress has been returned",
        400
      );
    }

    // The token is generated once and reused for every re-send, so a link
    // already shared with the customer (e.g. saved in their WhatsApp chat)
    // keeps working.
    if (!booking.reviewToken) {
      booking.reviewToken = crypto.randomBytes(24).toString("hex");
    }
    booking.reviewRequestedAt = new Date();
    await booking.save();

    const customer = booking.customer as unknown as { name: string; phone?: string } | null;
    const reviewUrl = `${siteConfig.url}/review/${booking.reviewToken}`;
    const message = `Hi ${customer?.name ?? "there"}! Thank you for renting with ${siteConfig.name} for booking ${booking.bookingNumber}. We'd love to hear how it went — please share your review and a few photos here: ${reviewUrl}`;

    const whatsappNumber = toWhatsAppNumber(customer?.phone);
    const whatsappUrl = whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
      : null;

    return apiSuccess({ reviewUrl, whatsappUrl, message });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
