import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { notifyInvoiceSent } from "@/lib/notifications/whatsapp-events";
import { notifyAccounts } from "@/lib/notifications/in-app";
import { formatDate } from "@/lib/utils";
import { siteConfig } from "@/lib/config/site";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const existing = await Invoice.findById(id).lean();
    if (!existing) {
      return apiError("Invoice not found", 404);
    }
    if (existing.status !== "draft") {
      return apiError("Only draft invoices can be sent", 409);
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { status: "sent", issuedAt: new Date() },
      { returnDocument: "after" }
    ).populate("customer", "name phone");

    await recordAuditLog({
      entityType: "Invoice",
      entityId: id,
      action: "status_change",
      actor: auth.user,
      changes: [{ field: "status", from: "draft", to: "sent" }],
    });

    if (invoice) {
      const customer = invoice.customer as unknown as { name: string; phone?: string } | null;
      void notifyInvoiceSent({
        customerName: customer?.name ?? "Customer",
        customerPhone: customer?.phone,
        relatedEntityType: "Invoice",
        relatedEntityId: id,
        // Public, unauthenticated route — Meta's servers can fetch it
        // directly as the template's document header. Only actually sent
        // to Meta when the active invoice_sent template has
        // metaHeaderType "document" (see lib/notifications/whatsapp-events.ts).
        documentUrl: `${siteConfig.url}/api/invoices/${id}/pdf`,
        documentFilename: `${invoice.invoiceNumber}.pdf`,
        variables: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: String(invoice.total),
          amountDue: String(invoice.amountDue),
          dueDate: formatDate(invoice.dueDate),
        },
      });
      void notifyAccounts(ADMIN_ROLES, {
        type: "invoice_sent",
        title: "Invoice sent",
        message: `${invoice.invoiceNumber} sent to ${customer?.name ?? "customer"} — ₹${invoice.total.toLocaleString("en-IN")}`,
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
