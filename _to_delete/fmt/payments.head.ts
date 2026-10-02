import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/User";
import { invoicePaymentSchema } from "@/lib/validations/invoice";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { notifyPaymentReceived } from "@/lib/notifications/whatsapp-events";
import { notifyAccounts } from "@/lib/notifications/in-app";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = invoicePaymentSchema.parse(body);

    await connectToDatabase();

    const existing = await Invoice.findById(id).lean();
    if (!existing) {
      return apiError("Invoice not found", 404);
    }
    if (existing.status === "draft") {
      return apiError("Send the invoice before recording payments", 409);
    }
    if (existing.status === "paid" || existing.status === "cancelled") {
      return apiError(`Cannot record a payment on an invoice that is ${existing.status}`, 409);
    }
    if (input.amount > existing.amountDue) {
      return apiError(
        `Payment exceeds the amount due (₹${existing.amountDue.toLocaleString("en-IN")})`,
        422
      );
    }

    const amountPaid = existing.amountPaid + input.amount;
    const amountDue = existing.total - amountPaid;
    const status = amountDue <= 0 ? "paid" : "partially_paid";

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      {
        $push: {
          payments: {
            amount: input.amount,
            method: input.method,
            reference: input.reference,
            note: input.note,
            paidAt: new Date(),
            recordedBy: auth.user.sub,
          },
        },
        amountPaid,
        amountDue: Math.max(amountDue, 0),
        status,
      },
      { returnDocument: "after" }
    ).populate("customer", "name phone");

    await recordAuditLog({
      entityType: "Invoice",
      entityId: id,
      action: "update",
      actor: auth.user,
      changes: [
        { field: "amountPaid", from: existing.amountPaid, to: amountPaid },
        { field: "status", from: existing.status, to: status },
      ],
      metadata: { payment: input },
    });

    if (invoice) {
      const customer = invoice.customer as unknown as { name: string; phone?: string } | null;
      void notifyPaymentReceived({
        customerName: customer?.name ?? "Customer",
        customerPhone: customer?.phone,
        relatedEntityType: "Invoice",
        relatedEntityId: id,
        variables: {
          invoiceNumber: invoice.invoiceNumber,
          amountPaid: String(input.amount),
          amountDue: String(invoice.amountDue),
        },
      });
      void notifyAccounts(ADMIN_ROLES, {
        type: "payment_received",
        title: "Payment received",
        message: `₹${input.amount.toLocaleString("en-IN")} from ${customer?.name ?? "customer"} — ${invoice.invoiceNumber}`,
        link: `/admin/invoices/${id}`,
        relatedEntityType: "Invoice",
        relatedEntityId: id,
      });
    }

    return apiSuccess({ invoice });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
