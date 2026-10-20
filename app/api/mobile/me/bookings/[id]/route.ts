import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { bookingRemainingDue } from "@/lib/admin/booking-status";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** One of the customer's own bookings with its bills. Scoped to the caller. */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return apiError("Booking not found", 404);

    await connectToDatabase();
    const booking = await Booking.findOne({ _id: id, customer: auth.user.sub, deletedAt: null })
      .populate("items.product", "name images")
      .lean();
    if (!booking) return apiError("Booking not found", 404);

    const invoices = await Invoice.find({ booking: booking._id, deletedAt: null })
      .select("invoiceNumber status total amountPaid amountDue issuedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return apiSuccess({
      booking: {
        _id: String(booking._id),
        bookingNumber: booking.bookingNumber,
        billNumber: booking.billNumber,
        status: booking.status,
        rentalStartDate: booking.rentalStartDate,
        rentalEndDate: booking.rentalEndDate,
        eventDate: booking.eventDate,
        totalAmount: booking.totalAmount,
        securityDeposit: booking.securityDeposit,
        advancePaid: booking.advancePaid ?? 0,
        damageCharges: booking.damageCharges ?? 0,
        depositRefundAmount: booking.depositRefundAmount ?? 0,
        depositRefunded: Boolean(booking.depositRefunded),
        remainingDue: bookingRemainingDue(booking),
        returnedAt: booking.returnedAt ?? null,
        measurements: booking.measurements ?? null,
        items: booking.items.map((item) => {
          const product = item.product as unknown as { _id: unknown; name: string; images: string[] } | null;
          return {
            productId: product ? String(product._id) : null,
            name: product?.name ?? "Dress",
            image: product?.images?.[0] ?? "",
            color: item.color,
            size: item.size,
            rentalFee: item.rentalFee,
            wearerName: item.wearerName ?? "",
          };
        }),
        reviewToken: booking.status === "returned" ? booking.reviewToken ?? null : null,
      },
      invoices: invoices.map((invoice) => ({
        _id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        issuedAt: invoice.issuedAt ?? invoice.createdAt,
      })),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
