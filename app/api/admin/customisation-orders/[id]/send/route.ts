import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { notifyCustomisationBillSent } from "@/lib/notifications/whatsapp-events";
import { notifyAccounts } from "@/lib/notifications/in-app";
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

    const order = await CustomisationOrder.findById(id).lean();
    if (!order || order.deletedAt) {
      return apiError("Customisation order not found", 404);
    }

    void notifyCustomisationBillSent({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      relatedEntityType: "CustomisationOrder",
      relatedEntityId: id,
      // Public, unauthenticated route — Meta's servers can fetch it
      // directly as the template's document header. Only actually sent
      // to Meta when the active customisation_bill_sent template has
      // metaHeaderType "document" (see lib/notifications/whatsapp-events.ts).
      documentUrl: `${siteConfig.url}/api/customisation-orders/${id}/pdf`,
      documentFilename: `${order.billNumber}.pdf`,
      variables: {
        billNumber: order.billNumber,
        totalAmount: String(order.totalAmount),
        advancePayment: String(order.advancePayment),
        dueAmount: String(order.dueAmount),
      },
    });
    void notifyAccounts(ADMIN_ROLES, {
      type: "customisation_bill_sent",
      title: "Customisation bill sent",
      message: `${order.billNumber} sent to ${order.customerName} — ₹${order.totalAmount.toLocaleString("en-IN")}`,
      link: `/admin/customisation`,
      relatedEntityType: "CustomisationOrder",
      relatedEntityId: id,
    });

    return apiSuccess({ sent: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
