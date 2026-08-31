import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { ServiceOrder } from "@/models/ServiceOrder";
import "@/models/User";
import {
  bookingStatusSchema,
  bookingUpdateSchema,
  computeBookingSettlement,
} from "@/lib/validations/booking";
import { ACTIVE_BOOKING_STATUSES, findBookingConflicts } from "@/lib/admin/booking-availability";
import { BOOKING_STATUS_TRANSITIONS, STATUS_LABELS } from "@/lib/admin/booking-status";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import {
  notifyBookingConfirmed,
  notifyBookingReturned,
  notifyBookingCancelled,
} from "@/lib/notifications/whatsapp-events";
import { notifyAccounts } from "@/lib/notifications/in-app";
import { formatDate } from "@/lib/utils";
import type { AccessTokenPayload } from "@/lib/auth/tokens";

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

    // Two different kinds of update share this endpoint: a lifecycle status
    // change (Confirm/Pickup/Return/Cancel, sent by BookingDetailClient)
    // always includes a "status" key; editing the booking's own details
    // (from the Edit page) sends the full field set without one. Staff can
    // move a booking through its lifecycle — that's core day-to-day work —
    // but editing the underlying details (dress, dates, price, customer)
    // is reserved for Admin and up.
    if (!body || typeof body !== "object" || !("status" in body)) {
      if (!MANAGER_ROLES.includes(auth.user.role)) {
        return apiError("You do not have permission to edit booking details", 403);
      }
      return updateBookingDetails(id, body, auth.user);
    }

    const input = bookingStatusSchema.parse(body);

    await connectToDatabase();

    const before = await Booking.findById(id).lean();
    if (!before) {
      return apiError("Booking not found", 404);
    }

    // Enforce the same lifecycle order the status dropdown now offers
    // (Inquiry -> Confirmed -> Picked Up -> Returned, Cancel from any
    // non-final state) — a defense-in-depth check against a stale client
    // or a direct API call skipping straight from, say, Inquiry to
    // Returned, bypassing the intermediate steps entirely.
    if (
      input.status !== before.status &&
      !BOOKING_STATUS_TRANSITIONS[before.status].includes(input.status)
    ) {
      return apiError(
        `Booking is currently "${STATUS_LABELS[before.status]}" and can't move directly to "${STATUS_LABELS[input.status]}"`,
        409
      );
    }

    // Availability is only checked when a booking is first created or its
    // dates are edited afterward — an "inquiry" is deliberately excluded
    // from that check (see ACTIVE_BOOKING_STATUSES) so it doesn't reserve
    // inventory just by existing. That means two unpaid inquiries for the
    // same dress and dates can sit side by side untouched, so re-verify
    // here, at the moment one of them actually becomes a real reservation,
    // instead of only ever checking at creation time.
    if (input.status === "confirmed") {
      for (const item of before.items) {
        const conflicts = await findBookingConflicts(
          String(item.product),
          before.rentalStartDate,
          before.rentalEndDate,
          id
        );
        if (conflicts.length > 0) {
          const conflict = conflicts[0];
          const conflictingProduct = await Product.findById(item.product).select("name").lean();
          return apiError(
            `${conflictingProduct?.name ?? "This dress"} is already booked (${conflict.bookingNumber}) from ${conflict.rentalStartDate.toDateString()} to ${conflict.rentalEndDate.toDateString()} — confirm or cancel that booking first`,
            409
          );
        }
      }
    }

    const update: Record<string, unknown> = { status: input.status };
    if (input.status === "confirmed") {
      // Same correction pattern as Pickup/Return below — the rent, security
      // deposit, and advance entered when the booking was first noted down
      // (often a phone inquiry) may not match what's actually being charged
      // and collected now, so let staff correct all three right here before
      // the invoice is generated.
      const securityDeposit = input.securityDeposit ?? before.securityDeposit;
      const currentRentTotal = before.totalAmount - before.securityDeposit;
      const rentAmount = input.rentAmount ?? currentRentTotal;
      update.securityDeposit = securityDeposit;
      update.totalAmount = rentAmount + securityDeposit;
      if (typeof input.advancePaid === "number") {
        update.advancePaid = input.advancePaid;
      }
      // The invoice's line items are priced per booking item (rentalFee),
      // not off the booking's aggregate total — so a corrected rent figure
      // has to be spread across the items too, or it'd never make it onto
      // the generated invoice. Preserve each item's relative share; if the
      // original total was ₹0 (nothing to take a ratio from), put the whole
      // corrected amount on the first item instead of dropping it.
      if (typeof input.rentAmount === "number" && rentAmount !== currentRentTotal) {
        if (currentRentTotal > 0) {
          const scale = rentAmount / currentRentTotal;
          update.items = before.items.map((item) => ({
            ...item,
            rentalFee: Math.round(item.rentalFee * scale),
          }));
        } else if (before.items.length > 0) {
          update.items = before.items.map((item, index) => ({
            ...item,
            rentalFee: index === 0 ? rentAmount : 0,
          }));
        }
      }
    } else if (input.status === "returned") {
      update.returnedAt = new Date();
      if (input.returnCondition) update.returnCondition = input.returnCondition;
      if (input.returnNotes) update.returnNotes = input.returnNotes;

      // The rental-fee portion never changes here — only the security
      // deposit itself can be corrected at return time (e.g. it was topped
      // up, or only partially collected at booking). Total is recomputed so
      // Billing keeps showing rentalFees + securityDeposit consistently.
      const rentalFeesTotal = before.totalAmount - before.securityDeposit;
      const securityDeposit = input.securityDeposit ?? before.securityDeposit;
      const damageCharges = input.damageCharges ?? 0;
      const pendingRentAmount =
        input.pendingRentAmount ?? Math.max(0, rentalFeesTotal - (before.advancePaid ?? 0));
      const { depositRefundAmount, finalSettlementAmount } = computeBookingSettlement({
        securityDeposit,
        damageCharges,
        pendingRentAmount,
      });

      update.securityDeposit = securityDeposit;
      update.totalAmount = rentalFeesTotal + securityDeposit;
      update.dryCleaningRequired = input.dryCleaningRequired ?? false;
      update.stitchingRequired = input.stitchingRequired ?? false;
      update.damageCharges = damageCharges;
      update.pendingRentAmount = pendingRentAmount;
      update.depositRefunded = input.depositRefunded ?? false;
      update.depositRefundAmount = depositRefundAmount;
      update.finalSettlementAmount = finalSettlementAmount;
      update.settledAt = new Date();
    } else if (input.status === "in_use") {
      // Payment collected when handing over the dress — treated as
      // additional advance paid, on top of whatever's already recorded.
      // The pickup flow now collects the full outstanding due, so this
      // typically brings advancePaid up to totalAmount.
      if (input.pickupPaymentAmount) {
        update.advancePaid = (before.advancePaid ?? 0) + input.pickupPaymentAmount;
      }

      // Security deposit can also be corrected right here at handover (e.g.
      // more was actually collected than what was recorded at booking time)
      // — same principle as the correction allowed at Return. The
      // rental-fee portion of the total never changes; only the deposit,
      // and in turn the total.
      if (
        typeof input.securityDeposit === "number" &&
        input.securityDeposit !== before.securityDeposit
      ) {
        const rentalFeesTotal = before.totalAmount - before.securityDeposit;
        update.securityDeposit = input.securityDeposit;
        update.totalAmount = rentalFeesTotal + input.securityDeposit;
      }
    }

    const booking = await Booking.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("customer", "name phone")
      .populate("items.product", "name");

    if (!booking) {
      return apiError("Booking not found", 404);
    }

    const statusChanges: { field: string; from: unknown; to: unknown }[] = [];
    if (input.status !== before.status) {
      statusChanges.push({ field: "status", from: before.status, to: input.status });
    }
    if (
      (input.status === "confirmed" || input.status === "returned" || input.status === "in_use") &&
      typeof update.securityDeposit === "number" &&
      update.securityDeposit !== before.securityDeposit
    ) {
      statusChanges.push({
        field: "securityDeposit",
        from: before.securityDeposit,
        to: update.securityDeposit,
      });
    }
    if (
      input.status === "confirmed" &&
      typeof update.totalAmount === "number" &&
      update.totalAmount !== before.totalAmount
    ) {
      statusChanges.push({
        field: "totalAmount",
        from: before.totalAmount,
        to: update.totalAmount,
      });
    }
    if (
      input.status === "confirmed" &&
      typeof update.advancePaid === "number" &&
      update.advancePaid !== (before.advancePaid ?? 0)
    ) {
      statusChanges.push({
        field: "advancePaid",
        from: before.advancePaid ?? 0,
        to: update.advancePaid,
      });
    }
    if (statusChanges.length > 0) {
      await recordAuditLog({
        entityType: "Booking",
        entityId: id,
        action: "status_change",
        actor: auth.user,
        changes: statusChanges,
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

// Editing the booking's own details (customer, dates, items, pricing,
// notes, ...) — separate from the lifecycle status transitions above,
// which have their own settlement math and side effects that a plain field
// edit shouldn't touch. Mirrors the create flow's conflict checks and total
// calculation so an edited booking stays internally consistent.
async function updateBookingDetails(
  id: string,
  body: unknown,
  actor: AccessTokenPayload
): Promise<Response> {
  try {
    const input = bookingUpdateSchema.parse(body);

    await connectToDatabase();

    const before = await Booking.findById(id).lean();
    if (!before) {
      return apiError("Booking not found", 404);
    }

    // Once a booking is returned or cancelled its totals feed into a
    // settlement that's already been computed and (often) paid out —
    // rewriting items/pricing after that would leave the settlement
    // pointing at numbers that no longer match the booking.
    if (before.status === "returned" || before.status === "cancelled") {
      return apiError(
        "This booking has already been returned or cancelled and can no longer be edited.",
        409
      );
    }

    // Bill numbers are required and must be unique — same bulk-import
    // concern as on create (see the POST route below).
    const duplicateBill = await Booking.findOne({
      billNumber: input.billNumber,
      deletedAt: null,
      _id: { $ne: id },
    })
      .select("bookingNumber")
      .lean();
    if (duplicateBill) {
      return apiError(
        `Bill number ${input.billNumber} is already used by booking ${duplicateBill.bookingNumber}`,
        409
      );
    }

    const rentalStartDate = new Date(input.rentalStartDate);
    const rentalEndDate = new Date(input.rentalEndDate);

    const items = [];
    for (const inputItem of input.items) {
      const product = await Product.findById(inputItem.product).lean();
      if (!product) {
        return apiError("One of the selected dresses could not be found", 404);
      }

      const conflicts = await findBookingConflicts(
        inputItem.product,
        rentalStartDate,
        rentalEndDate,
        id
      );
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        return apiError(
          `${product.name} is already booked (${conflict.bookingNumber}) from ${conflict.rentalStartDate.toDateString()} to ${conflict.rentalEndDate.toDateString()}`,
          409
        );
      }

      const quantity = 1;
      const size = product.variants[0]?.size ?? "Custom";
      const color = inputItem.color || product.color;
      const pricePerDay = inputItem.pricePerDay ?? product.rentalPricePerDay;
      const rentalFee = pricePerDay * quantity;

      items.push({
        product: inputItem.product,
        color,
        size,
        quantity,
        pricePerDay,
        rentalFee,
        wearerName: inputItem.wearerName || undefined,
        measurements: inputItem.measurements,
      });
    }

    const securityDeposit = input.securityDeposit ?? before.securityDeposit;
    const totalAmount = items.reduce((sum, item) => sum + item.rentalFee, 0) + securityDeposit;

    const update = {
      billNumber: input.billNumber,
      bookingDate: new Date(input.bookingDate),
      customer: input.customer,
      items,
      rentalStartDate,
      rentalEndDate,
      eventDate: input.eventDate ? new Date(input.eventDate) : rentalStartDate,
      securityDeposit,
      totalAmount,
      advancePaid: input.advancePaid ?? before.advancePaid,
      advancePaymentMethod: input.advancePaymentMethod || undefined,
      measurements: input.measurements,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes || undefined,
    };

    const booking = await Booking.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("customer", "name email phone")
      .populate("items.product", "name images sku");

    if (!booking) {
      return apiError("Booking not found", 404);
    }

    // Keep dress inventory in sync when items changed on a booking that
    // already has dresses reserved (confirmed) or picked up (in_use) —
    // otherwise a swapped-out dress would stay stuck as unavailable, and a
    // swapped-in one wouldn't show as held.
    const inventoryStatus =
      before.status === "confirmed" ? "reserved" : before.status === "in_use" ? "picked_up" : null;
    if (inventoryStatus) {
      const beforeProductIds = before.items.map((item) => String(item.product));
      const afterProductIds = items.map((item) => String(item.product));
      const added = afterProductIds.filter((pid) => !beforeProductIds.includes(pid));
      const removed = beforeProductIds.filter((pid) => !afterProductIds.includes(pid));

      if (added.length > 0) {
        await Product.updateMany({ _id: { $in: added } }, { status: inventoryStatus });
      }
      for (const productId of removed) {
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

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      booking.toObject() as unknown as Record<string, unknown>
    );
    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "Booking",
        entityId: id,
        action: "update",
        actor,
        changes,
      });
    }

    return apiSuccess({ booking });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Restricted to managers+ — soft delete. Moves the booking to Trash instead
// of erasing it outright: it drops out of every list/report immediately
// (matching the old behavior for anyone glancing at the numbers), but stays
// recoverable until someone explicitly permanently deletes it from Trash.
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const booking = await Booking.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!booking) {
    return apiError("Booking not found", 404);
  }

  await recordAuditLog({
    entityType: "Booking",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: booking.toObject() as unknown as Record<string, unknown>,
  });

  // Release any dress this booking was holding, unless another active
  // booking still has it out.
  const productIds = booking.items.map((item) => item.product);
  if (ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    for (const productId of productIds) {
      const stillActive = await Booking.exists({
        "items.product": productId,
        status: { $in: ACTIVE_BOOKING_STATUSES },
        deletedAt: null,
      });
      if (!stillActive) {
        await Product.findByIdAndUpdate(productId, { status: "available" });
      }
    }
  }

  return apiSuccess({ deleted: true });
}
