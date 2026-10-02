import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { notifyPaymentReminder } from "@/lib/notifications/whatsapp-events";
import { formatDate } from "@/lib/utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectToDatabase();

    const invoice = await Invoice.findById(id).populate("customer", "name phone");
    if (!invoice) {
      return apiError("Invoice not found", 404);
    }
    if (invoice.amountDue <= 0) {
      return apiError("This invoice has no outstanding balance", 409);
    }

    const customer = invoice.customer as unknown as { name: string; phone?: string } | null;

    await notifyPaymentReminder({
      customerName: customer?.name ?? invoice.billTo?.name ?? "Customer",
      customerPhone: customer?.phone || invoice.billTo?.phone,
      relatedEntityType: "Invoice",
      relatedEntityId: id,
      variables: {
        invoiceNumber: invoice.invoiceNumber,
        amountDue: String(invoice.amountDue),
        dueDate: formatDate(invoice.dueDate),
      },
    });

    return apiSuccess({ sent: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
