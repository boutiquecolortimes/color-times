import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { Booking } from "@/models/Booking";
import { Sale } from "@/models/Sale";
import "@/models/Product";
import { generateInvoiceNumber } from "@/lib/admin/invoice-number";
import { generateSaleBillNumber } from "@/lib/admin/sale-number";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { formatDate } from "@/lib/utils";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface PopulatedCustomer {
  name: string;
  phone?: string;
  addresses?: { line1: string; city: string; state: string; postalCode: string; isDefault: boolean }[];
}

function formatCustomerAddress(customer: PopulatedCustomer | null, deliveryAddress?: string): string {
  if (deliveryAddress) return deliveryAddress;
  const address =
    customer?.addresses?.find((a) => a.isDefault) ?? customer?.addresses?.[0] ?? null;
  if (!address) return "N/A";
  return `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const bookingId = String(body.bookingId ?? "");
    if (!bookingId) {
      return apiError("bookingId is required", 400);
    }

    await connectToDatabase();

    const booking = await Booking.findById(bookingId)
      .populate("items.product", "name")
      .populate("customer", "name phone addresses")
      .lean();
    if (!booking) {
      return apiError("Booking not found", 404);
    }

    const existing = await Invoice.findOne({
      booking: bookingId,
      deletedAt: null,
      status: { $ne: "cancelled" },
    }).lean();

    const isReturned = booking.status === "returned";
    const dateRange = `${formatDate(booking.rentalStartDate)} to ${formatDate(booking.rentalEndDate)}`;
    const lineItems = booking.items.map((item) => {
      const productName = (item.product as unknown as { name: string } | null)?.name ?? "Rental";
      const unitPrice = item.rentalFee / item.quantity;
      return {
        description: `Rental — ${productName} (${item.size}), ${dateRange}`,
        quantity: item.quantity,
        unitPrice,
        amount: item.rentalFee,
      };
    });
    const damageCharges = isReturned ? (booking.damageCharges ?? 0) : 0;
    if (damageCharges > 0) {
      lineItems.push({
        description: `Damage charges — noted at return (${booking.returnCondition?.replace("_", " ") ?? "damaged"})`,
        quantity: 1,
        unitPrice: damageCharges,
        amount: damageCharges,
      });
    }
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const advancePaid = booking.advancePaid ?? 0;

    // For a booking that's already been returned, the security deposit has
    // already been settled (partly or fully applied toward dues, with any
    // leftover refunded — see the return dialog) rather than still being an
    // open charge, so it isn't added to the invoice total again. The invoice
    // is just for whatever's still outstanding: rent + damage, minus the
    // advance and whatever portion of the deposit was applied.
    const depositRefundAmount = isReturned ? (booking.depositRefundAmount ?? 0) : 0;
    const depositApplied = isReturned ? Math.max(0, booking.securityDeposit - depositRefundAmount) : 0;

    if (existing) {
      // A booking generates/refreshes its invoice at more than one lifecycle
      // stage (Confirm, Pickup, Return) — this used to hard-fail with a 409
      // the second time around, leaving whatever was collected later (a
      // payment at pickup, damage charges + settlement at return) never
      // reflected on the invoice already created back at Confirm. Instead of
      // failing, bring the same invoice in line with the booking's current
      // state and hand it back, so calling this is safe at every stage.
      if (existing.status === "paid" || existing.status === "cancelled") {
        return apiSuccess({ invoice: existing });
      }

      const discountAmount = Math.min(existing.discountAmount ?? 0, subtotal);
      const taxableAmount = subtotal - discountAmount;
      const taxAmount = ((existing.taxRate ?? 0) * taxableAmount) / 100;
      const total =
        (isReturned ? subtotal : subtotal + booking.securityDeposit) - discountAmount + taxAmount;

      const computedPaid = isReturned
        ? Math.min(total, Math.max(0, advancePaid + depositApplied))
        : Math.min(total, advancePaid);
      // Never move amountPaid backwards — staff may have recorded additional
      // manual payments directly on the invoice beyond what the booking tracks.
      const amountPaid = Math.max(existing.amountPaid, computedPaid);
      const amountDue = Math.max(0, total - amountPaid);
      const status = amountDue === 0 ? "paid" : existing.status;

      const updated = await Invoice.findByIdAndUpdate(
        existing._id,
        {
          lineItems,
          subtotal,
          securityDeposit: booking.securityDeposit,
          depositRefunded: isReturned ? Boolean(booking.depositRefunded) : existing.depositRefunded,
          total,
          amountPaid,
          amountDue,
          status,
          notes: isReturned
            ? `Auto-generated from booking ${booking.bookingNumber} — settled after return`
            : existing.notes,
        },
        { returnDocument: "after" }
      );

      if (
        amountPaid !== existing.amountPaid ||
        total !== existing.total ||
        status !== existing.status
      ) {
        await recordAuditLog({
          entityType: "Invoice",
          entityId: String(existing._id),
          action: "update",
          actor: auth.user,
          changes: [
            { field: "total", from: existing.total, to: total },
            { field: "amountPaid", from: existing.amountPaid, to: amountPaid },
            { field: "status", from: existing.status, to: status },
          ],
          metadata: { syncedFromBooking: booking.bookingNumber },
        });
      }

      return apiSuccess({ invoice: updated });
    }

    const total = isReturned ? subtotal : subtotal + booking.securityDeposit;
    // Not-yet-returned invoices (generated at Confirm or Pickup time) used
    // to hardcode this to 0, which ignored any advance/pickup payment
    // already recorded on the booking — an invoice generated right after
    // collecting full payment at pickup would still show as fully unpaid.
    const amountPaid = isReturned
      ? Math.min(total, Math.max(0, advancePaid + depositApplied))
      : Math.min(total, advancePaid);
    const amountDue = Math.max(0, total - amountPaid);

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      customer: booking.customer,
      booking: booking._id,
      lineItems,
      subtotal,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      securityDeposit: booking.securityDeposit,
      depositRefunded: isReturned ? Boolean(booking.depositRefunded) : false,
      total,
      amountPaid,
      amountDue,
      status: amountDue === 0 ? "paid" : "draft",
      dueDate: booking.eventDate,
      notes: isReturned
        ? `Auto-generated from booking ${booking.bookingNumber} — settled after return`
        : `Auto-generated from booking ${booking.bookingNumber}`,
    });

    await recordAuditLog({
      entityType: "Invoice",
      entityId: String(invoice._id),
      action: "create",
      actor: auth.user,
      snapshot: invoice.toObject() as unknown as Record<string, unknown>,
      metadata: { fromBooking: booking.bookingNumber },
    });

    // Every generated invoice also drops a matching record into the Sale
    // menu so staff have one place to see all revenue, not just rentals.
    // This is best-effort — a hiccup here shouldn't fail the invoice itself,
    // which is already created and is the record that actually matters.
    try {
      const customer = booking.customer as unknown as
        | { name: string; phone?: string; addresses?: { line1: string; city: string; state: string; postalCode: string; isDefault: boolean }[] }
        | null;
      const primaryProduct = booking.items[0]?.product as unknown as { _id: string } | null;
      if (primaryProduct?._id) {
        const productNames = booking.items
          .map((item) => (item.product as unknown as { name: string } | null)?.name)
          .filter(Boolean)
          .join(", ");
        const saleBillNumber = await generateSaleBillNumber();
        await Sale.create({
          billNumber: saleBillNumber,
          saleDate: new Date(),
          customerName: customer?.name ?? "—",
          customerPhone: customer?.phone || "N/A",
          customerAddress: formatCustomerAddress(customer, booking.deliveryAddress),
          product: primaryProduct._id,
          details: `Rental invoice ${invoiceNumber} — ${productNames} (Booking ${booking.bookingNumber})`,
          totalAmount: total,
          // Just a revenue-ledger entry for this rental settlement — not an
          // outright sale, so it must never mark the dress "sold" or get
          // double-counted alongside the booking's own earnings.
          source: "booking",
        });
      }
    } catch (saleError) {
      console.error("Failed to record sale for invoice", invoiceNumber, saleError);
    }

    return apiSuccess({ invoice }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
