import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import { Review } from "@/models/Review";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const customer = await User.findOne({ _id: id, role: "customer" }).lean();
    if (!customer) {
      return apiError("Customer not found", 404);
    }

    if (!customer.deletedAt) {
      return apiError("Move this customer to trash before permanently deleting it", 409);
    }

    // Bookings, invoices, and reviews all carry a link back to the customer
    // — erasing the account would orphan that billing/history trail. Block
    // it, same pattern as Categories/Products/Bookings.
    const [bookingCount, invoiceCount, reviewCount] = await Promise.all([
      Booking.countDocuments({ customer: id }),
      Invoice.countDocuments({ customer: id }),
      Review.countDocuments({ customer: id }),
    ]);
    if (bookingCount > 0 || invoiceCount > 0 || reviewCount > 0) {
      return apiError(
        `Cannot permanently delete — ${bookingCount} booking(s), ${invoiceCount} invoice(s), and ${reviewCount} review(s) still reference this customer. Leave it in Trash instead.`,
        409
      );
    }

    await User.findByIdAndDelete(id);

    await recordAuditLog({
      entityType: "Customer",
      entityId: id,
      action: "delete",
      actor: auth.user,
      snapshot: customer as unknown as Record<string, unknown>,
      metadata: { permanent: true },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
