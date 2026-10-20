import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/User";
import "@/models/Booking";

// Returned booking: the part of the deposit kept toward unpaid rent/damage.
function depositUsedFor(invoice: { securityDeposit?: number; booking?: unknown }): number {
  const booking = invoice.booking as { status?: string; depositRefundAmount?: number } | null;
  if (!booking || booking.status !== "returned") return 0;
  return Math.max(0, (invoice.securityDeposit ?? 0) - (booking.depositRefundAmount ?? 0));
}

export type InvoicePdfLoadResult =
  | { ok: true; data: Awaited<ReturnType<typeof buildData>> }
  | { ok: false; status: 404 | 422; message: string };

async function buildData(invoice: NonNullable<Awaited<ReturnType<typeof findInvoice>>>, customer: { name: string; email: string; phone?: string }) {
  // Legacy / imported invoices can be missing "required" fields — normalise
  // so the PDF never crashes on undefined numbers or dates.
  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    createdAt: invoice.createdAt ?? new Date(),
    dueDate: invoice.dueDate ?? invoice.createdAt ?? new Date(),
    customer: { name: customer.name, email: customer.email, phone: customer.phone },
    lineItems: invoice.lineItems ?? [],
    subtotal: invoice.subtotal ?? 0,
    discountAmount: invoice.discountAmount ?? 0,
    taxRate: invoice.taxRate ?? 0,
    taxAmount: invoice.taxAmount ?? 0,
    securityDeposit: invoice.securityDeposit ?? 0,
    total: invoice.total ?? 0,
    amountPaid: invoice.amountPaid ?? 0,
    amountDue: invoice.amountDue ?? 0,
    pickupPaid: (invoice.booking as unknown as { pickupPaid?: number } | null)?.pickupPaid ?? 0,
    depositUsed: depositUsedFor(invoice),
    payments: invoice.payments ?? [],
    notes: invoice.notes,
    bookingStage: invoice.bookingStage,
    source: invoice.source,
  };
}

function findInvoice(id: string) {
  return Invoice.findById(id)
    .populate("customer", "name email phone")
    .populate("booking", "pickupPaid status depositRefundAmount")
    .lean();
}

/** Everything the invoice PDF (server or browser renderer) needs, by invoice id. */
export async function loadInvoicePdfData(id: string): Promise<InvoicePdfLoadResult> {
  if (!Types.ObjectId.isValid(id)) return { ok: false, status: 404, message: "Not found" };
  await connectToDatabase();
  const invoice = await findInvoice(id);
  if (!invoice || invoice.deletedAt) return { ok: false, status: 404, message: "Not found" };

  const linked = invoice.customer as unknown as { name: string; email: string; phone?: string } | null;
  // Sale / Customisation bills for walk-ins have no customer record — the
  // name and phone printed on the bill come from billTo instead.
  const customer =
    linked ?? (invoice.billTo ? { name: invoice.billTo.name, email: "", phone: invoice.billTo.phone } : null);
  if (!customer) {
    return { ok: false, status: 422, message: "This invoice's customer record is missing." };
  }
  return { ok: true, data: await buildData(invoice, customer) };
}
