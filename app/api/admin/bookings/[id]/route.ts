import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { ServiceOrder } from "@/models/ServiceOrder";
import "@/models/User";
import { bookingStatusSchema, computeBookingSettlement } from "@/lib/validations/booking";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import {
  notifyBookingConfirmed,
  notifyBookingReturned,
  notifyBookingCancelled,
} from "@/lib/notifications/whatsapp-events";
import { notifyAccounts } from "@/lib/notifications/in-app";
import { formatDate } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const booking = await Booking.findById(id)
    .populate("customer", "name email phone")
    .populate("items.product", "name images sku")
    .lean();

  if (!booking) {
    return apiError("Booking not found", 404);
  }

  return apiSuccess({ booking });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = bookingStatusSchema.parse(body);

    await connectToDatabase();

    const before = await Booking.findById(id).lean();
    if (!before) {
      return apiError("Booking not found", 404);
    }

    const update: Record<string, unknown> = { status: input.status };
    if (input.status === "returned") {
      update.returnedAt = new Date();
      if (input.returnCondition) update.returnCondition = input.returnCondition;
      if (input.returnNotes) update.returnNotes = input.returnNotes;

      const rentalFeesTotal = before.totalAmount - before.securityDeposit;
      const damageCharges = input.damageCharges ?? 0;
      const pendingRentAmount =
        input.pendingRentAmount ?? Math.max(0, rentalFeesTotal - (before.advancePaid ?? 0));
      const { depositRefundAmount, finalSettlementAmount } = computeBookingSettlement({
        securityDeposit: before.securityDeposit,
        damageCharges,
        pendingRentAmount,
      });

      update.dryCleaningRequired = input.dryCleaningRequired ?? false;
      update.stitchingRequired = input.stitchingRequired ?? false;
      update.damageCharges = damageCharges;
      update.pendingRentAmount = pendingRentAmount;
      update.depositRefunded = input.depositRefunded ?? false;
      update.depositRefundAmount = depositRefundAmount;
      update.finalSettlementAmount = finalSettlementAmount;
      update.settledAt = new Date();
    }

    const booking = await Booking.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("customer", "name phone")
      .populate("items.product", "name");

    if (!booking) {
      return apiError("Booking not found", 404);
    }

    if (input.status !== before.status) {
      await recordAuditLog({
        entityType: "Booking",
        entityId: id,
        action: "status_change",
        actor: auth.user,
        changes: [{ field: "status", from: before.status, to: input.status }],
      });
    }

    // Keep each dress's inventory status in sync with the booking lifecycle.
    const productIds = booking.items.map((item) => item.product);
    if (input.status === "confirmed") {
      await Product.updateMany({ _id: { $in: productIds } }, { status: "reserved" });
    } else if (input.status === "in_use") {
      await Product.updateMany({ _id: { $in: productIds } }, { status: "picked_up" });
    } else if (input.status === "returned") {
      const serviceTypesNeeded: Array<"dry_clean" | "tailor"> = [];
      if (input.dryCleaningRequired) serviceTypesNeeded.push("dry_clean");
      if (input.stitchingRequired) serviceTypesNeeded.push("tailor");

      if (serviceTypesNeeded.length > 0) {
        for (const productId of productIds) {
          for (const serviceType of serviceTypesNeeded) {
            const sentDate = new Date();
            const expectedReturnDate = new Date(sentDate);
            expectedReturnDate.setDate(expectedReturnDate.getDate() + 3);
            const serviceOrder = await ServiceOrder.create({
              serviceType,
              product: productId,
              booking: booking._id,
              description: `Flagged at return of booking ${booking.bookingNumber}`,
              stitchingType: serviceType === "tailor" ? "Alteration" : undefined,
              totalAmount: 0,
              sentDate,
              expectedReturnDate,
              status: "pending",
            });
            await recordAuditLog({
              entityType: "ServiceOrder",
              entityId: String(serviceOrder._id),
              action: "create",
              actor: auth.user,
              snapshot: serviceOrder.toObject() as unknown as Record<string, unknown>,
            });
          }
          await Product.findByIdAndUpdate(productId, {
            status: serviceTypesNeeded.includes("dry_clean") ? "under_dry_cleaning" : "under_repair",
          });
        }
      } else {
        await Product.updateMany({ _id: { $in: productIds } }, { status: "available" });
      }
    } else if (input.status === "cancelled") {
      for (const productId of productIds) {
        const stillActive = await Booking.exists({
          "items.product": productId,
          status: { $in: ACTIVE_BOOKING_STATUSES },
          _id: { $ne: booking._id },
        });
        if (!stillActive) {
          await Product.findByIdAndUpdate(productId, { status: "available" });
        }
      }
    }

    const customer = booking.customer as unknown as { name: string; phone?: string } | null;
    const productNames = booking.items
      .map((item) => (item.product as unknown as { name: string } | null)?.name)
      .filter(Boolean)
      .join(", ");

    const notifyContext = {
      customerName: customer?.name ?? "Customer",
      customerPhone: customer?.phone,
      relatedEntityType: "Booking" as const,
      relatedEntityId: id,
      variables: {
        bookingNumber: booking.bookingNumber,
        productName: productNames,
        eventDate: formatDate(booking.eventDate),
        rentalStartDate: formatDate(booking.rentalStartDate),
        rentalEndDate: formatDate(booking.rentalEndDate),
        totalAmount: String(booking.totalAmount),
      },
    };

    if (input.status === "confirmed") {
      void notifyBookingConfirmed(notifyContext);
      void notifyAccounts(ADMIN_ROLES, {
        type: "booking_confirmed",
        title: "Booking confirmed",
        message: `${notifyContext.customerName} — ${booking.bookingNumber} (${productNames})`,
        link: `/admin/bookings/${id}`,
        relatedEntityType: "Booking",
        relatedEntityId: id,
      });
    } else if (input.status === "returned") {
      void notifyBookingReturned(notifyContext);
      void notifyAccounts(ADMIN_ROLES, {
        type: "booking_returned",
        title: "Booking returned",
        message: `${notifyContext.customerName} — ${booking.bookingNumber} (${productNames})`,
        link: `/admin/bookings/${id}`,
        relatedEntityType: "Booking",
        relatedEntityId: id,
      });
    } else if (input.status === "cancelled") {
      void notifyBookingCancelled(notifyContext);
      void notifyAccounts(ADMIN_ROLES, {
        type: "booking_cancelled",
        title: "Booking cancelled",
        message: `${notifyContext.customerName} — ${booking.bookingNumber} (${productNames})`,
        link: `/admin/bookings/${id}`,
        relatedEntityType: "Booking",
        relatedEntityId: id,
      });
    }

    return apiSuccess({ booking });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Restricted to managers+ — deleting a booking removes it from all revenue
// and history reporting, so it's gated tighter than a normal status change.
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const booking = await Booking.findById(id).lean();
  if (!booking) {
    return apiError("Booking not found", 404);
  }

  await Booking.findByIdAndDelete(id);

  await recordAuditLog({
    entityType: "Booking",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: booking as unknown as Record<string, unknown>,
  });

  // Release any dress this booking was holding, unless another active
  // booking still has it out.
  const productIds = booking.items.map((item) => item.product);
  if (ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    for (const productId of productIds) {
      const stillActive = await Booking.exists({
        "items.product": productId,
        status: { $in: ACTIVE_BOOKING_STATUSES },
      });
      if (!stillActive) {
        await Product.findByIdAndUpdate(productId, { status: "available" });
      }
    }
  }

  return apiSuccess({ deleted: true });
}
