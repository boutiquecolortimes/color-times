import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { orderPaymentSchema } from "@/lib/validations/order-payment";
import { collectOrderPayment } from "@/lib/admin/order-invoices";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

// Collect a payment after the advance ("Due Paid"). Updates the order's
// paid/due amounts and logs the payment on its invoice in the Invoices menu.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const input = orderPaymentSchema.parse(await request.json());
    await connectToDatabase();

    const result = await collectOrderPayment(
      "customisation",
      id,
      { amount: input.amount, method: input.method, reference: input.reference, note: input.note },
      auth.user,
      { markDelivered: Boolean(input.markDelivered) }
    );
    if (!result.ok) return apiError(result.message, result.status);

    return apiSuccess({ invoiceId: result.invoiceId, dueAmount: result.dueAmount });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
