import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { notifySaleBillSent } from "@/lib/notifications/whatsapp-events";
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

    const sale = await Sale.findById(id).lean();
    if (!sale || sale.deletedAt) {
      return apiError("Sale not found", 404);
    }

    void notifySaleBillSent({
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      relatedEntityType: "Sale",
      relatedEntityId: id,
      variables: {
        billNumber: sale.billNumber,
        totalAmount: String(sale.totalAmount),
        billPdfUrl: `${siteConfig.url}/api/sales/${id}/pdf`,
      },
    });
    void notifyAccounts(ADMIN_ROLES, {
      type: "sale_bill_sent",
      title: "Sale bill sent",
      message: `${sale.billNumber} sent to ${sale.customerName} — ₹${sale.totalAmount.toLocaleString("en-IN")}`,
      // A dedicated Sale Detail page exists — link straight to this sale
      // instead of dropping the recipient on the unfiltered list.
      link: `/admin/sales/${id}`,
      relatedEntityType: "Sale",
      relatedEntityId: id,
    });

    return apiSuccess({ sent: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
